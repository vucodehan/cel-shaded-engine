/**
 * Canvas UI kit in screen points: draw inside a phone's screen callback (or a ScreenCanvas, or any 2D canvas).
 * Every function draws at once and restores the context state. Sizes follow the phone's UI (17 pt body text,
 * 70.8 pt icons on the measured 95 pt grid); continuous (iOS-style) corners wherever a card or tile has corners.
 */
import { linear, linearAngle, rgba, Stops } from "./color";
import { clamp, lerp } from "./ease";
import { font, FontRole } from "./fonts";
import { PHONE, SCREEN_H, SCREEN_W } from "./geometry";
import { drawGlyph, glyph, GlyphFn, GlyphName } from "./glyphs";

type Ctx = CanvasRenderingContext2D;

/** System-like colours (light appearance). */
export const IOS = {
  label: "#000000", label2: "rgba(60,60,67,0.6)", label3: "rgba(60,60,67,0.3)", sep: "rgba(60,60,67,0.18)",
  bg: "#ffffff", bg2: "#f2f2f7", fill: "rgba(120,120,128,0.16)",
  blue: "#007aff", green: "#34c759", red: "#ff3b30", orange: "#ff9500", yellow: "#ffcc00", pink: "#ff2d55",
  purple: "#af52de", teal: "#30b0c7", indigo: "#5856d6", gray: "#8e8e93",
  bubbleIn: "#e9e9eb", bubbleOut: "#0a84ff",
};

/** Device pixels per unit of the current transform. */
export const devScale = (ctx: Ctx) => {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
};

// ---- shapes -------------------------------------------------------------------------------------------------

const K = [1.52866483, 1.08849323, 0.86840689, 0.66993427, 0.63149399, 0.074911, 0.37282392, 0.16905899, 0.065496];
/** Add a continuous-corner rounded rect (the iOS corner curve) to a path; very round shapes fall back to circular
 * corners (r capped at half the short side). */
export function squirclePath(p: Ctx | Path2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, r);
  if (r * K[0] > Math.min(w, h) / 2) {
    p.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    return;
  }
  const [a, b, c, d, e, f, g, i, j] = K.map((k) => k * r);
  const X = x + w, Y = y + h;
  p.moveTo(x + a, y);
  p.lineTo(X - a, y);
  p.bezierCurveTo(X - b, y, X - c, y, X - d, y + j);
  p.lineTo(X - e, y + f);
  p.bezierCurveTo(X - g, y + i, X - i, y + g, X - f, y + e);
  p.lineTo(X - j, y + d);
  p.bezierCurveTo(X, y + c, X, y + b, X, y + a);
  p.lineTo(X, Y - a);
  p.bezierCurveTo(X, Y - b, X, Y - c, X - j, Y - d);
  p.lineTo(X - f, Y - e);
  p.bezierCurveTo(X - i, Y - g, X - g, Y - i, X - e, Y - f);
  p.lineTo(X - d, Y - j);
  p.bezierCurveTo(X - c, Y, X - b, Y, X - a, Y);
  p.lineTo(x + a, Y);
  p.bezierCurveTo(x + b, Y, x + c, Y, x + d, Y - j);
  p.lineTo(x + e, Y - f);
  p.bezierCurveTo(x + g, Y - i, x + i, Y - g, x + f, Y - e);
  p.lineTo(x + j, Y - d);
  p.bezierCurveTo(x, Y - c, x, Y - b, x, Y - a);
  p.lineTo(x, y + a);
  p.bezierCurveTo(x, y + b, x, y + c, x + j, y + d);
  p.lineTo(x + f, y + e);
  p.bezierCurveTo(x + i, y + g, x + g, y + i, x + e, y + f);
  p.lineTo(x + d, y + j);
  p.bezierCurveTo(x + c, y, x + b, y, x + a, y);
  p.closePath();
}
/** beginPath + continuous rounded rect. */
export function squircle(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  squirclePath(ctx, x, y, w, h, r);
}
/** beginPath + a stadium (fully round ends). */
export function capsule(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(w, h) / 2));
}

/** A fill: a colour, a canvas gradient, or stops (a vertical gradient over the shape's box). */
export type Fill = string | CanvasGradient | Stops;
export const fillOf = (ctx: Ctx, f: Fill, x: number, y: number, w: number, h: number, angle = 180) =>
  Array.isArray(f) ? linearAngle(ctx, x, y, w, h, angle, f) : f;

/** CSS box-shadow-like shadow in the current units: blur radius, offset, colour. */
export type Shadow = { blur: number; x?: number; y?: number; color?: string };
export const setShadow = (ctx: Ctx, s?: Shadow) => {
  if (!s) return;
  const k = devScale(ctx);
  ctx.shadowColor = s.color ?? "rgba(0,0,0,0.16)";
  ctx.shadowBlur = s.blur * k;
  ctx.shadowOffsetX = (s.x ?? 0) * k;
  ctx.shadowOffsetY = (s.y ?? 0) * k;
};
export const noShadow = (ctx: Ctx) => {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
};

/** Scale a drawing about a point (for pops): inside fn, draw as usual. */
export function about(ctx: Ctx, x: number, y: number, s: number, fn: () => void, alpha = 1) {
  if (s <= 0.001 || alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

// ---- text ---------------------------------------------------------------------------------------------------

export type TextStyle = {
  font?: FontRole | string; size?: number; weight?: number | string; italic?: boolean;
  color?: string | CanvasGradient; align?: CanvasTextAlign; baseline?: CanvasTextBaseline;
  /** letter spacing in em (Apple-like display text: about -0.02) */ tracking?: number;
  /** line height in em (default 1.25) */ lineHeight?: number;
  maxWidth?: number; maxLines?: number; alpha?: number; stretch?: CanvasFontStretch;
  /** fixed-width digits (timers, prices) */ tabular?: boolean;
};

export function setText(ctx: Ctx, st: TextStyle) {
  const size = st.size ?? 17;
  ctx.font = font(st.font ?? "ui", size, st.weight ?? 400, st.italic);
  ctx.letterSpacing = `${(st.tracking ?? 0) * size}px`;
  ctx.fontStretch = st.stretch ?? "normal";
  ctx.textAlign = st.align ?? "left";
  ctx.textBaseline = st.baseline ?? "alphabetic";
  ctx.fillStyle = st.color ?? "#000000";
}

export function measure(ctx: Ctx, str: string, st: TextStyle = {}) {
  ctx.save();
  setText(ctx, st);
  const w = tabularWidth(ctx, str, !!st.tabular);
  ctx.restore();
  return w;
}

/** Greedy word wrap with the context's current font. */
export function wrap(ctx: Ctx, str: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of str.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > maxWidth) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

const DIGIT = /[0-9]/;
const tabularWidth = (ctx: Ctx, s: string, tab: boolean) => {
  if (!tab) return ctx.measureText(s).width;
  const cell = ctx.measureText("0").width;
  let w = 0;
  for (const ch of s) w += DIGIT.test(ch) ? cell : ctx.measureText(ch).width;
  return w;
};

/** Text at (x, y) (baseline by default), wrapped to maxWidth, clipped to maxLines with an ellipsis. Returns the
 * block's width and height and the lines. */
export function text(ctx: Ctx, str: string, x: number, y: number, st: TextStyle = {}): { w: number; h: number; lines: string[] } {
  ctx.save();
  setText(ctx, st);
  if (st.alpha !== undefined) ctx.globalAlpha *= clamp(st.alpha);
  const size = st.size ?? 17, lh = (st.lineHeight ?? 1.25) * size;
  let lines = st.maxWidth ? wrap(ctx, str, st.maxWidth) : str.split("\n");
  if (st.maxLines && lines.length > st.maxLines) {
    lines = lines.slice(0, st.maxLines);
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > (st.maxWidth ?? Infinity)) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  let w = 0;
  lines.forEach((ln, i) => {
    const ly = y + i * lh;
    if (!st.tabular) {
      ctx.fillText(ln, x, ly);
      w = Math.max(w, ctx.measureText(ln).width);
      return;
    }
    const tw = tabularWidth(ctx, ln, true), cell = ctx.measureText("0").width;
    const al = ctx.textAlign;
    let cx = al === "center" ? x - tw / 2 : al === "right" || al === "end" ? x - tw : x;
    ctx.textAlign = "left";
    for (const ch of ln) {
      const cw = DIGIT.test(ch) ? cell : ctx.measureText(ch).width;
      const chw = ctx.measureText(ch).width;
      ctx.fillText(ch, cx + (cw - chw) / 2, ly);
      cx += cw;
    }
    ctx.textAlign = al;
    w = Math.max(w, tw);
  });
  ctx.restore();
  return { w, h: lines.length * lh, lines };
}

// ---- icons and the home screen ------------------------------------------------------------------------------

export type IconSpec = {
  bg: Fill; glyph?: GlyphName | GlyphFn; fg?: string; fg2?: string;
  badge?: number | string; label?: string; glyphScale?: number;
};
export type IconAnim = { scale?: number; alpha?: number; press?: number; shadow?: number };

/** Notification badge centred at (cx, cy). */
export function badge(ctx: Ctx, cx: number, cy: number, r: number, n: number | string, color = "#ff3b30") {
  const s = String(n);
  ctx.save();
  ctx.font = font("ui", r * 1.15, 600);
  const tw = ctx.measureText(s).width;
  const w = Math.max(2 * r, tw + r * 0.9);
  capsule(ctx, cx - w / 2, cy - r, w, 2 * r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(s, cx, cy + r * 1.15 * 0.36);
  ctx.restore();
}

/** An app icon centred at (cx, cy): continuous-corner tile (gradient or colour), glyph, badge, optional label. */
export function appIcon(ctx: Ctx, cx: number, cy: number, size: number, ic: IconSpec, o: IconAnim & { label?: boolean; labelColor?: string } = {}) {
  const s = size * (o.scale ?? 1) * (1 - 0.07 * (o.press ?? 0));
  if (s <= 0.05 || (o.alpha ?? 1) <= 0.002) return;
  const x = cx - s / 2, y = cy - s / 2;
  ctx.save();
  ctx.globalAlpha *= clamp(o.alpha ?? 1);
  if (o.shadow) setShadow(ctx, { blur: s * 0.18, y: s * 0.05, color: `rgba(0,0,0,${0.18 * o.shadow})` });
  squircle(ctx, x, y, s, s, s * 0.2237);
  ctx.fillStyle = fillOf(ctx, ic.bg, x, y, s, s);
  ctx.fill();
  noShadow(ctx);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = linear(ctx, 0, y, 0, y + s, [[0, "rgba(255,255,255,0.14)"], [0.45, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,0.05)"]]);
  ctx.fillRect(x, y, s, s);
  ctx.restore();
  if (ic.glyph) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const gs = ic.glyphScale ?? 1;
    if (gs !== 1) {
      ctx.translate(0.5, 0.5);
      ctx.scale(gs, gs);
      ctx.translate(-0.5, -0.5);
    }
    drawGlyph(ctx, ic.glyph, ic.fg ?? "#ffffff", ic.fg2 ?? "rgba(0,0,0,0.2)");
    ctx.restore();
  }
  if (ic.badge !== undefined && ic.badge !== 0 && ic.badge !== "") badge(ctx, x + s * 0.97, y + s * 0.035, s * 0.2, ic.badge);
  if (o.label && ic.label) text(ctx, ic.label, cx, y + s + 14.5, { size: 12, weight: 500, color: o.labelColor ?? "#ffffff", align: "center", maxWidth: s * 1.3, maxLines: 1 });
  ctx.restore();
}

/** Centre of home-screen slot i (4 columns at 95 pt; first row 123 pt below the screen top). */
export const gridSlot = (i: number): [number, number] => {
  const g = PHONE.grid, col = i % g.cols, row = Math.floor(i / g.cols);
  return [SCREEN_W / 2 + (col - (g.cols - 1) / 2) * g.pitch, g.firstRow + row * g.pitch];
};
export const DOCK = { x: 11, y: SCREEN_H - 107, w: SCREEN_W - 22, h: 96, r: 36 };

export type Blob = { x: number; y: number; r: number; color: string; alpha?: number };
/** Wallpapers: a colour, vertical stops, an angled gradient, and/or soft blobs (x, y in fractions of the screen,
 * r in fractions of its height). `drift` (pt) moves the blobs slowly with the frame. */
export type Wallpaper = string | Stops | { angle?: number; stops?: Stops; base?: string; blobs?: Blob[]; drift?: number };
export function wallpaper(ctx: Ctx, wp: Wallpaper, frame = 0, w = SCREEN_W, h = SCREEN_H) {
  ctx.save();
  if (typeof wp === "string" || Array.isArray(wp)) {
    ctx.fillStyle = typeof wp === "string" ? wp : linear(ctx, 0, 0, 0, h, wp);
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = wp.stops ? linearAngle(ctx, 0, 0, w, h, wp.angle ?? 180, wp.stops) : wp.base ?? "#ffffff";
    ctx.fillRect(0, 0, w, h);
    (wp.blobs ?? []).forEach((b, i) => {
      const d = wp.drift ?? 0;
      const bx = b.x * w + d * Math.sin(frame / 41 + i * 1.7), by = b.y * h + d * Math.cos(frame / 53 + i * 2.3);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r * h);
      const a = b.alpha ?? 1;
      for (let k = 0; k <= 6; k++) g.addColorStop(k / 6, rgba(b.color, a * (1 - k / 6) ** 1.8));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  ctx.restore();
}

/** Status bar: time left of the island, signal, wifi and battery right of it. */
export function statusBar(ctx: Ctx, o: { time?: string; color?: string; battery?: number } = {}) {
  const c = o.color ?? "#ffffff", w = SCREEN_W;
  text(ctx, o.time ?? "9:41", 69, 36.6, { size: 17, weight: 600, color: c, align: "center", tracking: -0.01 });
  ctx.save();
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  const bx = w - 107, by = 35.4;
  [4.2, 6.4, 8.6, 10.8].forEach((hh, i) => {
    ctx.beginPath();
    ctx.roundRect(bx + i * 4.7, by - hh, 3.2, hh, 1);
    ctx.fill();
  });
  const wx = w - 76.5, wy = 35.6;
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.arc(wx, wy, 3.2, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const r of [6.6, 10.2]) {
    ctx.beginPath();
    ctx.arc(wx, wy - 0.3, r, -Math.PI * 0.74, -Math.PI * 0.26);
    ctx.stroke();
  }
  const tx = w - 56.5, ty = 24.9;
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tx + 0.5, ty + 0.5, 24, 11.6, 3.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(tx + 26, ty + 4.2, 1.7, 4.2, 0.9);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.roundRect(tx + 2.5, ty + 2.5, 20 * clamp(o.battery ?? 0.82), 7.6, 2.2);
  ctx.fill();
  ctx.restore();
}

/** The app screens' home indicator bar. */
export const homeIndicator = (ctx: Ctx, color = "#000000") => {
  ctx.save();
  capsule(ctx, SCREEN_W / 2 - 72, SCREEN_H - 13, 144, 5.2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};

/** Copy what is already drawn under a rounded rect, blur it and lay it back with a tint: iOS materials. The current
 * transform must be a plain scale + translate (no rotation). */
let scratch: HTMLCanvasElement | null = null;
export function frost(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, o: { blur?: number; tint?: string; saturate?: number } = {}) {
  const m = ctx.getTransform(), k = m.a, blur = o.blur ?? 22, pad = blur * 2.2;
  const cv = ctx.canvas;
  const bx = Math.max(0, Math.floor((x - pad) * k + m.e)), by = Math.max(0, Math.floor((y - pad) * m.d + m.f));
  const bx1 = Math.min(cv.width, Math.ceil((x + w + pad) * k + m.e)), by1 = Math.min(cv.height, Math.ceil((y + h + pad) * m.d + m.f));
  const bw = bx1 - bx, bh = by1 - by;
  if (bw <= 0 || bh <= 0) return;
  scratch ??= document.createElement("canvas");
  if (scratch.width < bw || scratch.height < bh) {
    scratch.width = Math.max(scratch.width, bw);
    scratch.height = Math.max(scratch.height, bh);
  }
  const t = scratch.getContext("2d")!;
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.clearRect(0, 0, bw, bh);
  t.filter = `blur(${blur * k}px) saturate(${o.saturate ?? 1.7})`;
  t.drawImage(cv, bx, by, bw, bh, 0, 0, bw, bh);
  t.filter = "none";
  ctx.save();
  squircle(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scratch, 0, 0, bw, bh, bx, by, bw, bh);
  ctx.restore();
  ctx.save();
  squircle(ctx, x, y, w, h, r);
  ctx.fillStyle = o.tint ?? "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.restore();
}

export type HomeSpec = {
  wallpaper?: Wallpaper; icons?: (IconSpec | null)[]; dock?: (IconSpec | null)[];
  time?: string; statusColor?: string; labels?: boolean; labelColor?: string;
  /** page dots under the grid (count; the first is active) */ dots?: number;
  /** per-icon animation (dock icons are i = 100 + k) */ anim?: (i: number) => IconAnim;
  frame?: number;
};
/** A whole home screen: wallpaper, icon grid on the measured grid, page dots, frosted dock, status bar. */
export function homeScreen(ctx: Ctx, s: HomeSpec) {
  const f = s.frame ?? 0;
  wallpaper(ctx, s.wallpaper ?? ["#8fd3ff", "#4b7bff"], f);
  const size = PHONE.grid.icon;
  (s.icons ?? []).forEach((ic, i) => {
    if (!ic) return;
    const [x, y] = gridSlot(i);
    appIcon(ctx, x, y, size, ic, { shadow: 0.7, ...s.anim?.(i), label: s.labels, labelColor: s.labelColor });
  });
  if (s.dots) {
    const n = s.dots, gap = 9.5, y = DOCK.y - 18;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(SCREEN_W / 2 + (i - (n - 1) / 2) * gap, y, 3.3, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)";
      ctx.fill();
      ctx.restore();
    }
  }
  if (s.dock) {
    frost(ctx, DOCK.x, DOCK.y, DOCK.w, DOCK.h, DOCK.r, { blur: 26, tint: "rgba(255,255,255,0.22)" });
    s.dock.forEach((ic, k) => {
      if (!ic) return;
      const [x] = gridSlot(k);
      appIcon(ctx, x, DOCK.y + DOCK.h / 2, size, ic, { shadow: 0.5, ...s.anim?.(100 + k) });
    });
  }
  statusBar(ctx, { time: s.time, color: s.statusColor });
}

// ---- surfaces -----------------------------------------------------------------------------------------------

export type CardStyle = { r?: number; fill?: Fill; shadow?: Shadow | false; stroke?: string; frost?: { blur?: number; tint?: string } };
/** A rounded card (default white, 22 pt continuous corners, soft shadow). */
export function card(ctx: Ctx, x: number, y: number, w: number, h: number, o: CardStyle = {}) {
  const r = o.r ?? 22;
  if (o.frost) {
    if (o.shadow !== false) {
      ctx.save();
      setShadow(ctx, o.shadow || { blur: 30, y: 10, color: "rgba(0,0,0,0.12)" });
      squircle(ctx, x, y, w, h, r);
      ctx.fillStyle = "rgba(255,255,255,0.01)";
      ctx.fill();
      ctx.restore();
    }
    frost(ctx, x, y, w, h, r, o.frost);
  } else {
    ctx.save();
    if (o.shadow !== false) setShadow(ctx, o.shadow || { blur: 30, y: 10, color: "rgba(0,0,0,0.10)" });
    squircle(ctx, x, y, w, h, r);
    ctx.fillStyle = fillOf(ctx, o.fill ?? "#ffffff", x, y, w, h);
    ctx.fill();
    ctx.restore();
  }
  if (o.stroke) {
    ctx.save();
    squircle(ctx, x + 0.25, y + 0.25, w - 0.5, h - 0.5, r);
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }
}

export type NoteSpec = { icon: IconSpec; title: string; body: string; time?: string; dark?: boolean };
/** A notification banner (frosted, 24 pt corners) with its top at y; `appear` 0..1 slides it down from above the
 * screen. `size` scales its text, icon and padding at the same width (1 = iOS, 15 pt text; 1.3 for a 9:16 key
 * line, where 15 pt reads as about 25 px). Returns its height. */
export function notification(ctx: Ctx, x: number, y: number, w: number, n: NoteSpec, o: { appear?: number; size?: number } = {}) {
  const a = o.appear ?? 1, k = o.size ?? 1;
  const pad = 14 * k, ic = 38 * k, gap = 11 * k, fs = 15 * k, lh = 19.5 * k;
  ctx.save();
  setText(ctx, { size: fs, weight: 400 });
  const lines = Math.min(2, wrap(ctx, n.body, w - pad - ic - gap - pad).length);
  ctx.restore();
  const h = pad + Math.max(ic, 19 * k + lines * lh) + 13 * k, rr = Math.min(24 * k, h / 2);
  if (a <= 0.002) return h;
  ctx.save();
  ctx.translate(0, (1 - a) * -(y + h + 12));
  const sc = 0.94 + 0.06 * clamp(a);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(sc, sc);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.globalAlpha *= clamp(a * 1.6);
  const ink = n.dark ? "#ffffff" : "#000000";
  ctx.save();
  setShadow(ctx, { blur: 24 * k, y: 8 * k, color: "rgba(0,0,0,0.16)" });
  squircle(ctx, x, y, w, h, rr);
  ctx.fillStyle = "rgba(255,255,255,0.01)";
  ctx.fill();
  ctx.restore();
  frost(ctx, x, y, w, h, rr, { blur: 26, tint: n.dark ? "rgba(30,30,32,0.62)" : "rgba(246,246,248,0.74)" });
  appIcon(ctx, x + pad + ic / 2, y + h / 2, ic, { ...n.icon, badge: undefined });
  const tx = x + pad + ic + gap;
  text(ctx, n.title, tx, y + pad + fs, { size: fs, weight: 600, color: ink, maxWidth: w - (tx - x) - 60 * k, maxLines: 1 });
  if (n.time) text(ctx, n.time, x + w - pad, y + pad + fs, { size: 13 * k, color: n.dark ? "rgba(235,235,245,0.6)" : "rgba(60,60,67,0.6)", align: "right" });
  text(ctx, n.body, tx, y + pad + fs + lh, { size: fs, color: ink, maxWidth: w - (tx - x) - pad, maxLines: 2, lineHeight: 1.3 });
  ctx.restore();
  return h;
}

export type BubbleStyle = { side?: "in" | "out"; maxWidth?: number; fill?: Fill; color?: string; size?: number; tail?: boolean; appear?: number; font?: FontRole };
/** A chat bubble. `x` is its outer edge: the right edge for "out" (sent), the left edge for "in". Top at y.
 * `appear` 0..1+ pops it from the tail corner (feed it a spring). Returns its size. */
export function bubble(ctx: Ctx, x: number, y: number, str: string, o: BubbleStyle = {}) {
  const side = o.side ?? "in", size = o.size ?? 17, lh = size * 1.29, padX = 12.5, padY = 7.6;
  const maxW = o.maxWidth ?? 268;
  ctx.save();
  setText(ctx, { size, font: o.font });
  const lines = wrap(ctx, str, maxW - 2 * padX);
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  ctx.restore();
  const w = Math.ceil(tw + 2 * padX), h = lines.length * lh + 2 * padY;
  const a = o.appear ?? 1;
  if (a <= 0.002) return { w, h };
  const x0 = side === "out" ? x - w : x;
  const fill = o.fill ?? (side === "out" ? IOS.bubbleOut : IOS.bubbleIn);
  const ink = o.color ?? (side === "out" ? "#ffffff" : "#000000");
  const ox = side === "out" ? x : x0, oy = y + h;
  about(ctx, ox, oy, 0.55 + 0.45 * a, () => {
    ctx.beginPath();
    ctx.roundRect(x0, y, w, h, Math.min(18, h / 2));
    if (o.tail !== false) {
      if (side === "out") {
        ctx.moveTo(x - 9, y + h - 14);
        ctx.quadraticCurveTo(x - 1, y + h - 1.5, x + 5.5, y + h - 0.3);
        ctx.quadraticCurveTo(x - 6, y + h + 0.8, x - 16, y + h - 3.5);
        ctx.closePath();
      } else {
        // same winding as the body (clockwise), or the nonzero fill leaves a hole where the tail overlaps it
        ctx.moveTo(x0 + 16, y + h - 3.5);
        ctx.quadraticCurveTo(x0 + 6, y + h + 0.8, x0 - 5.5, y + h - 0.3);
        ctx.quadraticCurveTo(x0 + 1, y + h - 1.5, x0 + 9, y + h - 14);
        ctx.closePath();
      }
    }
    ctx.fillStyle = fillOf(ctx, fill, x0, y, w, h);
    ctx.fill("nonzero");
    lines.forEach((l, i) => text(ctx, l, x0 + padX, y + padY + size * 0.98 + i * lh, { size, color: ink, font: o.font }));
  }, clamp(a * 2.5));
  return { w, h };
}

/** Typing indicator: three dots in an incoming bubble, bouncing with the frame. */
export function typing(ctx: Ctx, x: number, y: number, frame: number, o: { fill?: string; dot?: string; appear?: number } = {}) {
  const w = 62, h = 38, a = o.appear ?? 1;
  about(ctx, x, y + h, 0.55 + 0.45 * a, () => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 19);
    ctx.fillStyle = o.fill ?? IOS.bubbleIn;
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const ph = (frame / 30) * Math.PI * 2 * 1.3 - i * 0.9;
      const k = 0.5 + 0.5 * Math.max(0, Math.sin(ph));
      ctx.beginPath();
      ctx.arc(x + 19 + i * 12, y + h / 2 - 2.5 * k, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = o.dot ?? `rgba(60,60,67,${0.3 + 0.35 * k})`;
      ctx.fill();
    }
  }, clamp(a * 2.5));
  return { w, h };
}

// ---- controls -----------------------------------------------------------------------------------------------

export type ButtonStyle = { fill?: Fill; color?: string; size?: number; weight?: number; r?: number; glyph?: GlyphName | GlyphFn; press?: number; font?: FontRole };
/** A button (capsule by default) with a label and an optional leading glyph. */
export function button(ctx: Ctx, x: number, y: number, w: number, h: number, label: string, o: ButtonStyle = {}) {
  const press = o.press ?? 0;
  about(ctx, x + w / 2, y + h / 2, 1 - 0.04 * press, () => {
    ctx.beginPath();
    if (o.r === undefined) ctx.roundRect(x, y, w, h, h / 2);
    else squirclePath(ctx, x, y, w, h, o.r);
    ctx.fillStyle = fillOf(ctx, o.fill ?? IOS.blue, x, y, w, h);
    ctx.fill();
    const size = o.size ?? 17, ink = o.color ?? "#ffffff";
    const tw = measure(ctx, label, { size, weight: o.weight ?? 600, font: o.font });
    const gw = o.glyph ? size * 1.25 + 6 : 0;
    const x0 = x + w / 2 - (tw + gw) / 2;
    if (o.glyph) glyph(ctx, o.glyph, x0 + size * 0.62, y + h / 2, size * 1.25, ink);
    text(ctx, label, x0 + gw, y + h / 2 + size * 0.36, { size, weight: o.weight ?? 600, color: ink, font: o.font });
  }, 1 - 0.15 * press);
}

/** A chip (capsule tag). x, y = top-left; returns its width. */
export function chip(ctx: Ctx, x: number, y: number, label: string, o: { fill?: Fill; color?: string; stroke?: string; glyph?: GlyphName | GlyphFn; size?: number; h?: number; appear?: number } = {}) {
  const size = o.size ?? 15, h = o.h ?? 32, gw = o.glyph ? size + 5 : 0;
  const w = measure(ctx, label, { size, weight: 500 }) + 28 + gw;
  const a = o.appear ?? 1;
  about(ctx, x + w / 2, y + h / 2, 0.6 + 0.4 * a, () => {
    capsule(ctx, x, y, w, h);
    ctx.fillStyle = fillOf(ctx, o.fill ?? IOS.fill, x, y, w, h);
    ctx.fill();
    if (o.stroke) {
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const ink = o.color ?? "#000000";
    if (o.glyph) glyph(ctx, o.glyph, x + 14 + size / 2, y + h / 2, size * 1.1, ink);
    text(ctx, label, x + 14 + gw, y + h / 2 + size * 0.36, { size, weight: 500, color: ink });
  }, clamp(a * 2));
  return w;
}

/** iOS-style switch (51 x 31) at top-left (x, y); on 0..1 animates the knob and the track colour. */
export function toggle(ctx: Ctx, x: number, y: number, on: number, o: { color?: string; off?: string } = {}) {
  const t = clamp(on);
  ctx.save();
  capsule(ctx, x, y, 51, 31);
  ctx.fillStyle = o.off ?? "rgba(120,120,128,0.16)";
  ctx.fill();
  ctx.globalAlpha = t;
  ctx.fillStyle = o.color ?? IOS.green;
  ctx.fill();
  ctx.globalAlpha = 1;
  setShadow(ctx, { blur: 8, y: 3, color: "rgba(0,0,0,0.15)" });
  ctx.beginPath();
  ctx.arc(x + 15.5 + 20 * t, y + 15.5, 13.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

/** Progress ring centred at (cx, cy): value 0..1 from 12 o'clock, round caps; color may be [from, to]. */
export function ring(ctx: Ctx, cx: number, cy: number, r: number, value: number, o: { width?: number; color?: string | [string, string]; track?: string } = {}) {
  const w = o.width ?? r * 0.22, v = clamp(value);
  ctx.save();
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = o.track ?? "rgba(120,120,128,0.16)";
  ctx.stroke();
  if (v > 0.001) {
    const col = o.color ?? IOS.blue;
    ctx.strokeStyle = Array.isArray(col) ? linear(ctx, cx - r, cy - r, cx + r, cy + r, col) : col;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Horizontal progress bar (capsule). */
export function progressBar(ctx: Ctx, x: number, y: number, w: number, h: number, value: number, o: { color?: Fill; track?: string } = {}) {
  ctx.save();
  capsule(ctx, x, y, w, h);
  ctx.fillStyle = o.track ?? "rgba(120,120,128,0.16)";
  ctx.fill();
  const v = clamp(value);
  if (v > 0.001) {
    capsule(ctx, x, y, Math.max(h, w * v), h);
    ctx.fillStyle = fillOf(ctx, o.color ?? IOS.blue, x, y, w, h, 90);
    ctx.fill();
  }
  ctx.restore();
}

/** Bar chart in a box: values 0..1; grow 0..1 (or per bar) raises them; one bar may be highlighted. */
export function bars(ctx: Ctx, x: number, y: number, w: number, h: number, values: number[], o: { color?: Fill; track?: string; gap?: number; r?: number; grow?: number | ((i: number) => number); highlight?: number; highlightColor?: Fill } = {}) {
  const n = values.length, gap = o.gap ?? 0.38;
  const bw = w / (n + (n - 1) * gap), r = o.r ?? bw / 2;
  ctx.save();
  values.forEach((v, i) => {
    const bx = x + i * bw * (1 + gap);
    if (o.track) {
      ctx.beginPath();
      ctx.roundRect(bx, y, bw, h, r);
      ctx.fillStyle = o.track;
      ctx.fill();
    }
    const g = typeof o.grow === "function" ? o.grow(i) : o.grow ?? 1;
    const bh = Math.max(0, h * clamp(v) * g);
    if (bh < 0.3) return;
    ctx.beginPath();
    ctx.roundRect(bx, y + h - bh, bw, bh, Math.min(r, bh / 2));
    ctx.fillStyle = fillOf(ctx, i === o.highlight ? o.highlightColor ?? IOS.orange : o.color ?? IOS.blue, bx, y, bw, h);
    ctx.fill();
  });
  ctx.restore();
}

/** Smooth line chart in a box; progress 0..1 draws it from the left (with a dot at the tip); fill = area tint. */
export function sparkline(ctx: Ctx, x: number, y: number, w: number, h: number, values: number[], o: { color?: string; width?: number; fill?: boolean | string; progress?: number; dot?: boolean; min?: number; max?: number } = {}) {
  const lo = o.min ?? Math.min(...values), hi = o.max ?? Math.max(...values);
  const pts = values.map((v, i) => [x + (i / (values.length - 1)) * w, y + h - ((v - lo) / (hi - lo || 1)) * h] as [number, number]);
  const p = clamp(o.progress ?? 1);
  if (p <= 0.001) return;
  const col = o.color ?? IOS.blue;
  const line = new Path2D();
  line.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    line.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 10, y - 10, w * p + 10, h + 20);
  ctx.clip();
  if (o.fill) {
    const area = new Path2D(line);
    area.lineTo(x + w, y + h);
    area.lineTo(x, y + h);
    area.closePath();
    ctx.fillStyle = typeof o.fill === "string" ? o.fill : linear(ctx, 0, y, 0, y + h, [rgba(col, 0.22), rgba(col, 0)]);
    ctx.fill(area);
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = o.width ?? 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(line);
  ctx.restore();
  if (o.dot !== false) {
    const fx = p * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(fx)), u = fx - i;
    const dx = lerp(pts[i][0], pts[i + 1][0], u), dy = lerp(pts[i][1], pts[i + 1][1], u);
    ctx.save();
    ctx.beginPath();
    ctx.arc(dx, dy, (o.width ?? 3) * 1.7, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = (o.width ?? 3) * 0.9;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.restore();
  }
}

/** Avatar: a gradient disc with initials or a simple person; optional ring and status dot. */
export function avatar(ctx: Ctx, cx: number, cy: number, r: number, o: { colors?: [string, string]; initials?: string; person?: boolean; ring?: string; status?: string; appear?: number } = {}) {
  const a = o.appear ?? 1;
  about(ctx, cx, cy, a, () => {
    const [c1, c2] = o.colors ?? ["#a5b4fc", "#6366f1"];
    if (o.ring) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3.2, 0, Math.PI * 2);
      ctx.strokeStyle = o.ring;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = linear(ctx, cx - r, cy - r, cx + r, cy + r, [c1, c2]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (o.person || !o.initials) {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.16, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.86, r * 0.66, r * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      text(ctx, o.initials, cx, cy + r * 0.3, { size: r * 0.84, weight: 700, color: "#ffffff", align: "center", font: "rounded" });
    }
    ctx.restore();
    if (o.status) {
      ctx.beginPath();
      ctx.arc(cx + r * 0.72, cy + r * 0.72, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = o.status;
      ctx.fill();
      ctx.lineWidth = r * 0.12;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }, clamp(a * 2));
}

/** Large-title header under the status bar (y = baseline, default 102) with an optional trailing glyph button. */
export function header(ctx: Ctx, title: string, o: { y?: number; color?: string; sub?: string; trailing?: GlyphName; accent?: string } = {}) {
  const y = o.y ?? 102;
  if (o.sub) text(ctx, o.sub, 20, y - 38, { size: 13, weight: 600, color: "rgba(60,60,67,0.6)", tracking: 0.04 });
  text(ctx, title, 20, y, { size: 34, weight: 700, color: o.color ?? "#000000", tracking: -0.015 });
  if (o.trailing) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(SCREEN_W - 38, y - 12, 18, 0, Math.PI * 2);
    ctx.fillStyle = IOS.fill;
    ctx.fill();
    ctx.restore();
    glyph(ctx, o.trailing, SCREEN_W - 38, y - 12, 26, o.accent ?? IOS.blue);
  }
}

/** A list row (inset grouped style) with its top at y: icon tile, title, subtitle, trailing value or switch. */
export function listRow(ctx: Ctx, x: number, y: number, w: number, o: { icon?: IconSpec; title: string; sub?: string; value?: string; toggle?: number; chevron?: boolean; h?: number }) {
  const h = o.h ?? (o.sub ? 62 : 48);
  let tx = x + 16;
  if (o.icon) {
    appIcon(ctx, x + 16 + 15, y + h / 2, 30, o.icon);
    tx += 30 + 12;
  }
  if (o.sub) {
    text(ctx, o.title, tx, y + h / 2 - 3, { size: 17, color: "#000000" });
    text(ctx, o.sub, tx, y + h / 2 + 16, { size: 13.5, color: "rgba(60,60,67,0.6)" });
  } else text(ctx, o.title, tx, y + h / 2 + 6, { size: 17, color: "#000000" });
  if (o.toggle !== undefined) toggle(ctx, x + w - 16 - 51, y + h / 2 - 15.5, o.toggle);
  else if (o.value) text(ctx, o.value, x + w - (o.chevron ? 34 : 16), y + h / 2 + 6, { size: 17, color: "rgba(60,60,67,0.6)", align: "right" });
  if (o.chevron) {
    ctx.save();
    ctx.strokeStyle = "rgba(60,60,67,0.3)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + w - 22, y + h / 2 - 6);
    ctx.lineTo(x + w - 16, y + h / 2);
    ctx.lineTo(x + w - 22, y + h / 2 + 6);
    ctx.stroke();
    ctx.restore();
  }
  return h;
}

/** Bottom tab bar (frosted) with glyph + label items; `active` index tinted. */
export function tabBar(ctx: Ctx, items: { glyph: GlyphName | GlyphFn; label: string }[], active = 0, o: { accent?: string } = {}) {
  const h = 84, y = SCREEN_H - h;
  frost(ctx, 0, y, SCREEN_W, h + 40, 0, { blur: 24, tint: "rgba(250,250,252,0.82)" });
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, y, SCREEN_W, 0.5);
  ctx.restore();
  const n = items.length;
  items.forEach((it, i) => {
    const cx = (SCREEN_W / n) * (i + 0.5), col = i === active ? o.accent ?? IOS.blue : "#999999";
    glyph(ctx, it.glyph, cx, y + 22, 30, col);
    text(ctx, it.label, cx, y + 49, { size: 10.5, weight: 500, color: col, align: "center" });
  });
}
