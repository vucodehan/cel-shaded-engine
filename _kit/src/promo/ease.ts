/**
 * Timing: the house eases measured on the reference promo (videoclone.md 10.2 camera, 10.5 end card), spring presets
 * fitted to its Dynamic Island (10.6), and keyframe helpers. Frames may be fractional everywhere.
 */
import { Easing } from "remotion";

export type Ease = (t: number) => number;
const bz = (x1: number, y1: number, x2: number, y2: number): Ease => Easing.bezier(x1, y1, x2, y2);

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? (v >= b ? 1 : 0) : (v - a) / (b - a));
/** 0..1 progress of `frame` through [from, to], eased (the ease may overshoot). */
export const prog = (frame: number, from: number, to: number, ease: Ease = (t) => t) => ease(clamp(invLerp(from, to, frame)));

export const EASE = {
  linear: ((t) => t) as Ease,
  // camera, 10.2 (fitted on the solved camera)
  /** the phone rises into frame: very fast out, long settle (42 frames in the reference) */
  rise: bz(0.134, 0.803, 0.268, 0.995),
  /** orbit to the side button, yaw (36 frames), a small overshoot */
  orbitYaw: bz(0.443, 0.052, 0.0, 1.038),
  /** orbit, distance and aim (pushes in to 0.57x) */
  orbitDist: bz(0.435, 0.075, 0.0, 1.053),
  /** swing back face-on (33 frames) */
  returnYaw: bz(0.748, 0.038, 0.011, 0.962),
  /** the upward tilt during the return (anticipates slightly) */
  returnPitch: bz(0.608, -0.224, 0.306, 1.014),
  // end card, 10.5
  /** a text block sliding to rest (138 px over 23 frames at 1080p) */
  blockSlide: bz(0.0209, 0.6573, 0.4065, 1.0),
  /** a word popping in a few px right of its rest and settling (5 frames) */
  wordPop: bz(0.0, 0.9946, 0.9999, 1.0214),
  wordPopSoft: bz(0.0, 0.9855, 0.8353, 1.0056),
  wordPopBounce: bz(0.001, 0.7316, 0.5709, 1.0611),
  wordPopLate: bz(0.1411, 0.3795, 0.0188, 1.0558),
  /** the last word lands in two segments: in fast, then a slow settle */
  lastWordIn: bz(0.9748, 0.5022, 0.3254, 0.9027),
  lastWordSettle: bz(0.1338, 0.4033, 0.7345, 1.0415),
  /** brand mark grows from nothing (12.5 frames) */
  markGrow: bz(0.0366, 0.8963, 0.0, 0.9547),
  /** brand mark shrinks to 54 % (18.6 frames), a small overshoot */
  markShrink: bz(0.7241, 0.0257, 0.2448, 1.0353),
  /** the lockup slide: ease in, then ease out */
  lockupSlideIn: bz(0.6518, 0.0067, 0.869, 0.1407),
  lockupSlideOut: bz(0.1554, 0.6722, 0.04, 1.0),
  rollOut: bz(0.3153, 0.0282, 0.0008, 1.0),
  rollBack: bz(0.6548, 0.0, 0.2697, 1.0),
  turnIn: bz(1.0, 0.0626, 1.0, 0.5074),
  turnOut: bz(0.2092, 0.8132, 0.0007, 0.9951),
  // general purpose
  out: bz(0.16, 1, 0.3, 1),
  outSoft: bz(0.25, 0.8, 0.35, 1),
  inOut: bz(0.65, 0, 0.35, 1),
  smooth: bz(0.45, 0.05, 0.25, 1),
  in: bz(0.7, 0, 0.84, 0),
} satisfies Record<string, Ease>;
export type EaseName = keyof typeof EASE;

/** Back eases: anticipation (backIn) and overshoot (backOut); s = 1.70158 is the classic 10 % overshoot. */
export const backOut = (s = 1.70158): Ease => (t) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
export const backIn = (s = 1.70158): Ease => (t) => (s + 1) * t ** 3 - s * t ** 2;
export const backInOut = (s = 1.70158): Ease => (t) => {
  const k = s * 1.525;
  return t < 0.5 ? ((2 * t) ** 2 * ((k + 1) * 2 * t - k)) / 2 : ((2 * t - 2) ** 2 * ((k + 1) * (t * 2 - 2) + k) + 2) / 2;
};

/** Spring physics (mass, stiffness, damping) as in Remotion's spring(); configs are interchangeable. */
export type Spring = { mass?: number; stiffness: number; damping: number };
export const SPRING = {
  /** island width when it opens: from +0.5 f after the trigger, no overshoot (fit rms 3.7 pt on 10.6) */
  islandW: { mass: 1, stiffness: 169, damping: 28.6 },
  /** island height when it opens: from +4.5 f, about 1 pt overshoot (fit rms 1.5 pt) */
  islandH: { mass: 1, stiffness: 77, damping: 14 },
  /** island collapse, width and height together (about 6 frames) */
  islandClose: { mass: 1, stiffness: 441, damping: 42 },
  /** UI element pop with a visible overshoot */
  pop: { mass: 1, stiffness: 260, damping: 16 },
  /** settles without overshoot */
  soft: { mass: 1, stiffness: 120, damping: 20 },
  /** quick, a little overshoot */
  snappy: { mass: 1, stiffness: 420, damping: 30 },
  /** jelly wobble for squash after an impact */
  wobble: { mass: 1, stiffness: 320, damping: 9 },
} satisfies Record<string, Spring>;

/** Normalised step response (0 -> 1, may overshoot) of a spring released at rest at frame `at`. Closed form, so
 * exact at fractional frames and independent of the frame order a render uses. */
export function spr(frame: number, at: number, s: Spring = SPRING.soft, fps = 30): number {
  const t = (frame - at) / fps;
  if (t <= 0) return 0;
  const m = s.mass ?? 1, k = s.stiffness, c = s.damping;
  const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (Math.abs(z - 1) < 1e-6) return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
  }
  const q = Math.sqrt(z * z - 1), r1 = -w0 * (z - q), r2 = -w0 * (z + q);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

/** A value that springs to each key's v from wherever it was at that key's frame (position-continuous). */
export function springKeys(frame: number, keys: { f: number; v: number; spring?: Spring }[], fps = 30): number {
  let i = -1;
  for (let k = 0; k < keys.length; k++) if (keys[k].f <= frame) i = k;
  if (i <= 0) return keys[0]?.v ?? 0;
  const start = springKeys(keys[i].f, keys.slice(0, i), fps);
  return lerp(start, keys[i].v, spr(frame, keys[i].f, keys[i].spring ?? SPRING.soft, fps));
}

export type Key<T> = { f: number; v: T; ease?: Ease };
/** Keyframed number or vector; each key's ease shapes the segment arriving at it. Holds outside the keys. */
export function keyframes(frame: number, keys: Key<number>[]): number;
export function keyframes(frame: number, keys: Key<number[]>[]): number[];
export function keyframes(frame: number, keys: Key<number | number[]>[]): number | number[] {
  if (!keys.length) throw new Error("keyframes: no keys");
  if (frame <= keys[0].f) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (frame < b.f) {
      const t = (b.ease ?? EASE.linear)(clamp((frame - a.f) / (b.f - a.f)));
      if (typeof a.v === "number") return lerp(a.v, b.v as number, t);
      return a.v.map((x, j) => lerp(x, (b.v as number[])[j], t));
    }
  }
  return keys[keys.length - 1].v;
}

/** Keys over named fields: each key sets any subset of fields; each field interpolates between the keys that set
 * it, with `eases[field]` or `ease` of the arriving key. Fields no key sets keep `base`. */
export type FieldKey<T> = { f: number; ease?: Ease; eases?: { [K in keyof T]?: Ease } } & Partial<T>;
export function fields<T extends { [k: string]: number | number[] }>(frame: number, keys: FieldKey<T>[], base: T): T {
  const out = { ...base };
  for (const name of Object.keys(base) as (keyof T & string)[]) {
    const ks: Key<number | number[]>[] = [];
    for (const k of keys) {
      const v = (k as Partial<T>)[name];
      if (v !== undefined) ks.push({ f: k.f, v: v as number | number[], ease: k.eases?.[name] ?? k.ease });
    }
    ks.sort((a, b) => a.f - b.f);
    if (ks.length) out[name] = keyframes(frame, ks as Key<number>[]) as T[typeof name];
  }
  return out;
}

/** Measured segments (the clone's format): t = [from, to] frames, v = [from, to], bz = cubic-bezier. */
export type Seg = { t: [number, number]; v: [number, number]; bz: [number, number, number, number] };
export const seg = (f: number, s: Seg) => lerp(s.v[0], s.v[1], bz(...s.bz)(clamp((f - s.t[0]) / (s.t[1] - s.t[0]))));
/** Segments in time order: before the first its start value, between segments the previous end value. */
export const chain = (f: number, segs: Seg[]): number => {
  for (const s of segs) if (f < s.t[1]) return f <= s.t[0] ? s.v[0] : seg(f, s);
  return segs[segs.length - 1].v[1];
};

/** Damped oscillation after an impact at `at` (starts at +amp): squash = 1 - wobble(...). */
export const wobble = (frame: number, at: number, amp = 0.18, hz = 4.5, decay = 7, fps = 30) => {
  const t = (frame - at) / fps;
  return t < 0 ? 0 : amp * Math.cos(2 * Math.PI * hz * t) * Math.exp(-decay * t);
};

/** Eyelid closure 0..1 for blinks starting at each frame in `at` (closes in 2 frames, opens in 3). */
export const blink = (frame: number, at: number[], close = 2, open = 3) => {
  let v = 0;
  for (const a of at) {
    const t = frame - a;
    if (t >= 0 && t < close) v = Math.max(v, t / close);
    else if (t >= close && t < close + open) v = Math.max(v, 1 - (t - close) / open);
  }
  return EASE.smooth(clamp(v));
};

/** A spring pop 0 -> 1 (with overshoot) from frame `at`; 0 before. */
export const pop = (frame: number, at: number, s: Spring = SPRING.pop, fps = 30) => spr(frame, at, s, fps);

/** Deterministic pseudo-random numbers (mulberry32): rng(seed)() -> [0, 1). */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
