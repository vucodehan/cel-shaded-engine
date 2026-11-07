/**
 * Brand marks for the end card. A mark is any render function of MarkProps (absolute centre, radius, roll and turn
 * in degrees); the end card animates those values. OrbMark: a sphere whose features (eyes, a spark...) are drawn on
 * its surface and turn around it in 3D. TileMark: an app-icon tile with a glyph that flips on the turn.
 */
import React from "react";
import { useVideoConfig } from "remotion";
import { Canvas2D } from "./Canvas2D";
import { fillOf, Fill, squircle, setShadow, noShadow } from "./ui";
import { drawGlyph, GlyphFn, GlyphName } from "./glyphs";

/** blink: 0..1 eyelid closure the end card sends during its living hold (OrbMark's default eyes use it; your own
 * marks may ignore it or close their eyes with it) */
export type MarkProps = { cx: number; cy: number; r: number; roll: number; turn: number; frame: number; color: string; blink?: number };

type V3 = [number, number, number];
type M3 = [V3, V3, V3];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lin = (a: V3, sa: number, b: V3, sb: number): V3 => [a[0] * sa + b[0] * sb, a[1] * sa + b[1] * sb, a[2] * sa + b[2] * sb];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const apply = (m: M3, p: V3): V3 => [dot(m[0], p), dot(m[1], p), dot(m[2], p)];
const mul = (a: M3, b: M3): M3 => [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j])) as M3;
const rotAxis = (k: V3, th: number): M3 => {
  const c = Math.cos(th), s = Math.sin(th), C = 1 - c, [x, y, z] = k;
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
};
const rotZ = (r: number): M3 => [[Math.cos(r), -Math.sin(r), 0], [Math.sin(r), Math.cos(r), 0], [0, 0, 1]];
const RAD = Math.PI / 180;

/** A feature on the sphere: centre at image (x, y) in radii (rest pose, y down), a capsule along image angle `a`
 * (rad) with arc half-length `half` and radius `rad` (both in radians of the sphere; half 0 = a round dot). */
export type OrbFeature = { x: number; y: number; a?: number; half?: number; rad?: number };
/** Default face: two tall oval eyes, a little above the centre. */
export const ORB_EYES: OrbFeature[] = [
  { x: -0.24, y: -0.12, a: Math.PI / 2, half: 0.085, rad: 0.078 },
  { x: 0.24, y: -0.12, a: Math.PI / 2, half: 0.085, rad: 0.078 },
];

const outline = (f: OrbFeature, n = 24): V3[] => {
  const c: V3 = [f.x, f.y, Math.sqrt(Math.max(0, 1 - f.x * f.x - f.y * f.y))];
  const al = f.a ?? 0, h = f.half ?? 0, rr = f.rad ?? 0.1;
  const d: V3 = [Math.cos(al), Math.sin(al), 0];
  const t = unit(lin(d, 1, c, -dot(d, c)));
  const nrm = cross(c, t);
  const q = (s: number) => lin(c, Math.cos(s), t, Math.sin(s));
  const tq = (s: number) => lin(c, -Math.sin(s), t, Math.cos(s));
  const cr = Math.cos(rr), sr = Math.sin(rr), pts: V3[] = [];
  for (let i = 0; i <= n; i++) pts.push(lin(q(-h + (2 * h * i) / n), cr, nrm, sr));
  for (let i = 1; i < n; i++) {
    const p = (Math.PI * i) / n;
    pts.push(lin(q(h), cr, lin(nrm, Math.cos(p), tq(h), Math.sin(p)), sr));
  }
  for (let i = 0; i <= n; i++) pts.push(lin(q(h - (2 * h * i) / n), cr, nrm, -sr));
  for (let i = 1; i < n; i++) {
    const p = (Math.PI * i) / n;
    pts.push(lin(q(-h), cr, lin(nrm, -Math.cos(p), tq(-h), -Math.sin(p)), sr));
  }
  return pts;
};

/** The visible part of a rotated outline (unit-sphere coordinates) as an SVG path; rim stretches pushed out by `out`. */
const visiblePath = (pts: V3[], out: number): string | null => {
  const n = pts.length, vis = pts.map((p) => p[2] >= 0);
  if (!vis.some(Boolean)) return null;
  const xy: [number, number][] = [];
  if (vis.every(Boolean)) for (const p of pts) xy.push([p[0], p[1]]);
  else {
    const rim = (a: V3, b: V3): [number, number] => {
      const k = a[2] / (a[2] - b[2]), x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, l = Math.hypot(x, y);
      return [x / l, y / l];
    };
    const arc = (from: [number, number], to: [number, number]) => {
      const a0 = Math.atan2(from[1], from[0]), d0 = Math.atan2(to[1], to[0]) - a0, d = Math.atan2(Math.sin(d0), Math.cos(d0));
      for (let s = 0; s <= 12; s++) xy.push([(1 + out) * Math.cos(a0 + (d * s) / 12), (1 + out) * Math.sin(a0 + (d * s) / 12)]);
    };
    let i0 = 0;
    while (!(vis[i0] && !vis[(i0 - 1 + n) % n])) i0++;
    let lastExit: [number, number] | null = null, firstEntry: [number, number] | null = null;
    for (let k = 0; k < n; k++) {
      const i = (i0 + k) % n, prev = (i - 1 + n) % n, next = (i + 1) % n;
      if (!vis[i]) continue;
      if (!vis[prev]) {
        const entry = rim(pts[i], pts[prev]);
        if (lastExit) arc(lastExit, entry);
        if (!firstEntry) firstEntry = entry;
        xy.push(entry);
      }
      xy.push([pts[i][0], pts[i][1]]);
      if (!vis[next]) {
        lastExit = rim(pts[i], pts[next]);
        xy.push(lastExit);
      }
    }
    if (lastExit && firstEntry) arc(lastExit, firstEntry);
  }
  return "M" + xy.map(([x, y]) => `${x.toFixed(5)} ${y.toFixed(5)}`).join("L") + "Z";
};

const outlines = new Map<string, V3[][]>();
/**
 * A sphere (flat colour) with features on its surface that turn with it: turn = degrees about an axis tilted
 * `tilt` deg from vertical (the reference turns 360 once), roll = degrees about the view axis. `rimOut` (px) lets
 * features that cross the rim merge with the page when they share its colour.
 */
export const OrbMark: React.FC<MarkProps & { features?: OrbFeature[]; featureColor?: string; tilt?: number; shine?: number; rimOut?: number; /** features close with `blink` (default: only the default ORB_EYES do) */ blinks?: boolean }> = (p) => {
  const { width, height } = useVideoConfig();
  if (p.r <= 0.05) return null;
  const feats = p.features ?? ORB_EYES;
  const key = JSON.stringify(feats);
  let ol = outlines.get(key);
  if (!ol) outlines.set(key, (ol = feats.map((f) => outline(f))));
  const tilt = (p.tilt ?? 25.5) * RAD;
  const R = mul(rotZ(p.roll * RAD), rotAxis([Math.sin(tilt), Math.cos(tilt), 0], p.turn * RAD));
  const out = (p.rimOut ?? 2) / p.r;
  // a blink squashes each feature vertically about its centre (rest pose), back onto the sphere
  const kb = (p.blinks ?? !p.features) ? Math.max(0.1, 1 - (p.blink ?? 0)) : 1;
  const lid = (q: V3, cy: number): V3 => {
    const y = cy + (q[1] - cy) * kb, l = Math.hypot(q[0], y, q[2]);
    return [q[0] / l, y / l, q[2] / l];
  };
  const paths = ol.map((o, i) => visiblePath(o.map((q) => apply(R, kb < 1 ? lid(q, feats[i].y) : q)), out)).filter((d): d is string => d !== null);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      {p.shine ? (
        <defs>
          <radialGradient id="orbshine" cx={-0.38} cy={-0.42} r={0.75} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity={p.shine} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
        </defs>
      ) : null}
      <g transform={`translate(${p.cx} ${p.cy}) scale(${p.r})`}>
        <circle cx={0} cy={0} r={1} fill={p.color} />
        {p.shine ? <circle cx={0} cy={0} r={1} fill="url(#orbshine)" /> : null}
        {paths.map((d, i) => <path key={i} d={d} fill={p.featureColor ?? "#ffffff"} />)}
      </g>
    </svg>
  );
};

/** Any SVG logo as a mark: children drawn in a unit box (-1..1; the mark's radius is 1), placed, scaled and rolled
 * by the end card; the turn flips it horizontally like a card (flip={false} to keep it flat); `blink` gives it a
 * small vertical squash (the living hold's beat). */
export const SvgMark: React.FC<MarkProps & { children: React.ReactNode; flip?: boolean }> = (p) => {
  const { width, height } = useVideoConfig();
  if (p.r <= 0.05) return null;
  const fx = p.flip === false ? 1 : Math.max(0.02, Math.abs(Math.cos(p.turn * RAD))), sq = 1 - 0.08 * (p.blink ?? 0);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      <g transform={`translate(${p.cx} ${p.cy}) rotate(${p.roll}) scale(${(p.r * fx) / sq} ${p.r * sq})`}>{p.children}</g>
    </svg>
  );
};

/** An app-tile mark: continuous-corner tile (r = half its size) with a glyph; the turn flips it like a card; `blink`
 * closes the glyph like an eye and squashes the tile a little. */
export const TileMark: React.FC<MarkProps & { fill?: Fill; glyph?: GlyphName | GlyphFn; fg?: string; shadow?: boolean }> = (p) => {
  if (p.r <= 0.05) return null;
  const b = p.blink ?? 0;
  return (
    <Canvas2D
      draw={(ctx) => {
        const s = 2 * p.r, flip = Math.cos(p.turn * RAD);
        ctx.translate(p.cx, p.cy);
        ctx.rotate(p.roll * RAD);
        ctx.scale(Math.max(0.02, Math.abs(flip)) / (1 - 0.05 * b), 1 - 0.05 * b);
        if (p.shadow) setShadow(ctx, { blur: s * 0.16, y: s * 0.06, color: "rgba(0,0,0,0.18)" });
        squircle(ctx, -s / 2, -s / 2, s, s, s * 0.2237);
        ctx.fillStyle = fillOf(ctx, p.fill ?? [p.color, p.color], -s / 2, -s / 2, s, s);
        ctx.fill();
        noShadow(ctx);
        if (p.glyph && flip > 0) {
          ctx.scale(1, Math.max(0.1, 1 - 0.9 * b));
          ctx.translate(-s / 2, -s / 2);
          ctx.scale(s, s);
          drawGlyph(ctx, p.glyph, p.fg ?? "#ffffff");
        }
      }}
    />
  );
};
