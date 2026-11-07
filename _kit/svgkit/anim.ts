import { Easing, interpolate, random } from "remotion";

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  outSoft: Easing.bezier(0.33, 1, 0.68, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.55, 0, 1, 0.45),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: (t: number) => t,
};

/** 0 -> 1 between `start` and `start + duration`, clamped and eased. */
export const prog = (frame: number, start: number, duration: number, easing: (t: number) => number = ease.out) =>
  interpolate(frame, [start, start + Math.max(1, duration)], [0, 1], { ...CLAMP, easing });

/** 0 -> 1 over the in-window, 1 -> 0 over the out-window. */
export const windowed = (frame: number, inStart: number, inDur: number, outStart: number, outDur: number) =>
  Math.min(prog(frame, inStart, inDur, ease.outSoft), 1 - prog(frame, outStart, outDur, ease.inOut));

/** Remap p from [a, b] to [0, 1], clamped. */
export const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const range = (seed: string, min: number, max: number) => min + random(seed) * (max - min);

/** Smooth keyframed value: keys [[frame, value], ...] with ease.inOut between them. */
export const keys = (frame: number, ks: [number, number][]) => {
  if (frame <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [f0, v0] = ks[i];
    const [f1, v1] = ks[i + 1];
    if (frame <= f1) return lerp(v0, v1, ease.inOut((frame - f0) / Math.max(1, f1 - f0)));
  }
  return ks[ks.length - 1][1];
};

export const shake = (frame: number, start: number, duration: number, amp: number, seed = "shake") => {
  const t = frame - start;
  if (t < 0 || t > duration) return { x: 0, y: 0 };
  const decay = Math.pow(1 - t / duration, 2);
  return {
    x: (random(`${seed}x${frame}`) - 0.5) * 2 * amp * decay,
    y: (random(`${seed}y${frame}`) - 0.5) * 2 * amp * decay,
  };
};

export const drawOn = (length: number, p: number) => ({
  strokeDasharray: `${length} ${length + 1}`,
  strokeDashoffset: length * (1 - p),
  opacity: p <= 0 ? 0 : 1,
});

type Pt = [number, number];

/** Closed or open Catmull-Rom spline through points, as an SVG path. */
export const smooth = (pts: Pt[], closed = true, t = 0.5) => {
  const n = pts.length;
  if (n < 2) return "";
  const at = (i: number): Pt => (closed ? pts[mod(i, n)] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * t) / 3, p1[1] + ((p2[1] - p0[1]) * t) / 3];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * t) / 3, p2[1] - ((p3[1] - p1[1]) * t) / 3];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return closed ? `${d} Z` : d;
};

/** Polyline path through points. */
export const polyline = (pts: Pt[], closed = false) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + (closed ? " Z" : "");

/** Rotate a point by degrees around the origin. */
export const rot = (p: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
};
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const mixPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export type { Pt };
