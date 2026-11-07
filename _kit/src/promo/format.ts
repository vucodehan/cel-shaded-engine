/**
 * Formats: orientation, a size unit and safe areas, so one composition serves 16:9 and 9:16.
 *   u        px per design unit: 1 at 1080 px on the short side (author sizes at 1080p and multiply by u)
 *   title    title-safe (5 % inset), action: action-safe (3.5 % inset)
 *   safe     where key text and logos go: title-safe in 16:9; in 9:16 also clear of the platform UI
 *            (top 8 %, bottom 18 % captions and description, right 12 % buttons, left 6 %)
 */
import { useMemo } from "react";
import { useVideoConfig } from "remotion";

export type Rect = { x: number; y: number; w: number; h: number };
export type Format = {
  W: number; H: number; fps: number;
  portrait: boolean; landscape: boolean; square: boolean; aspect: number;
  u: number;
  title: Rect; action: Rect; safe: Rect;
};

const inset = (W: number, H: number, l: number, t: number, r: number, b: number): Rect => ({
  x: W * l, y: H * t, w: W * (1 - l - r), h: H * (1 - t - b),
});

export function formatOf(W: number, H: number, fps = 30): Format {
  const portrait = H > W * 1.05, landscape = W > H * 1.05;
  const title = inset(W, H, 0.05, 0.05, 0.05, 0.05);
  return {
    W, H, fps, portrait, landscape, square: !portrait && !landscape, aspect: W / H,
    u: Math.min(W, H) / 1080,
    title,
    action: inset(W, H, 0.035, 0.035, 0.035, 0.035),
    safe: portrait ? inset(W, H, 0.06, 0.08, 0.12, 0.18) : title,
  };
}

export const useFormat = (): Format => {
  const { width, height, fps } = useVideoConfig();
  return useMemo(() => formatOf(width, height, fps), [width, height, fps]);
};

/** Sub-rectangle by fractions of r: sub(fmt.safe, 0, 0, 1, 0.3) is the top 30 % of the safe area. */
export const sub = (r: Rect, fx0: number, fy0: number, fx1: number, fy1: number): Rect => ({
  x: r.x + r.w * fx0, y: r.y + r.h * fy0, w: r.w * (fx1 - fx0), h: r.h * (fy1 - fy0),
});
export const center = (r: Rect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];
/** The largest box of the safe area that is symmetric about the frame centre: text centred in it lines up with a
 * centred phone or lockup (9:16's safe area is off-centre: 6 % left, 12 % right, 8 % top, 18 % bottom). */
export const centerSafe = (fmt: Pick<Format, "W" | "H" | "safe">): Rect => {
  const s = fmt.safe;
  const hw = Math.min(fmt.W / 2 - s.x, s.x + s.w - fmt.W / 2), hh = Math.min(fmt.H / 2 - s.y, s.y + s.h - fmt.H / 2);
  return { x: fmt.W / 2 - hw, y: fmt.H / 2 - hh, w: 2 * hw, h: 2 * hh };
};
export const pad = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });
