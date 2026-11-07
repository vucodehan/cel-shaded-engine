/**
 * Flights that are more than one arc: a smooth spline through points (centripetal Catmull-Rom as cubic Béziers) with
 * an arc-length table, a flight along it (position, tangent rotation, size by progress, motion stretch; frames may be
 * fractional), and the dotted trail it leaves (dots at equal arc length that pop in as they are laid and fade with
 * age). Any 2D space works: image px for overlays, screen points inside a phone. Pure functions of the frame.
 */
import { clamp, EASE, Ease, lerp } from "./ease";

export type P2 = [number, number];
type Bez = [P2, P2, P2, P2];
export type SplinePoint = { x: number; y: number; tx: number; ty: number };
export type Spline = { length: number; at: (s: number) => SplinePoint; points: P2[] };

const dist = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const bz = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};
const dbz = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
};

/** A spline through `points` (centripetal Catmull-Rom, alpha 0.5: no cusps or self-loops between close points). */
export function spline(points: P2[], o: { alpha?: number; samples?: number } = {}): Spline {
  const n = points.length;
  if (n < 2) throw new Error("spline: needs 2+ points");
  const al = o.alpha ?? 0.5, N = o.samples ?? 48;
  const refl = (a: P2, b: P2): P2 => [2 * b[0] - a[0], 2 * b[1] - a[1]];
  const ext: P2[] = [refl(points[1], points[0]), ...points, refl(points[n - 2], points[n - 1])];
  const segs: Bez[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    const d1 = Math.max(1e-4, dist(p0, p1) ** al), d2 = Math.max(1e-4, dist(p1, p2) ** al), d3 = Math.max(1e-4, dist(p2, p3) ** al);
    const b1 = [0, 1].map((k) => (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) / (3 * d1 * (d1 + d2))) as P2;
    const b2 = [0, 1].map((k) => (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) / (3 * d3 * (d3 + d2))) as P2;
    segs.push([p1, b1, b2, p2]);
  }
  const ts: { s: number; i: number; t: number }[] = [{ s: 0, i: 0, t: 0 }];
  let acc = 0;
  segs.forEach((g, i) => {
    let px = g[0][0], py = g[0][1];
    for (let k = 1; k <= N; k++) {
      const t = k / N, x = bz(g[0][0], g[1][0], g[2][0], g[3][0], t), y = bz(g[0][1], g[1][1], g[2][1], g[3][1], t);
      acc += Math.hypot(x - px, y - py);
      ts.push({ s: acc, i, t });
      px = x;
      py = y;
    }
  });
  const at = (s: number): SplinePoint => {
    const q = clamp(s, 0, acc);
    let lo = 0, hi = ts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ts[m].s <= q) lo = m;
      else hi = m;
    }
    const A = ts[lo], B = ts[hi], k = B.s > A.s ? (q - A.s) / (B.s - A.s) : 0;
    const i = A.i === B.i ? A.i : B.i, t = A.i === B.i ? lerp(A.t, B.t, k) : lerp(0, B.t, k);
    const g = segs[i];
    let tx = dbz(g[0][0], g[1][0], g[2][0], g[3][0], t), ty = dbz(g[0][1], g[1][1], g[2][1], g[3][1], t);
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    return { x: bz(g[0][0], g[1][0], g[2][0], g[3][0], t), y: bz(g[0][1], g[1][1], g[2][1], g[3][1], t), tx, ty };
  };
  return { length: acc, at, points };
}

/** Size along a path by progress u (0..1 of its length): [start, end] interpolates geometrically (reads as depth),
 * [[u, size], ...] keys do it piecewise, or any function of u. */
export type SizeSpec = number | [number, number] | [number, number][] | ((u: number) => number);
export const sizeAt = (spec: SizeSpec, u: number): number => {
  if (typeof spec === "number") return spec;
  if (typeof spec === "function") return spec(u);
  const geo = (a: number, b: number, t: number) => a * Math.pow(Math.max(1e-6, b) / Math.max(1e-6, a), t);
  if (typeof spec[0] === "number") return geo(spec[0] as number, spec[1] as number, clamp(u));
  const keys = spec as [number, number][];
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) return geo(keys[i - 1][1], keys[i][1], EASE.smooth((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};

export type PathFlightOpts = {
  path: Spline; at: number; dur: number;
  /** progress over time (default EASE.inOut; may overshoot) */ ease?: Ease;
  size?: SizeSpec;
  /** keep the body upright: mirror it (flip) when travelling left instead of rolling over; loops want false */ level?: boolean;
  /** max motion stretch (0.25 = 25 % longer along the motion) */ stretch?: number;
  /** the part of the path flown, 0..1 */ from?: number; to?: number;
};
export type PathPose = { x: number; y: number; size: number; rot: number; flip: boolean; stretch: number; stretchAngle: number; u: number; s: number; started: boolean; done: boolean };

const progressOf = (o: PathFlightOpts, frame: number) => {
  const e = o.ease ?? EASE.inOut, a = o.from ?? 0, b = o.to ?? 1;
  return lerp(a, b, e(clamp((frame - o.at) / o.dur)));
};

/** Where a flight along a spline is at `frame` (holds the start before `at`, the end after at + dur). */
export function pathFlight(frame: number, o: PathFlightOpts): PathPose {
  const L = o.path.length;
  const u = progressOf(o, frame), p = o.path.at(u * L);
  const size = sizeAt(o.size ?? 100, clamp(u));
  const pa = o.path.at(progressOf(o, frame - 0.5) * L), pb = o.path.at(progressOf(o, frame + 0.5) * L);
  const vx = pb.x - pa.x, vy = pb.y - pa.y, speed = Math.hypot(vx, vy) / Math.max(1, size);
  let rot = (Math.atan2(p.ty, p.tx) * 180) / Math.PI, flip = false;
  if (o.level && Math.abs(rot) > 90) {
    flip = true;
    rot -= 180 * Math.sign(rot);
  }
  return {
    x: p.x, y: p.y, size, rot, flip,
    stretch: 1 + Math.min(o.stretch ?? 0.25, speed * 0.4), stretchAngle: (Math.atan2(vy, vx) * 180) / Math.PI,
    u, s: u * L, started: frame >= o.at, done: frame >= o.at + o.dur,
  };
}

export type TrailOpts = {
  /** arc length between dots (same units as the path) */ spacing: number;
  /** dot radius, or a function of path progress u (e.g. proportional to the body size) */ r: number | ((u: number) => number);
  /** a dot is laid when the body is this far past it (default 1.2 spacing) */ gap?: number;
  /** frames a laid dot lives: full opacity for `hold`, then fades out by `fade` (defaults 14, 40) */ hold?: number; fade?: number;
  /** frames a new dot takes to pop to full size (default 4) */ pop?: number;
  /** arc length of the first dot (default one spacing) and where dots stop */ start?: number; end?: number;
};
export type Dot = { x: number; y: number; r: number; a: number; u: number };

/** The dotted trail of a flight at `frame`: dots at fixed arc lengths along the path, laid as the body passes. */
export function trail(frame: number, f: PathFlightOpts, o: TrailOpts): Dot[] {
  if (frame < f.at) return [];
  const L = f.path.length, gap = o.gap ?? o.spacing * 1.2, fade = o.fade ?? 40, hold = Math.min(o.hold ?? 14, fade - 1), pop = o.pop ?? 4;
  // time table of the body's arc length (running max, so anticipation does not lay dots twice)
  const steps = Math.max(8, Math.ceil(f.dur * 2));
  const T: { f: number; s: number }[] = [];
  let run = -1;
  for (let k = 0; k <= steps; k++) {
    const fr = f.at + (k / steps) * f.dur;
    run = Math.max(run, progressOf(f, fr) * L);
    T.push({ f: fr, s: run });
  }
  const now = Math.max(...T.filter((q) => q.f <= frame).map((q) => q.s), progressOf(f, Math.min(frame, f.at + f.dur)) * L);
  const laidAt = (s: number) => {
    for (let k = 1; k < T.length; k++) if (T[k].s >= s) return lerp(T[k - 1].f, T[k].f, T[k].s > T[k - 1].s ? (s - T[k - 1].s) / (T[k].s - T[k - 1].s) : 1);
    return Infinity;
  };
  const dots: Dot[] = [];
  const end = Math.min(o.end ?? L, L);
  for (let s = o.start ?? o.spacing; s <= end && s + gap <= now; s += o.spacing) {
    const age = frame - laidAt(s + gap);
    if (age < 0 || age > fade) continue;
    const u = s / L, p = f.path.at(s);
    const grow = clamp(age / pop), sc = grow < 1 ? EASE.out(grow) * 1.12 : 1 + 0.12 * Math.max(0, 1 - (age - pop) / 3);
    const r0 = typeof o.r === "function" ? o.r(u) : o.r;
    dots.push({ x: p.x, y: p.y, u, r: r0 * sc * (1 - 0.35 * clamp((age - hold) / (fade - hold))), a: 1 - clamp((age - hold) / (fade - hold)) });
  }
  return dots;
}

/** Draw trail dots on a canvas (in the context's units). */
export function drawDots(ctx: CanvasRenderingContext2D, dots: Dot[], color: string, alpha = 1) {
  ctx.save();
  ctx.fillStyle = color;
  for (const d of dots) {
    if (d.a <= 0.003 || d.r <= 0.05) continue;
    ctx.globalAlpha = alpha * d.a;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
