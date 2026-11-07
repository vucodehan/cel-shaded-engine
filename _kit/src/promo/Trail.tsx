/** <TrailDots>: a flight's dotted trail (path.ts `trail`) as an SVG overlay in image px. */
import React from "react";
import { useVideoConfig } from "remotion";
import type { Dot } from "./path";

export const TrailDots: React.FC<{ dots: Dot[]; color: string; opacity?: number; style?: React.CSSProperties }> = ({ dots, color, opacity = 1, style }) => {
  const { width, height } = useVideoConfig();
  if (!dots.length) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", ...style }}>
      {dots.map((d, i) => (d.a > 0.003 && d.r > 0.05 ? <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={opacity * d.a} /> : null))}
    </svg>
  );
};
