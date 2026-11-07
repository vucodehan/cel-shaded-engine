/**
 * Dynamic Island states and morphs, in screen points (draw them in a phone's island callback). Sizes are the
 * reference's (videoclone.md 10.6); morphs use the springs fitted to it: opening, the width leads (SPRING.islandW)
 * and the height follows about 4 frames later (SPRING.islandH); closing is quick (SPRING.islandClose). A soft
 * shadow lives only while the pill is open.
 */
import { clamp, lerp, spr, SPRING } from "./ease";
import { SCREEN_W, ScreenDraw } from "./geometry";
import { drawMascot, MascotPose } from "./character";
import { capsule, devScale, text } from "./ui";

export type PillBox = { w: number; h: number; top: number; dx?: number; r?: number };
export const ISLAND = {
  /** the resting pill */
  rest: { w: 127.8, h: 37.2, top: 11.4, dx: 0 },
  /** compact live activity: content left and right of the camera; off-centre, its right end further out */
  compact: { w: 222.1, h: 39.3, top: 7.1, dx: 6.1 },
  /** expanded (a call): 383 x 90, 7 pt below the screen top */
  expanded: { w: 383.1, h: 90.3, top: 7.0, dx: 0 },
  /** a taller expanded activity (two rows of content) */
  tall: { w: 383.1, h: 168, top: 7.0, dx: 0, r: 46 },
} satisfies Record<string, PillBox>;
export type IslandMode = keyof typeof ISLAND;
export type IslandKey = { f: number; mode: IslandMode | PillBox };

export type IslandState = {
  x0: number; y0: number; x1: number; y1: number; w: number; h: number; cx: number; cy: number; r: number;
  /** mode it is in (or morphing to), the one before, frames since that key, and the key's frame */
  mode: string; from: string; since: number; at: number;
  /** 0..1 progress of the current morph (by width) */ t: number;
  /** 0..1 how open: the height between rest and expanded */ open: number;
  shadow: number;
};

type G = { w: number; h: number; top: number; dx: number; r: number };
const geomOf = (m: IslandMode | PillBox): G => {
  const b: PillBox = typeof m === "string" ? ISLAND[m] : m;
  return { w: b.w, h: b.h, top: b.top, dx: b.dx ?? 0, r: b.r ?? b.h / 2 };
};
const nameOf = (m: IslandMode | PillBox) => (typeof m === "string" ? m : "custom");

function geomAt(frame: number, keys: IslandKey[], fps: number): { g: G; t: number; i: number } {
  let i = -1;
  for (let k = 0; k < keys.length; k++) if (keys[k].f <= frame) i = k;
  if (i < 0) return { g: geomOf(keys[0]?.mode ?? "rest"), t: 1, i: 0 };
  const target = geomOf(keys[i].mode);
  if (i === 0) return { g: target, t: 1, i };
  const start = geomAt(keys[i].f, keys.slice(0, i), fps).g;
  const f0 = keys[i].f;
  let pw: number, ph: number;
  if (target.h > start.h + 0.5 || target.w > start.w + 0.5) {
    pw = spr(frame, f0 + 0.5, SPRING.islandW, fps);
    ph = spr(frame, f0 + 0.5 + 4 * clamp((target.h - start.h) / 53), SPRING.islandH, fps);
  } else {
    pw = ph = spr(frame, f0 + 0.5, SPRING.islandClose, fps);
  }
  const h = lerp(start.h, target.h, ph), w = lerp(start.w, target.w, pw);
  return {
    g: { w, h, top: lerp(start.top, target.top, ph), dx: lerp(start.dx, target.dx, pw), r: Math.min(lerp(start.r, target.r, ph), h / 2, w / 2) },
    t: clamp(pw),
    i,
  };
}

/** The island's geometry at a frame for keys like [{ f: 0, mode: "rest" }, { f: 100, mode: "expanded" }, ...]. */
export function islandAt(frame: number, keys: IslandKey[], fps = 30): IslandState {
  const { g, t, i } = geomAt(frame, keys, fps);
  const key = keys[i] ?? { f: 0, mode: "rest" as const };
  const x0 = SCREEN_W / 2 + g.dx - g.w / 2, y0 = g.top;
  const open = clamp((g.h - 40) / 50.3);
  return {
    x0, y0, x1: x0 + g.w, y1: y0 + g.h, w: g.w, h: g.h, cx: x0 + g.w / 2, cy: y0 + g.h / 2, r: g.r,
    mode: nameOf(key.mode), from: i > 0 ? nameOf(keys[i - 1].mode) : nameOf(key.mode), since: frame - key.f, at: key.f,
    t, open, shadow: 0.38 * open,
  };
}

/** Draw the pill (with its shadow) and, clipped inside it, the content. */
export function drawIsland(ctx: CanvasRenderingContext2D, g: IslandState, content?: (ctx: CanvasRenderingContext2D, g: IslandState) => void, o: { color?: string; shadow?: boolean } = {}) {
  if (o.shadow !== false && g.shadow > 0.002) {
    ctx.save();
    ctx.filter = `blur(${6.4 * devScale(ctx)}px)`;
    ctx.fillStyle = `rgba(0,0,0,${g.shadow})`;
    ctx.beginPath();
    ctx.roundRect(g.x0 - 2, g.y0 - 2 + 1.2, g.w + 4, g.h + 4, g.r + 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(g.x0, g.y0, g.w, g.h, g.r);
  ctx.fillStyle = o.color ?? "#010101";
  ctx.fill();
  if (content) {
    ctx.clip();
    content(ctx, g);
  }
  ctx.restore();
}

/** The default island layer: the resting pill. */
export const restIsland: ScreenDraw = (ctx) => drawIsland(ctx, islandAt(0, [{ f: 0, mode: "rest" }]));

/** An island callback for a phone from keys and an optional content drawer. */
export const islandTrack = (keys: IslandKey[], content?: (ctx: CanvasRenderingContext2D, g: IslandState, frame: number) => void): ScreenDraw =>
  (ctx, s) => drawIsland(ctx, islandAt(s.frame, keys, s.fps), content ? (c, g) => content(c, g, s.frame) : undefined);

export type CallSpec = {
  /** shown first under the timer, then replaced by `name` at nameAt frames after the call opens */
  status?: string; name: string; nameAt?: number;
  /** frame the call starts (for the default timer) */ start?: number;
  timer?: (frame: number) => string;
  /** the caller in the pill's left end; default: the mascot dropping in */ avatar?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, since: number) => void;
  mascot?: Partial<MascotPose>;
  /** grey text (timer, status), the compact timer's colour, button colours */
  textColor?: string; compactColor?: string; endColor?: string; micColor?: string; fps?: number;
};

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** A mascot avatar for the island: drops in from above the pill (clipped by it) and settles at its spot. */
export const mascotAvatar = (pose: Partial<MascotPose> = {}, dropAt = 10) => (ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, since: number) => {
  const d = spr(since, dropAt, SPRING.pop);
  drawMascot(ctx, { shape: "stadium", color: "#7457ff", ...pose, x: cx, y: cy - (1 - d) * h * 2.2, size: h * (pose.size ?? 1), rot: (pose.rot ?? 0) + (1 - clamp(d)) * -25 });
};

/**
 * Live call content, measured layout: caller at the left end, timer and status, mute and end buttons (expanded);
 * caller left and timer right (compact). Arrivals follow the reference: end button from 5 to 15 frames after the
 * open key, text from 9 at 71 % scale, mute button rising from 11; on collapse the text goes in 2 frames and the
 * compact content fades in over 3-8 frames from 122 % scale.
 */
export const callContent = (c: CallSpec) => (ctx: CanvasRenderingContext2D, g: IslandState, frame: number) => {
  const fps = c.fps ?? 30, grey = c.textColor ?? "#8a8a8e";
  const timer = c.timer ? c.timer(frame) : fmtTime(Math.max(0, frame - (c.start ?? 0)) / fps);
  const avatar = c.avatar ?? mascotAvatar(c.mascot);
  const s = g.since, sy = g.h / 90.3;
  const open = g.mode === "expanded" || g.mode === "tall";
  const fromOpen = g.from === "expanded" || g.from === "tall";
  // weights: buttons and text of the open call, the compact timer, the caller (k: 1 at its open spot, 0 compact)
  const btn = open ? 1 : fromOpen ? 1 - clamp(s / 4) : 0;
  const txt = open ? clamp((s - 9) / 3) : fromOpen ? 1 - clamp(s / 2) : 0;
  const cmp = g.mode === "compact" ? (fromOpen ? clamp((s - 3) / 5) : clamp(s / 5)) : g.from === "compact" ? 1 - clamp(s / 3) : 0;
  const k = open ? (g.from === "compact" ? clamp(s / 8) : 1) : fromOpen ? 1 - clamp(s / 6) : 0;
  const who = open || g.mode === "compact" ? 1 : g.from === "compact" || fromOpen ? 1 - clamp(s / 4) : 0;

  if (btn > 0.005) {
    const er = 25.85 * (open ? clamp(spr(s, 5, SPRING.snappy)) : btn), ex = g.x1 - 44.5, ey = g.y0 + 45.2 * sy;
    if (er > 0.2) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fillStyle = c.endColor ?? "#ff4447";
      ctx.fill();
      const d = er * 0.27;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = er * 0.115;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ex - d, ey - d);
      ctx.lineTo(ex + d, ey + d);
      ctx.moveTo(ex - d, ey + d);
      ctx.lineTo(ex + d, ey - d);
      ctx.stroke();
      ctx.restore();
    }
    const mu = open ? clamp(spr(s, 11, SPRING.soft)) : 1;
    const mx = g.x1 - 108.2, my = g.y0 + 45.3 * sy + (1 - mu) * 34, mr = 25.8 * (0.7 + 0.3 * mu) * btn;
    if (mu > 0.01 && mr > 0.2) {
      const q = mr / 25.8;
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = c.micColor ?? "#343434";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(mx - 3.9 * q, my - 10.8 * q, 7.8 * q, 14.6 * q, 3.9 * q);
      ctx.fill();
      ctx.lineWidth = 2.12 * q;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(mx, my - 0.2 * q, 6.7 * q, -0.24, Math.PI + 0.24);
      ctx.moveTo(mx, my + 6.5 * q);
      ctx.lineTo(mx, my + 10.7 * q);
      ctx.moveTo(mx - 4.8 * q, my + 10.7 * q);
      ctx.lineTo(mx + 4.8 * q, my + 10.7 * q);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (txt > 0.005) {
    const ts = open ? 0.71 + 0.29 * clamp(spr(s, 9, SPRING.soft)) : 1;
    const nameAt = c.nameAt ?? 28, named = !c.status || frame - (c.start ?? g.at) >= nameAt;
    ctx.save();
    ctx.globalAlpha *= txt;
    ctx.translate(g.x0 + 98.6, g.y0 + 27.3 * sy);
    ctx.scale(ts, ts);
    text(ctx, timer, 0, 13.5, { size: 18.6, weight: 500, color: grey, tabular: true });
    if (!named) text(ctx, c.status!, 0, 35, { size: 18.2, color: grey });
    else text(ctx, c.name, 0, 35, { size: 18.2, weight: 500, color: "#ffffff", alpha: c.status ? clamp((frame - (c.start ?? g.at) - nameAt) / 5) : 1 });
    ctx.restore();
  }
  if (who > 0.005) {
    ctx.save();
    ctx.globalAlpha *= who;
    const ax = lerp(g.x0 + 29.7, g.x0 + 48.9, k), ay = lerp(g.cy, g.y0 + 41.2 * sy, k), ah = lerp(20, 35.8 * Math.min(1, sy * 1.15), k);
    avatar(ctx, ax, ay, ah, open && g.from !== "compact" ? s : 999);
    ctx.restore();
  }
  if (cmp > 0.005) {
    const sc = g.mode === "compact" && fromOpen ? 1.22 - 0.22 * cmp : 1;
    ctx.save();
    ctx.globalAlpha *= cmp;
    ctx.translate(g.x1 - 19.7, g.cy);
    ctx.scale(sc, sc);
    text(ctx, timer, 0, 4.6, { size: 12.7, weight: 600, color: c.compactColor ?? grey, align: "right", tabular: true });
    ctx.restore();
  }
};

/** A plain compact activity: a glyph or dot on the left, short text on the right. */
export const compactContent = (o: { left?: (ctx: CanvasRenderingContext2D, x: number, y: number) => void; right?: string; color?: string }) =>
  (ctx: CanvasRenderingContext2D, g: IslandState) => {
    const a = clamp(g.since / 5);
    ctx.save();
    ctx.globalAlpha *= a;
    if (o.left) o.left(ctx, g.x0 + 24, g.cy);
    else {
      capsule(ctx, g.x0 + 14, g.cy - 7, 14, 14);
      ctx.fillStyle = o.color ?? "#34c759";
      ctx.fill();
    }
    if (o.right) text(ctx, o.right, g.x1 - 18, g.cy + 4.6, { size: 12.7, weight: 600, color: o.color ?? "#34c759", align: "right" });
    ctx.restore();
  };
