import { useVideoConfig } from "remotion";

/** Frame geometry for the current composition; `v` is true for portrait (9:16). */
export const useLayout = () => {
  const { width: W, height: H } = useVideoConfig();
  const v = H > W;
  return {
    W,
    H,
    v,
    cx: W / 2,
    cy: H / 2,
    /** Horizon line used by the landscape presets. */
    hz: v ? 1060 : 600,
    /** Pick the landscape or portrait value. */
    p: <T,>(land: T, port: T): T => (v ? port : land),
  };
};
