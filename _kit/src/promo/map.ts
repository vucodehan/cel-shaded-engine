/**
 * A stylised flat map in any box (screen points in a phone, or px in a 2D layer): rounded city blocks with streets
 * between them, avenues, a park, a river, a route that draws on, pins that pop, a "you are here" dot. Seeded and
 * deterministic. Map points (u, v) run 0..1 across the box's longer side, (0.5, 0.5) at its centre at zoom 1;
 * mapNode(spec, i, j) is a street crossing, so a route through nodes follows the streets.
 */
import { rgba } from "./color";
import { clamp, rng, spr, SPRING } from "./ease";
import { font } from "./fonts";
import { glyph, GlyphName } from "./glyphs";
import { capsule, noShadow, setShadow, squircle, text } from "./ui";

type Ctx = CanvasRenderingContext2D;
export type MapTheme = { land: string; block: string; block2: string; park: string; tree: string; water: string; bank: string; major: string; route: string; casing: string; label: string };
export const MAP_THEMES = {
  light: { land: "#fbfaf7", block: "#eeebe4", block2: "#e7e3da", park: "#d4eed2", tree: "#c0e2bd", water: "#c6e3f7", bank: "#fbfaf7", major: "#fbe9b7", route: "#2f7bff", casing: "#ffffff", label: "#1c1c1e" },
  dark: { land: "#2b2d33", block: "#1e2025", block2: "#23262c", park: "#1e3327", tree: "#244031", water: "#1a2c40", bank: "#2b2d33", major: "#4b4535", route: "#4d9cff", casing: "#0d0e11", label: "#f2f2f7" },
} satisfies Record<string, MapTheme>;

export type MapPin = { at: [number, number]; color?: string; glyph?: GlyphName; pop?: number; label?: string };
export type MapSpec = {
  seed?: number; theme?: keyof typeof MAP_THEMES | Partial<MapTheme>;
  zoom?: number; center?: [number, number];
  /** street grid rotation (deg) and spacing (map units) */ angle?: number; pitch?: number;
  /** route through map points, drawn up to `progress` of its length */ route?: [number, number][]; progress?: number; routeWidth?: number;
  pins?: MapPin[];
  /** "you are here"; pulse = halo phase (frames / 30 works); meColor (hex; default the route colour) */ me?: [number, number]; pulse?: number; meColor?: string;
  park?: boolean; water?: boolean;
  /** corner radius of the box */ r?: number;
};

type Grid = { xs: number[]; ys: number[]; wx: number[]; wy: number[]; k0: number; rnd: number[] };
const grids = new Map<string, Grid>();
const K0 = 14, KN = 44;
function gridOf(seed: number, pitch: number): Grid {
  const key = `${seed}|${pitch}`;
  const hit = grids.get(key);
  if (hit) return hit;
  const r = rng(seed * 7919 + 17);
  const xs: number[] = [], ys: number[] = [], wx: number[] = [], wy: number[] = [];
  for (let k = 0; k < KN; k++) {
    const i = k - K0;
    xs.push(i * pitch + (r() - 0.5) * pitch * 0.3);
    ys.push(i * pitch * 0.92 + (r() - 0.5) * pitch * 0.3);
    wx.push(i % 4 === 0 ? 0.026 : 0.012);
    wy.push(i % 3 === 0 ? 0.024 : 0.012);
  }
  const rnd = Array.from({ length: KN * KN }, () => r());
  const g = { xs, ys, wx, wy, k0: K0, rnd };
  grids.set(key, g);
  return g;
}

const themeOf = (t: MapSpec["theme"]): MapTheme => (typeof t === "string" ? MAP_THEMES[t] : { ...MAP_THEMES.light, ...(t ?? {}) });
const rot = (u: number, v: number, a: number): [number, number] => {
  const c = Math.cos(a), s = Math.sin(a), du = u - 0.5, dv = v - 0.5;
  return [0.5 + du * c - dv * s, 0.5 + du * s + dv * c];
};

/** Map point of street crossing (i, j) (0, 0 near the map's top-left; larger i to the right, j down). */
export function mapNode(m: MapSpec, i: number, j: number): [number, number] {
  const g = gridOf(m.seed ?? 1, m.pitch ?? 0.11);
  const a = ((m.angle ?? 12) * Math.PI) / 180;
  return rot(g.xs[i + g.k0], g.ys[j + g.k0], a);
}

/** Route through street crossings, going along i first then j between consecutive nodes ("L" turns). */
export const mapRoute = (m: MapSpec, nodes: [number, number][]) => {
  const out: [number, number][] = [];
  nodes.forEach(([i, j], n) => {
    if (n > 0) {
      const [pi] = nodes[n - 1];
      if (pi !== i) out.push(mapNode(m, i, nodes[n - 1][1]));
    }
    out.push(mapNode(m, i, j));
  });
  return out;
};

export type MapBox = { x: number; y: number; w: number; h: number };
/** Where map point (u, v) lands in a map drawn by flatMap(ctx, box.x, box.y, box.w, box.h, spec) (px or pt). */
export function mapToBox(m: MapSpec, box: MapBox, u: number, v: number): [number, number] {
  const S = Math.max(box.w, box.h) * (m.zoom ?? 1), [cu, cv] = m.center ?? [0.5, 0.5];
  return [box.x + box.w / 2 + (u - cu) * S, box.y + box.h / 2 + (v - cv) * S];
}

/** The head of the route as flatMap draws it at `progress` (by length in box units): box point, heading (deg, 0 =
 * right, y down), drawn and total length. Put a marker or the mascot on it. */
export function routeAt(m: MapSpec, box: MapBox, progress = m.progress ?? 1) {
  const pts = (m.route ?? []).map(([u, v]) => mapToBox(m, box, u, v));
  if (pts.length < 2) return { x: pts[0]?.[0] ?? 0, y: pts[0]?.[1] ?? 0, angle: 0, length: 0, total: 0 };
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((s, l) => s + l, 0);
  let left = total * clamp(progress), i = 0;
  while (i < seg.length - 1 && left > seg[i]) left -= seg[i++];
  const u = seg[i] > 0 ? Math.min(1, left / seg[i]) : 0, [ax, ay] = pts[i], [bx, by] = pts[i + 1];
  return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI, length: total * clamp(progress), total };
}

/** Street crossings (i, j) inside the box (inset by `margin`) with their box positions: route nodes on screen. */
export function visibleNodes(m: MapSpec, box: MapBox, margin = 0) {
  const out: { i: number; j: number; x: number; y: number }[] = [];
  for (let i = -K0; i < KN - K0; i++)
    for (let j = -K0; j < KN - K0; j++) {
      const [x, y] = mapToBox(m, box, ...mapNode(m, i, j));
      if (x >= box.x + margin && x <= box.x + box.w - margin && y >= box.y + margin && y <= box.y + box.h - margin) out.push({ i, j, x, y });
    }
  return out;
}

/** Draw the map in the box (x, y, w, h). */
export function flatMap(ctx: Ctx, x: number, y: number, w: number, h: number, m: MapSpec = {}) {
  const T = themeOf(m.theme), g = gridOf(m.seed ?? 1, m.pitch ?? 0.11);
  const zoom = m.zoom ?? 1, [cu, cv] = m.center ?? [0.5, 0.5];
  const S = Math.max(w, h) * zoom, a = ((m.angle ?? 12) * Math.PI) / 180;
  const toBox = (u: number, v: number): [number, number] => mapToBox(m, { x, y, w, h }, u, v);
  ctx.save();
  squircle(ctx, x, y, w, h, m.r ?? 0);
  ctx.clip();
  ctx.fillStyle = T.land;
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(S, S);
  ctx.translate(-cu + 0.5, -cv + 0.5);
  ctx.rotate(a);
  ctx.translate(-0.5, -0.5);
  // visible cells only: the box in grid space, generously
  const half = Math.hypot(w, h) / S / 2 + 0.1;
  const [gu, gv] = rot(cu, cv, -a);
  const parkCell = m.park === false ? -1 : Math.floor(g.rnd[3] * 3) + 1;
  for (let i = 0; i < KN - 1; i++) {
    const x0 = g.xs[i] + g.wx[i] / 2, x1 = g.xs[i + 1] - g.wx[i + 1] / 2;
    if (x1 < gu - half || x0 > gu + half) continue;
    for (let j = 0; j < KN - 1; j++) {
      const y0 = g.ys[j] + g.wy[j] / 2, y1 = g.ys[j + 1] - g.wy[j + 1] / 2;
      if (y1 < gv - half || y0 > gv + half) continue;
      const rv = g.rnd[i * KN + j];
      const ci = i - g.k0, cj = j - g.k0;
      if (ci === parkCell && (cj === 2 || cj === 3)) {
        if (cj === 2) {
          const py1 = g.ys[j + 2] - g.wy[j + 2] / 2;
          squircle(ctx, x0, y0, x1 - x0, py1 - y0, 0.012);
          ctx.fillStyle = T.park;
          ctx.fill();
          ctx.fillStyle = T.tree;
          const tr = rng(i * 31 + j);
          for (let t = 0; t < 14; t++) {
            ctx.beginPath();
            ctx.arc(x0 + 0.01 + tr() * (x1 - x0 - 0.02), y0 + 0.01 + tr() * (py1 - y0 - 0.02), 0.004 + tr() * 0.004, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        continue;
      }
      ctx.fillStyle = rv < 0.5 ? T.block : T.block2;
      if (rv > 0.72 && x1 - x0 > 0.05) {
        const mid = x0 + (x1 - x0) * (0.4 + rv * 0.2);
        squircle(ctx, x0, y0, mid - x0 - 0.003, y1 - y0, 0.008);
        ctx.fill();
        ctx.fillStyle = rv < 0.86 ? T.block : T.block2;
        squircle(ctx, mid + 0.003, y0, x1 - mid - 0.003, y1 - y0, 0.008);
        ctx.fill();
      } else {
        squircle(ctx, x0, y0, x1 - x0, y1 - y0, 0.009);
        ctx.fill();
      }
    }
  }
  // avenues get a warm centre line
  ctx.strokeStyle = T.major;
  ctx.lineCap = "round";
  for (let k = 0; k < KN; k++) {
    if (g.wx[k] > 0.02) {
      ctx.lineWidth = g.wx[k] * 0.55;
      ctx.beginPath();
      ctx.moveTo(g.xs[k], gv - half);
      ctx.lineTo(g.xs[k], gv + half);
      ctx.stroke();
    }
    if (g.wy[k] > 0.02) {
      ctx.lineWidth = g.wy[k] * 0.55;
      ctx.beginPath();
      ctx.moveTo(gu - half, g.ys[k]);
      ctx.lineTo(gu + half, g.ys[k]);
      ctx.stroke();
    }
  }
  if (m.water !== false) {
    const river = new Path2D();
    const ph = g.rnd[7] * 6;
    for (let s = 0; s <= 60; s++) {
      const u = gu - half + (2 * half * s) / 60;
      const v = 0.78 + 0.05 * Math.sin(u * 5.2 + ph) + 0.025 * Math.sin(u * 11 + ph * 2);
      if (s) river.lineTo(u, v);
      else river.moveTo(u, v);
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = T.bank;
    ctx.lineWidth = 0.085;
    ctx.stroke(river);
    ctx.strokeStyle = T.water;
    ctx.lineWidth = 0.068;
    ctx.stroke(river);
  }
  ctx.restore();

  // route, in box units (constant width at any zoom)
  if (m.route && m.route.length > 1 && (m.progress ?? 1) > 0.001) {
    const pts = m.route.map(([u, v]) => toBox(u, v));
    const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = seg.reduce((s, l) => s + l, 0);
    let left = total * clamp(m.progress ?? 1);
    const path = new Path2D();
    path.moveTo(pts[0][0], pts[0][1]);
    let tip = pts[0];
    for (let i = 0; i < seg.length && left > 0; i++) {
      const u = Math.min(1, left / seg[i]);
      tip = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
      path.lineTo(tip[0], tip[1]);
      left -= seg[i];
    }
    const rw = m.routeWidth ?? 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = T.casing;
    ctx.lineWidth = rw + 4;
    ctx.stroke(path);
    ctx.strokeStyle = T.route;
    ctx.lineWidth = rw;
    ctx.stroke(path);
    for (const [px, py, r, c] of [[pts[0][0], pts[0][1], rw * 1.15, T.casing], [pts[0][0], pts[0][1], rw * 0.6, T.route]] as const) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    }
    void tip;
  }
  if (m.me) {
    const [mx, my] = toBox(m.me[0], m.me[1]);
    const ph = ((m.pulse ?? 0) % 1 + 1) % 1;
    ctx.beginPath();
    ctx.arc(mx, my, 9 + 24 * ph, 0, Math.PI * 2);
    ctx.fillStyle = m.meColor ? rgba(m.meColor, 0.26 * (1 - ph)) : `rgba(47,123,255,${0.26 * (1 - ph)})`;
    ctx.fill();
    ctx.save();
    setShadow(ctx, { blur: 6, y: 1.5, color: "rgba(0,0,0,0.2)" });
    ctx.beginPath();
    ctx.arc(mx, my, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.fillStyle = m.meColor ?? T.route;
    ctx.fill();
  }
  for (const p of m.pins ?? []) {
    const s = p.pop ?? 1;
    if (s <= 0.01) continue;
    const [px, py] = toBox(p.at[0], p.at[1]);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
    setShadow(ctx, { blur: 8, y: 3, color: "rgba(0,0,0,0.22)" });
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-4, -8, -15, -16, -15, -27);
    ctx.arc(0, -27, 15, Math.PI, 0);
    ctx.bezierCurveTo(15, -16, 4, -8, 0, 0);
    ctx.closePath();
    ctx.fillStyle = p.color ?? "#ff3b30";
    ctx.fill();
    noShadow(ctx);
    if (p.glyph) glyph(ctx, p.glyph, 0, -27, 21, "#ffffff");
    else {
      ctx.beginPath();
      ctx.arc(0, -27, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    if (p.label) {
      ctx.font = font("ui", 13, 600);
      const tw = ctx.measureText(p.label).width + 18;
      setShadow(ctx, { blur: 10, y: 3, color: "rgba(0,0,0,0.14)" });
      capsule(ctx, -tw / 2, -72, tw, 26);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      noShadow(ctx);
      text(ctx, p.label, 0, -54.5, { size: 13, weight: 600, color: T.label === "#f2f2f7" ? "#1c1c1e" : T.label, align: "center" });
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Spring pop for pins and markers (0 -> 1 with overshoot) from frame `at`. */
export const pinPop = (frame: number, at: number) => spr(frame, at, SPRING.pop);
