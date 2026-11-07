import React, { CSSProperties, useId, useMemo } from "react";
import { AbsoluteFill, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { lerp, mod } from "./anim";
import { useLayout } from "./layout";

/** SVG-safe unique id. */
export const useUid = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

/** Soft radial light (HTML layer). `color` is an "r,g,b" string. */
export const Glow: React.FC<{
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
  squash?: number;
  blend?: CSSProperties["mixBlendMode"];
}> = ({ x, y, size, color, opacity = 1, squash = 1, blend = "screen" }) => {
  if (opacity <= 0.001 || size <= 0) return null;
  const h = size * squash;
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - h / 2,
        width: size,
        height: h,
        borderRadius: "50%",
        background: `radial-gradient(closest-side, rgba(${color},1) 0%, rgba(${color},0.42) 28%, rgba(${color},0.12) 62%, rgba(${color},0) 100%)`,
        opacity,
        mixBlendMode: blend,
        pointerEvents: "none",
      }}
    />
  );
};

/** Soft radial light inside an SVG (keeps depth order inside a Band). */
export const GlowS: React.FC<{ x: number; y: number; r: number; color: string; opacity?: number; squash?: number }> = ({
  x,
  y,
  r,
  color,
  opacity = 1,
  squash = 1,
}) => {
  const id = useUid("gl");
  if (opacity <= 0.001 || r <= 0) return null;
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={1} />
          <stop offset="0.3" stopColor={`rgb(${color})`} stopOpacity={0.42} />
          <stop offset="0.65" stopColor={`rgb(${color})`} stopOpacity={0.1} />
          <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={r} ry={r * squash} fill={`url(#${id})`} opacity={opacity} style={{ mixBlendMode: "screen" }} />
    </>
  );
};

interface DustProps {
  count: number;
  seed: string;
  area?: { x: number; y: number; w: number; h: number };
  color?: string;
  opacity?: number;
  size?: [number, number];
  drift?: number;
  vy?: number;
}

/** Floating motes. Positive `vy` falls, negative rises; wraps inside `area`. */
export const Dust: React.FC<DustProps> = ({ count, seed, area: areaProp, color = "255,236,200", opacity = 0.6, size = [0.8, 2.4], drift = 1, vy = -0.25 }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const area = areaProp ?? { x: 0, y: 0, w: W, h: H };
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: area.x + random(`${seed}x${i}`) * area.w,
        y: random(`${seed}y${i}`) * area.h,
        r: lerp(size[0], size[1], Math.pow(random(`${seed}r${i}`), 2)),
        ph: random(`${seed}p${i}`) * Math.PI * 2,
        sp: 0.5 + random(`${seed}s${i}`),
        a: 0.3 + 0.7 * random(`${seed}a${i}`),
      })),
    [count, seed, area.x, area.w, area.h, size[0], size[1]],
  );
  if (opacity <= 0.001) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
      {parts.map((p, i) => {
        const y = area.y + mod(p.y + f * vy * p.sp, area.h);
        const x = p.x + Math.sin(f * 0.012 * p.sp + p.ph) * 26 * drift;
        const tw = 0.55 + 0.45 * Math.sin(f * 0.08 * p.sp + p.ph * 3);
        const a = p.a * tw * opacity;
        return (
          <g key={i}>
            {p.r > 1.8 ? <circle cx={x} cy={y} r={p.r * 3.2} fill={`rgba(${color},${a * 0.12})`} /> : null}
            <circle cx={x} cy={y} r={p.r} fill={`rgba(${color},${a})`} />
          </g>
        );
      })}
    </svg>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Film grain from a pre-baked noise tile, re-offset every frame. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => {
  const f = useCurrentFrame();
  const x = Math.floor(random(`gx${f}`) * 512);
  const y = Math.floor(random(`gy${f}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("grain.png")})`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const Flash: React.FC<{ at: number; peak?: number; attack?: number; decay?: number; color?: string }> = ({
  at,
  peak = 0.8,
  attack = 2,
  decay = 16,
  color = "#FFF8EC",
}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at - attack, at, at + decay], [0, peak, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0.001) return null;
  return <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: "screen" }} />;
};

/** Volumetric light shafts fanning from (x, y). Angles in degrees, 90 = straight down. */
export const Rays: React.FC<{
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
}> = ({ x, y, count, length, spread = [0, 360], width = [8, 40], color = "255,230,170", opacity = 0.4, rotate = 0, seed = "rays", blur = 0, flicker = 0.5 }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const id = useUid("ray");
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

/** Low drifting mist bands (HTML), e.g. dawn valleys or the flood's spray. */
export const Mist: React.FC<{ y: number; h?: number; count?: number; color?: string; opacity?: number; seed?: string; speed?: number }> = ({
  y,
  h = 160,
  count = 8,
  color = "230,226,220",
  opacity = 0.35,
  seed = "mist",
  speed = 0.4,
}) => {
  const f = useCurrentFrame();
  const { W } = useLayout();
  if (opacity <= 0.001) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const w = lerp(500, 1100, random(`${seed}w${i}`));
        const xx = mod(random(`${seed}x${i}`) * (W + w) + f * speed * (0.5 + random(`${seed}s${i}`)), W + w) - w / 2;
        const yy = y + (random(`${seed}y${i}`) - 0.5) * h;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: xx - w / 2,
              top: yy - h * 0.4,
              width: w,
              height: h * 0.8,
              borderRadius: "50%",
              background: `radial-gradient(closest-side, rgba(${color},${opacity}), rgba(${color},0))`,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

/** Darken (or tint) the whole frame, e.g. for night falling or a dream's edges. */
export const Tint: React.FC<{ color?: string; opacity: number; blend?: CSSProperties["mixBlendMode"] }> = ({ color = "#000", opacity, blend }) =>
  opacity > 0.001 ? <AbsoluteFill style={{ background: color, opacity, mixBlendMode: blend, pointerEvents: "none" }} /> : null;
