/**
 * <Mascot>: the SVG overlay version of the mascot, drawn in image space over the stage (place it with the
 * projector, e.g. on a projected button or screen point). Same geometry as drawMascot.
 */
import React, { useId } from "react";
import { useVideoConfig } from "remotion";
import { clamp } from "./ease";
import { glossParts, MascotPose, mascotParts, mascotTransform } from "./character";

export const Mascot: React.FC<MascotPose & { style?: React.CSSProperties }> = ({ style, ...p }) => {
  const { width, height } = useVideoConfig();
  const id = useId().replace(/:/g, "");
  if (p.size <= 0.01 || (p.opacity ?? 1) <= 0.002) return null;
  const parts = mascotParts(p);
  const eye = p.eye ?? "#ffffff";
  const gl = p.gloss ? glossParts(p) : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", opacity: clamp(p.opacity ?? 1), ...style }}>
      {parts.gradient ? (
        <defs>
          <linearGradient id={`g${id}`} x1={0} y1={0.5} x2={0} y2={-0.5} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={parts.gradient[0]} />
            <stop offset="1" stopColor={parts.gradient[1]} />
          </linearGradient>
        </defs>
      ) : null}
      {p.shade ? (
        <defs>
          <clipPath id={`c${id}`}>
            <path d={parts.body} />
          </clipPath>
          <radialGradient id={`h${id}`} cx={-parts.width * 0.18} cy={-0.3} r={0.7} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.32 * p.shade} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`s${id}`} x1={0} y1={0.1} x2={0} y2={0.55} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#000000" stopOpacity={0} />
            <stop offset="1" stopColor="#000000" stopOpacity={0.16 * p.shade} />
          </linearGradient>
        </defs>
      ) : null}
      <g transform={mascotTransform(p)}>
        <path d={parts.body} fill={parts.gradient ? `url(#g${id})` : parts.bodyColor} />
        {parts.details.map((d, i) =>
          d.stroke ? (
            <path key={`d${i}`} d={d.d} fill="none" stroke={d.color} strokeWidth={d.stroke} strokeLinecap="round" opacity={d.alpha ?? 1} />
          ) : (
            <path key={`d${i}`} d={d.d} fill={d.color} opacity={d.alpha ?? 1} />
          ),
        )}
        {parts.core ? <path d={parts.core} fill={p.core} /> : null}
        {p.shade ? (
          <g clipPath={`url(#c${id})`}>
            <rect x={-2} y={-1} width={4} height={2} fill={`url(#h${id})`} />
            <rect x={-2} y={-1} width={4} height={2} fill={`url(#s${id})`} />
          </g>
        ) : null}
        {gl ? (
          <g opacity={clamp(p.gloss ?? 0) * 0.9}>
            <path d={gl.d} stroke="#ffffff" strokeWidth={gl.w} strokeLinecap="round" fill="none" />
            <circle cx={gl.dot.x} cy={gl.dot.y} r={gl.dot.r} fill="#ffffff" />
          </g>
        ) : null}
        {parts.cheeks?.map((c, i) => <ellipse key={`k${i}`} cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} fill={p.cheeks} />)}
        {parts.style === "happy"
          ? parts.eyes.map((e, i) => (
              <path key={i} d={`M${e.cx - e.rx * 1.3} ${e.cy + 0.02}Q${e.cx} ${e.cy - 0.1} ${e.cx + e.rx * 1.3} ${e.cy + 0.02}`} stroke={eye} strokeWidth={0.05} strokeLinecap="round" fill="none" />
            ))
          : parts.style !== "none"
            ? parts.eyes.map((e, i) => <ellipse key={i} cx={e.cx} cy={e.cy} rx={Math.max(0.002, e.rx)} ry={Math.max(0.002, e.ry)} fill={eye} />)
            : null}
        {parts.mouth === "talk" ? (
          <ellipse cx={parts.talkMouth.cx} cy={parts.talkMouth.cy} rx={parts.talkMouth.rx} ry={parts.talkMouth.ry} fill={p.mouthColor ?? "#1b1340"} />
        ) : parts.mouth === "open" ? (
          <ellipse cx={parts.mouthAt[0]} cy={parts.mouthAt[1]} rx={0.05} ry={0.04} fill={eye} />
        ) : parts.mouth ? (
          <path d={parts.mouth} stroke={eye} strokeWidth={0.04} strokeLinecap="round" fill="none" />
        ) : null}
      </g>
    </svg>
  );
};
