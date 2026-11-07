import React, { CSSProperties, SVGProps, useMemo } from "react";
import { getLength } from "@remotion/paths";
import { drawOn } from "./anim";
import { useLayout } from "./layout";

/** Full-frame SVG layer sized to the current composition. */
export const Svg: React.FC<{ style?: CSSProperties; children?: React.ReactNode }> = ({ style, children }) => {
  const { W, H } = useLayout();
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", ...style }}>
      {children}
    </svg>
  );
};

/** SVG path that strokes itself on as `progress` goes 0 -> 1. */
export const DrawPath: React.FC<{ d: string; progress: number } & Omit<SVGProps<SVGPathElement>, "d">> = ({ d, progress, style, ...rest }) => {
  const len = useMemo(() => getLength(d), [d]);
  return <path d={d} fill="none" strokeLinecap="round" strokeLinejoin="round" {...rest} style={{ ...drawOn(len, progress), ...style }} />;
};

/** Polyline helper: points -> "M x y L x y ..." */
export const poly = (pts: { x: number; y: number }[], close = false) =>
  pts.map((q, i) => `${i === 0 ? "M" : "L"} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ") + (close ? " Z" : "");
