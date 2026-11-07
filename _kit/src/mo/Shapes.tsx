import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { Svg } from "./Svg";
import { drawOn, ease, lerp, prog, seg } from "./anim";

const ringPath = (cx: number, cy: number, r: number, amp: number, k: number, ph: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const t = (i / 200) * Math.PI * 2;
    const rr = r + amp * Math.sin(t * k + ph) * Math.sin(t * 3 + ph * 0.7);
    pts.push(`${i === 0 ? "M" : "L"} ${(cx + rr * Math.cos(t)).toFixed(1)} ${(cy + rr * Math.sin(t)).toFixed(1)}`);
  }
  return `${pts.join(" ")} Z`;
};

/** A word spoken: waveform rings emitted from a point at a steady cadence (film [0], "the Word"). */
export const VoiceRings: React.FC<{ x: number; y: number; every?: number; life?: number; speed?: number; opacity?: number; until?: number }> = ({
  x, y, every = 24, life = 120, speed = 7.5, opacity = 1, until = Infinity,
}) => {
  const f = useCurrentFrame();
  const rings: { d: string; a: number }[] = [];
  for (let e = 0; e <= Math.min(f, until); e += every) {
    const age = f - e;
    if (age > life) continue;
    const k = e / every;
    const fade = Math.pow(1 - age / life, 1.5);
    rings.push({ d: ringPath(x, y, 36 + age * speed, 12 * fade + 2, 6 + (k % 4) * 2, age * 0.22 + k), a: fade });
  }
  if (opacity <= 0.001) return null;
  return (
    <>
      <Svg style={{ filter: "blur(6px)", opacity: 0.7 * opacity, mixBlendMode: "screen" }}>
        {rings.map((r, i) => <path key={i} d={r.d} fill="none" stroke={`rgba(255,200,120,${r.a})`} strokeWidth={6} />)}
      </Svg>
      <Svg style={{ opacity, mixBlendMode: "screen" }}>
        {rings.map((r, i) => <path key={i} d={r.d} fill="none" stroke={`rgba(255,240,215,${r.a * 0.9})`} strokeWidth={1.6} />)}
      </Svg>
    </>
  );
};

const FLAME = "M 0 0 C -30 -8 -28 -52 0 -104 C 28 -52 30 -8 0 0 Z";

/** Three-layer flickering flame whose base sits at (x, y) (a lamp, a candle, the light of reason). */
export const Flame: React.FC<{ x: number; y: number; scale?: number; ph?: number; opacity?: number }> = ({ x, y, scale = 1, ph = 0, opacity = 1 }) => {
  const f = useCurrentFrame();
  if (scale <= 0 || opacity <= 0) return null;
  const sy = 1 + 0.12 * Math.sin(f * 0.9 + ph) + 0.06 * Math.sin(f * 1.7 + ph * 2.3);
  const skew = 7 * Math.sin(f * 0.55 + ph);
  return (
    <svg width={200} height={220} viewBox="-100 -170 200 220" style={{ position: "absolute", left: x - 100, top: y - 170, overflow: "visible", opacity }}>
      <g transform={`scale(${scale} ${scale * sy}) skewX(${skew})`}>
        <path d={FLAME} fill="#FF6A14" opacity={0.85} />
        <path d={FLAME} fill="#FFAE3A" transform="translate(0 2) scale(0.7)" />
        <path d={FLAME} fill="#FFF0B8" transform="translate(0 4) scale(0.4)" />
      </g>
    </svg>
  );
};

/** Sacred-geometry Trinity seal (film [0-1]): circle, triangle, three interlocking circles, dial ticks; progress 0..1. */
export const Trinity: React.FC<{ cx: number; cy: number; r: number; progress: number; rotate?: number; opacity?: number; strokeWidth?: number; color?: string }> = ({
  cx, cy, r, progress: p, rotate = 0, opacity = 0.6, strokeWidth = 1.6, color = "#E3B860",
}) => {
  const tri = [-90, 30, 150].map((a) => {
    const t = (a * Math.PI) / 180;
    return [Math.cos(t) * r, Math.sin(t) * r];
  });
  const triLen = 3 * r * Math.sqrt(3);
  const rho = r * 0.5;
  const d = rho / Math.sqrt(3);
  const ticks = Array.from({ length: 36 }, (_, i) => (i / 36) * Math.PI * 2);
  const circ = (rr: number) => 2 * Math.PI * rr;
  const common = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round" as const };
  return (
    <Svg style={{ opacity }}>
      <g transform={`translate(${cx} ${cy}) rotate(${rotate})`}>
        <circle r={r} transform="rotate(-90)" {...common} style={drawOn(circ(r), seg(p, 0, 0.5))} />
        <circle r={r * 1.035} transform="rotate(90)" {...common} strokeWidth={strokeWidth * 0.6} style={drawOn(circ(r * 1.035), seg(p, 0.1, 0.6))} />
        <path d={`M ${tri[0][0]} ${tri[0][1]} L ${tri[1][0]} ${tri[1][1]} L ${tri[2][0]} ${tri[2][1]} Z`} {...common} style={drawOn(triLen, seg(p, 0.15, 0.65))} />
        {[-90, 30, 150].map((a, i) => {
          const t = (a * Math.PI) / 180;
          return <circle key={a} cx={Math.cos(t) * d} cy={Math.sin(t) * d} r={rho} transform={`rotate(${a + 180} ${Math.cos(t) * d} ${Math.sin(t) * d})`} {...common} style={drawOn(circ(rho), seg(p, 0.3 + i * 0.06, 0.8 + i * 0.06))} />;
        })}
        <circle r={r * 0.16} {...common} style={drawOn(circ(r * 0.16), seg(p, 0.55, 0.95))} />
        {ticks.map((t, i) => {
          const long = i % 3 === 0;
          const a = r * 1.07;
          const b = r * (long ? 1.13 : 1.1);
          const tp = seg(p, 0.55 + (i / ticks.length) * 0.4, 0.62 + (i / ticks.length) * 0.4);
          return <line key={i} x1={Math.cos(t) * a} y1={Math.sin(t) * a} x2={Math.cos(t) * lerp(a, b, tp)} y2={Math.sin(t) * lerp(a, b, tp)} {...common} strokeWidth={strokeWidth * 0.8} opacity={tp > 0 ? 1 : 0} />;
        })}
      </g>
    </Svg>
  );
};

type P2 = [number, number];

/** Right half of a standing figure (feet at y = 0, crown near y = -380); mirrored for the left half. */
const HALF: P2[] = [[12, -304], [62, -284], [76, -240], [82, -170], [86, -100], [80, -74], [68, -78], [62, -150], [54, -222], [44, -232], [38, -150], [48, -92], [44, -40], [38, 0], [10, 0], [6, -84], [0, -100]];
const SKIRT: P2[] = [[12, -304], [58, -284], [70, -236], [76, -168], [80, -104], [74, -80], [64, -84], [58, -150], [50, -216], [38, -226], [34, -160], [56, -96], [72, 0], [0, 0]];

export const figureOutline = (female = false): P2[] => {
  const half = female ? SKIRT : HALF;
  return [...half, ...half.slice().reverse().map(([x, y]) => [-x, y] as P2)];
};

const inside = (pts: P2[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Points filling the figure (body polygon + head circle), deterministic per seed. */
export const figurePoints = (n: number, seed: string, female = false) => {
  const pl = figureOutline(female);
  const out: P2[] = [];
  let i = 0;
  while (out.length < n && i < n * 20) {
    const x = (random(`${seed}x${i}`) - 0.5) * 180;
    const y = -random(`${seed}y${i}`) * 380;
    i++;
    if (Math.hypot(x, y + 340) < 34 || inside(pl, x, y)) out.push([x, y]);
  }
  return out;
};

/**
 * A human figure of light assembled from particles (film [0-2]): particles fly in between `start` and
 * `start + dur`, then the outline glows. Feet at (x, y); 380 px tall at scale 1. For a symbolic "the human person"
 * beat; real people in a story are cel-shaded Humans.
 */
export const HumanForm: React.FC<{ x: number; y: number; scale?: number; start: number; dur?: number; seed?: string; female?: boolean; count?: number; from?: (i: number) => P2; color?: string }> = ({
  x, y, scale = 1, start, dur = 90, seed = "human", female = false, count = 700, from, color = "255,236,200",
}) => {
  const f = useCurrentFrame();
  const pts = useMemo(() => figurePoints(count, seed, female), [count, seed, female]);
  const outline = useMemo(() => figureOutline(female), [female]);
  const origin = (i: number): P2 => (from ? from(i) : [(random(`${seed}fx${i}`) - 0.5) * 900, -random(`${seed}fy${i}`) * 900 - 200]);
  const done = prog(f, start + dur - 10, 40, ease.outSoft);
  const outlinePath = `M ${outline.map(([px, py]) => `${(px * scale).toFixed(1)} ${(py * scale).toFixed(1)}`).join(" L ")} Z`;
  return (
    <>
      <Svg style={{ mixBlendMode: "screen" }}>
        <g transform={`translate(${x} ${y})`}>
          {pts.map(([px, py], i) => {
            const dl = random(`${seed}d${i}`) * 0.35;
            const p = prog(f, start + dl * dur, dur * 0.65, ease.inOut);
            if (p <= 0) return null;
            const [ox, oy] = origin(i);
            const cx = lerp(ox * scale, px * scale, p) + Math.sin(f * 0.05 + i) * 1.2 * done;
            const cy = lerp(oy * scale, py * scale, p);
            const tw = 0.7 + 0.3 * Math.sin(f * 0.13 + i * 1.7);
            return <circle key={i} cx={cx} cy={cy} r={(1 + random(`${seed}r${i}`) * 1.4) * scale} fill={`rgba(${color},${(0.35 + 0.6 * p) * tw})`} />;
          })}
          <circle cx={0} cy={-340 * scale} r={34 * scale} fill="none" stroke={`rgba(${color},${0.8 * done})`} strokeWidth={1.6} />
          <path d={outlinePath} fill={`rgba(${color},${0.06 * done})`} stroke={`rgba(${color},${0.75 * done})`} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      </Svg>
      <Svg style={{ filter: "blur(10px)", opacity: done * 0.8, mixBlendMode: "screen" }}>
        <g transform={`translate(${x} ${y})`}>
          <path d={outlinePath} fill={`rgba(${color},0.25)`} />
          <circle cx={0} cy={-340 * scale} r={34 * scale} fill={`rgba(${color},0.25)`} />
        </g>
      </Svg>
    </>
  );
};
