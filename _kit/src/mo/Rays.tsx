import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { lerp } from "./anim";
import { useLayout } from "./layout";

interface RaysProps {
  id: string;
  x: number;
  y: number;
  count: number;
  length: number;
  spread?: [number, number];
  width?: [number, number];
  color?: string;
  opacity?: number;
  rotate?: number;
  seed?: string;
  blur?: number;
  flicker?: number;
}

/** Volumetric light shafts fanning from (x, y). Angles in degrees, 90 = straight down. `id` must be unique in the scene. */
export const Rays: React.FC<RaysProps> = ({
  id, x, y, count, length, spread = [0, 360], width = [8, 40], color = "255,230,170", opacity = 0.4, rotate = 0, seed = "rays", blur = 0, flicker = 0.5,
}) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const rays = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const t = (i + random(`${seed}t${i}`) * 0.8) / count;
        return {
          a: spread[0] + (spread[1] - spread[0]) * t,
          w: lerp(width[0], width[1], random(`${seed}w${i}`)),
          l: length * (0.55 + 0.45 * random(`${seed}l${i}`)),
          ph: random(`${seed}p${i}`) * Math.PI * 2,
          sp: 0.03 + random(`${seed}s${i}`) * 0.06,
        };
      }),
    [count, seed, spread[0], spread[1], width[0], width[1], length],
  );
  if (opacity <= 0.001) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", filter: blur ? `blur(${blur}px)` : undefined, mixBlendMode: "screen", opacity }}>
      <defs>
        <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={x} cy={y} r={length}>
          <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={1} />
          <stop offset="0.45" stopColor={`rgb(${color})`} stopOpacity={0.38} />
          <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g fill={`url(#${id})`}>
        {rays.map((r, i) => {
          const a = ((r.a + rotate) * Math.PI) / 180;
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          const ex = x + dx * r.l;
          const ey = y + dy * r.l;
          const hw = r.w / 2;
          const fl = 1 - flicker + flicker * (0.5 + 0.5 * Math.sin(f * r.sp + r.ph));
          return <polygon key={i} points={`${x},${y} ${ex - dy * hw},${ey + dx * hw} ${ex + dy * hw},${ey - dx * hw}`} opacity={fl} />;
        })}
      </g>
    </svg>
  );
};
