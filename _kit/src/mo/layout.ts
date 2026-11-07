import { CSSProperties } from "react";
import { useVideoConfig } from "remotion";
import { goldText } from "./theme";

/** Frame geometry for the current composition; `v` is true for portrait (9:16); `p(landscape, portrait)`. */
export const useLayout = () => {
  const { width: W, height: H } = useVideoConfig();
  const v = H > W;
  return { W, H, v, cx: W / 2, cy: H / 2, p: <T,>(land: T, port: T) => (v ? port : land) };
};

/**
 * Standard composition: a focal point `oy` for the artwork, a kicker line `header` and two text rows below it.
 * Portrait rows stay inside the Shorts safe area (top 8 %, bottom 20 %) and above the uploaded-subtitle band.
 */
export const useStage = () => {
  const l = useLayout();
  return l.v
    ? { ...l, oy: 760, s: 1.15, header: 1120, t1: 1220, t2: 1320, size: 70, small: 54 }
    : { ...l, oy: 410, s: 1, header: 690, t1: 760, t2: 830, size: 72, small: 54 };
};

/** Word styler: listed words in gold leaf (for Reveal's styleWord). */
export const gold =
  (words: string[]) =>
  (w: string): CSSProperties | undefined =>
    words.includes(w) ? goldText() : undefined;
