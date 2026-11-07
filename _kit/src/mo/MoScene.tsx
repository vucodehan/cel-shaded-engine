import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "./theme";
import { Grain, Vignette } from "./Atmosphere";

/**
 * Frame for a motion-design scene (or a motion insert inside a cel scene) in a cel film: ink ground, the
 * children (back to front), then vignette and grain like the Motion Design films' shell. CelFilm cuts into a
 * scene at frame overlap/2 (9) and out at dur - 9: `fade` dips through black over that many frames after the
 * cut-in and before the cut-out (0 = hard cut, as cel shots do). Inside a <Sequence> insert pass the insert's
 * own length as `dur` and `cut={0}`. `over` layers (text) draw above the vignette so they stay at full brightness.
 */
export const MoScene: React.FC<{ dur: number; children: React.ReactNode; over?: React.ReactNode; fade?: number; fadeIn?: number; fadeOut?: number; cut?: number; bg?: string; vignette?: number; grain?: number }> = ({
  dur, children, over, fade = 8, fadeIn, fadeOut, cut = 9, bg = C.ink, vignette = 0.7, grain = 0.045,
}) => {
  const f = useCurrentFrame();
  const fi = fadeIn ?? fade, fo = fadeOut ?? fade;
  const a = fi > 0 ? interpolate(f, [cut, cut + fi], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const b = fo > 0 ? interpolate(f, [dur - cut - fo, dur - cut], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: Math.min(a, b) }}>
        {children}
        {vignette > 0 ? <Vignette strength={vignette} /> : null}
        {over}
      </AbsoluteFill>
      {grain > 0 ? <Grain opacity={grain} /> : null}
    </AbsoluteFill>
  );
};
