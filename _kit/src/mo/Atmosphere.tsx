import React, { CSSProperties, useMemo } from "react";
import { AbsoluteFill, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { C } from "./theme";
import { lerp, mod } from "./anim";
import { useLayout } from "./layout";

/** Radial ground: `inner` at (cx %, cy %) fading to `outer` at `spread` %. */
export const Backdrop: React.FC<{ inner?: string; outer?: string; cx?: number; cy?: number; spread?: number; style?: CSSProperties }> = ({
  inner = C.night, outer = C.ink, cx = 50, cy = 50, spread = 75, style,
}) => <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${cx}% ${cy}%, ${inner} 0%, ${outer} ${spread}%)`, ...style }} />;

/** Soft radial light. `color` is an "r,g,b" string. */
export const Glow: React.FC<{ x: number; y: number; size: number; color: string; opacity?: number; squash?: number; blend?: CSSProperties["mixBlendMode"] }> = ({
  x, y, size, color, opacity = 1, squash = 1, blend = "screen",
}) => {
  if (opacity <= 0.001 || size <= 0) return null;
  const h = size * squash;
  return (
    <div
      style={{
        position: "absolute", left: x - size / 2, top: y - h / 2, width: size, height: h, borderRadius: "50%",
        background: `radial-gradient(closest-side, rgba(${color},1) 0%, rgba(${color},0.42) 28%, rgba(${color},0.12) 62%, rgba(${color},0) 100%)`,
        opacity, mixBlendMode: blend, pointerEvents: "none",
      }}
    />
  );
};

/** Slow camera push applied to a scene's world layer (scale about the frame centre or `origin`). */
export const Drift: React.FC<{ dur: number; from?: number; to?: number; dx?: number; dy?: number; origin?: string; children: React.ReactNode }> = ({
  dur, from = 1, to = 1.06, dx = 0, dy = 0, origin, children,
}) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, dur], [0, 1]);
  return <AbsoluteFill style={{ transform: `translate(${dx * t}px, ${dy * t}px) scale(${lerp(from, to, t)})`, transformOrigin: origin }}>{children}</AbsoluteFill>;
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
      {parts.map((q, i) => {
        const y = area.y + mod(q.y + f * vy * q.sp, area.h);
        const x = q.x + Math.sin(f * 0.012 * q.sp + q.ph) * 26 * drift;
        const tw = 0.55 + 0.45 * Math.sin(f * 0.08 * q.sp + q.ph * 3);
        const a = q.a * tw * opacity;
        return (
          <g key={i}>
            {q.r > 1.8 ? <circle cx={x} cy={y} r={q.r * 3.2} fill={`rgba(${color},${a * 0.12})`} /> : null}
            <circle cx={x} cy={y} r={q.r} fill={`rgba(${color},${a})`} />
          </g>
        );
      })}
    </svg>
  );
};

/** Twinkling star field over the top `h` fraction of the frame; `band` adds a faint Milky Way diagonal. */
export const Stars: React.FC<{ n?: number; seed?: string; h?: number; opacity?: number; band?: number; dx?: number; dy?: number }> = ({
  n = 420, seed = "stars", h = 1, opacity = 1, band = 0, dx = 0, dy = 0,
}) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const stars = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        // a third of the stars crowd into the band (a diagonal strip) when band > 0
        const inBand = band > 0 && random(`${seed}b${i}`) < 0.35;
        let x = random(`${seed}x${i}`) * W, y = random(`${seed}y${i}`) * H * h;
        if (inBand) {
          const t = random(`${seed}t${i}`);
          x = t * W;
          y = (0.85 - 0.7 * t) * H * h + (random(`${seed}o${i}`) - 0.5) * H * 0.16;
        }
        return { x, y, r: lerp(0.4, 2.3, Math.pow(random(`${seed}r${i}`), 3.2)), ph: random(`${seed}p${i}`) * 6.28, warm: random(`${seed}w${i}`) < 0.25 };
      }),
    [n, seed, W, H, h, band],
  );
  if (opacity <= 0.001) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity, transform: `translate(${dx}px, ${dy}px)` }}>
      {band > 0 ? (
        <g style={{ filter: "blur(40px)" }} opacity={0.22 * band}>
          <path d={`M ${-W * 0.1} ${H * h * 0.95} L ${W * 1.1} ${H * h * 0.05} L ${W * 1.1} ${H * h * 0.25} L ${-W * 0.1} ${H * h * 1.15} Z`} fill="rgb(150,170,230)" />
        </g>
      ) : null}
      {stars.map((s, i) => {
        const a = 0.45 + 0.4 * Math.sin(f * 0.07 + s.ph);
        return (
          <g key={i}>
            {s.r > 1.6 ? <circle cx={s.x} cy={s.y} r={s.r * 3.4} fill={`rgba(200,214,255,${a * 0.1})`} /> : null}
            <circle cx={s.x} cy={s.y} r={s.r} fill={s.warm ? `rgba(255,232,200,${a})` : `rgba(225,232,255,${a})`} />
          </g>
        );
      })}
    </svg>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.78 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />
);

/** Film grain from a pre-baked noise tile, re-offset every frame; normal blend so it also dithers near-black gradients. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.045 }) => {
  const f = useCurrentFrame();
  const x = Math.floor(random(`gx${f}`) * 512);
  const y = Math.floor(random(`gy${f}`) * 512);
  return <AbsoluteFill style={{ backgroundImage: `url(${staticFile("grain.png")})`, backgroundPosition: `${x}px ${y}px`, opacity, pointerEvents: "none" }} />;
};

export const Flash: React.FC<{ at: number; peak?: number; attack?: number; decay?: number; color?: string }> = ({ at, peak = 0.8, attack = 2, decay = 16, color = "#FFF8EC" }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at - attack, at, at + decay], [0, peak, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0.001) return null;
  return <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: "screen" }} />;
};
