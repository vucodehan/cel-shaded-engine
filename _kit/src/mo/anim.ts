import { Easing, interpolate, random } from "remotion";

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  outSoft: Easing.bezier(0.33, 1, 0.68, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.55, 0, 1, 0.45),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
};

/** 0 -> 1 from `start` over `duration` frames, eased. */
export const prog = (frame: number, start: number, duration: number, easing: (t: number) => number = ease.out) =>
  interpolate(frame, [start, start + Math.max(1, duration)], [0, 1], { ...CLAMP, easing });

/** 0 -> 1 over the in-window, 1 -> 0 over the out-window. */
export const windowed = (frame: number, inStart: number, inDur: number, outStart: number, outDur: number) =>
  Math.min(prog(frame, inStart, inDur, ease.outSoft), 1 - prog(frame, outStart, outDur, ease.inOut));

/** Remap p from [a, b] to [0, 1], clamped. */
export const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const mod = (a: number, n: number) => ((a % n) + n) % n;

export const range = (seed: string, min: number, max: number) => min + random(seed) * (max - min);

/** Standard normal sample, deterministic per seed. */
export const gauss = (seed: string) => {
  const u = Math.max(1e-6, random(`${seed}u`));
  const v = random(`${seed}v`);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Impact shake on twos: a new random offset every second frame (a new one every frame strobes; flicker_qa flags it). */
export const shake = (frame: number, start: number, duration: number, amp: number, seed = "shake") => {
  const q = Math.floor(frame / 2) * 2;
  const t = q - start;
  if (t < 0 || t > duration) return { x: 0, y: 0 };
  const decay = Math.pow(1 - t / duration, 2);
  return { x: (random(`${seed}x${q}`) - 0.5) * 2 * amp * decay, y: (random(`${seed}y${q}`) - 0.5) * 2 * amp * decay };
};

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mixColor = (a: string, b: string, t: number) => {
  const ca = hex(a);
  const cb = hex(b);
  const c = ca.map((v, i) => Math.round(lerp(v, cb[i], t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/**
 * Stroke style that draws a path of `length` on as p goes 0 -> 1. Staggered draws must keep every element's window
 * inside the scene: prog(f, start + i * stagger, dur) with the last start + dur before the scene ends, or late
 * elements never finish (the Motion Design films' Genesis 11 gotcha).
 */
export const drawOn = (length: number, p: number) => ({
  strokeDasharray: `${length} ${length + 1}`,
  strokeDashoffset: length * (1 - p),
  opacity: p <= 0 ? 0 : 1,
});
