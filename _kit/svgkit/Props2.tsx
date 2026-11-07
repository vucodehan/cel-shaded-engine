import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { Pt, lerp, mod, range, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { GlowS, useUid } from "./Atmos";
import { useLayout } from "./layout";
import { NoScale, useBand, useInk, useRim, useStage } from "./Stage";
import { Animal } from "./Animals";
import { Tent } from "./Props";

/** Props for Exodus through Ruth. Same conventions as Props.tsx: feet at y = 0, band scale applied, up is negative. */

type Base = { x: number; y?: number; s?: number; flip?: boolean };
const useBase = (x: number, y?: number) => {
  const band = useBand();
  return y ?? band.gy(x);
};

/** Papyrus basket coated with tar (Moses among the reeds). `bob` rocks it on water; `open` lifts the lid. */
export const Basket: React.FC<Base & { bob?: number; open?: number }> = ({ x, y, s = 1, bob = 0, open = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const c = ink("#7A5A30");
  const r = Math.sin(f * 0.06) * 3 * bob;
  const dy = Math.sin(f * 0.05) * 2 * bob;
  return (
    <g transform={`translate(${x} ${gy + dy}) rotate(${r}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={46} ry={5} fill="rgba(0,0,0,0.3)" />
      {open > 0 ? (
        <g opacity={open}>
          <ellipse cx={2} cy={-24} rx={24} ry={9} fill={ink("#E8DCC4")} />
          <circle cx={20} cy={-29} r={7} fill={ink("#8A5A3E")} />
        </g>
      ) : null}
      <path d="M -44 -22 Q -46 0 -30 4 L 30 4 Q 46 0 44 -22 Z" fill={c} stroke={rim(0.9)} strokeWidth={1.3} />
      {[-30, -18, -6, 6, 18, 30].map((xx) => (
        <line key={xx} x1={xx} y1={-20} x2={xx * 0.9} y2={3} stroke={tone(c, -0.3)} strokeWidth={1.2} />
      ))}
      <path d="M -44 -12 Q 0 -6 44 -12" stroke={tone(c, -0.3)} strokeWidth={1.2} fill="none" />
      <g transform={`rotate(${-open * 55} -44 -22)`}>
        <path d="M -46 -22 Q 0 -44 46 -22 Z" fill={tone(c, 0.08)} stroke={rim(0.9)} strokeWidth={1.3} />
      </g>
    </g>
  );
};

/** A stack of sun-dried mud bricks; `p` 0..1 lays it course by course. */
export const Bricks: React.FC<Base & { rows?: number; cols?: number; p?: number }> = ({ x, y, s = 1, rows = 5, cols = 6, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const bw = 22;
  const bh = 10;
  const n = Math.round(rows * cols * Math.min(1, Math.max(0, p)));
  const out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (i >= n) continue;
      const xx = (c - cols / 2 + (r % 2) * 0.5) * bw;
      out.push(<rect key={i} x={xx} y={-(r + 1) * bh} width={bw - 1.5} height={bh - 1.5} fill={ink(mixHex("#9A7048", "#B88A5A", random(`bk${i}`)))} stroke={rim(0.5)} strokeWidth={0.8} />);
    }
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={cols * bw * 0.6} ry={4} fill="rgba(0,0,0,0.3)" />
      {out}
    </g>
  );
};

/** A snake. `rear` 0..1 raises the head; `p` grows it in (a staff becoming a snake). */
export const Serpent: React.FC<Base & { rear?: number; p?: number; color?: string; len?: number; glow?: number; speed?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  rear = 0.6,
  p = 1,
  color = "#4A5A2A",
  len = 120,
  glow = 0,
  speed = 1,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame() * speed;
  if (p <= 0) return null;
  const pts: Pt[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([lerp(-len / 2, len / 3, t), -5 + Math.sin(t * Math.PI * 3 - f * 0.18) * 7 * (1 - t * 0.4)]);
  }
  const neck: Pt = [len / 3 + 14, -10 - 30 * rear];
  const head: Pt = [len / 3 + 24 + 4 * rear, -14 - 50 * rear];
  pts.push(neck, head);
  const d = smooth(pts, false, 0.4);
  const c = glow > 0 ? mixHex(ink(color), "#FFD890", glow) : ink(color);
  const tongue = Math.sin(f * 0.5) > 0.3;
  return (
    <g transform={`translate(${x} ${gy}) scale(${(flip ? -s : s) * p} ${s * p})`} opacity={Math.min(1, p * 1.5)}>
      <ellipse cx={0} cy={0} rx={len * 0.55} ry={4} fill="rgba(0,0,0,0.28)" />
      <path d={d} stroke={rim(1)} strokeWidth={11.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <path d={d} stroke={c} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={tone(c, 0.25)} strokeWidth={2} fill="none" strokeDasharray="3 7" />
      <ellipse cx={head[0] + 6} cy={head[1]} rx={11} ry={6.5} fill={c} stroke={rim(1)} strokeWidth={1.2} />
      <circle cx={head[0] + 9} cy={head[1] - 2} r={1.6} fill="#F2E2A0" />
      {tongue ? <path d={`M ${head[0] + 16} ${head[1] + 1} l 9 1 l 3 -3 M ${head[0] + 25} ${head[1] + 2} l 3 3`} stroke="#C8302A" strokeWidth={1.2} fill="none" /> : null}
      {glow > 0 ? <GlowS x={0} y={-20} r={len * 0.7} squash={(40) / (len * 0.7)} color="255,200,110" opacity={Math.min(1, (0.15 * glow) * 2.6)} /> : null}
    </g>
  );
};

/** One frog; `hop` 0..1 lifts it mid-leap. */
export const Frog: React.FC<Base & { hop?: number }> = ({ x, y, s = 1, flip = false, hop = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink("#4E6A2E");
  return (
    <g transform={`translate(${x} ${gy - hop * 18 * s}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={hop * 18} rx={10} ry={2} fill="rgba(0,0,0,0.25)" />
      <path d={`M -10 -2 Q -12 -12 -2 -13 Q 8 -14 11 -7 Q 12 -2 6 0 Z`} fill={c} stroke={rim(0.8)} strokeWidth={0.8} />
      <circle cx={6} cy={-12} r={2.6} fill={tone(c, 0.2)} />
      <circle cx={6.6} cy={-12.4} r={1} fill="#101008" />
      <path d={hop > 0.2 ? `M -8 -3 L -16 4` : `M -8 -3 Q -12 -1 -6 0`} stroke={tone(c, -0.2)} strokeWidth={2.5} strokeLinecap="round" fill="none" />
    </g>
  );
};

/** Frogs scattered along the ground between x0 and x1, hopping now and then. `p` 0..1 fills the ground. */
export const Frogs: React.FC<{ x0: number; x1: number; n?: number; seed?: string; p?: number; dy?: [number, number]; s?: number }> = ({ x0, x1, n = 40, seed = "fg", p = 1, dy = [0, 24], s = 1 }) => {
  const f = useCurrentFrame();
  const m = Math.round(n * Math.min(1, p));
  return (
    <>
      {Array.from({ length: m }, (_, i) => {
        const hop = Math.pow(Math.max(0, Math.sin(f * 0.09 + i * 1.7)), 6);
        const xx = lerp(x0, x1, random(`${seed}x${i}`)) + mod(f * 0.4 * (random(`${seed}v${i}`) - 0.5), 60);
        return <FrogAt key={i} x={xx} dy={range(`${seed}d${i}`, dy[0], dy[1])} s={s * range(`${seed}s${i}`, 0.8, 1.2)} flip={random(`${seed}f${i}`) > 0.5} hop={hop} />;
      })}
    </>
  );
};
const FrogAt: React.FC<{ x: number; dy: number; s: number; flip: boolean; hop: number }> = ({ x, dy, s, flip, hop }) => {
  const band = useBand();
  return <Frog x={x} y={band.gy(x) + dy} s={s} flip={flip} hop={hop} />;
};

/** Insects filling an area (screen space): gnats, flies, or locusts streaming across. `p` 0..1 density. */
export const Swarm: React.FC<{ kind?: "gnats" | "flies" | "locusts"; n?: number; p?: number; area?: { x: number; y: number; w: number; h: number }; seed?: string; dir?: 1 | -1; speed?: number }> = ({
  kind = "flies",
  n = 260,
  p = 1,
  area,
  seed = "sw",
  dir = 1,
  speed = 1,
}) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const a = area ?? { x: 0, y: 0, w: W, h: H };
  const m = Math.round(n * Math.min(1, Math.max(0, p)));
  if (m <= 0) return null;
  const col = kind === "locusts" ? "#4A3E20" : kind === "gnats" ? "#1E1C18" : "#0E0C0A";
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: m }, (_, i) => {
        const v = range(`${seed}v${i}`, 0.6, 1.4) * speed;
        const depth = range(`${seed}z${i}`, 0.4, 1.3);
        if (kind === "locusts") {
          const xx = a.x + mod(random(`${seed}x${i}`) * (a.w + 200) + f * v * 7 * dir * depth, a.w + 200) - 100;
          const yy = a.y + random(`${seed}y${i}`) * a.h + Math.sin(f * 0.15 + i) * 10;
          const L = 9 * depth;
          const wing = Math.sin(f * 1.7 + i) > 0 ? 1 : 0.3;
          return (
            <g key={i} transform={`translate(${xx} ${yy}) scale(${dir} 1)`} opacity={0.55 + 0.4 * depth}>
              <ellipse cx={0} cy={0} rx={L} ry={L * 0.28} fill={col} />
              <path d={`M ${-L * 0.2} 0 L ${-L * 0.9} ${-L * 0.9 * wing} L ${L * 0.4} ${-L * 0.15} Z`} fill={`rgba(200,190,150,${0.35 * depth})`} />
            </g>
          );
        }
        const jitter = kind === "gnats" ? 26 : 60;
        const xx = a.x + random(`${seed}x${i}`) * a.w + Math.sin(f * 0.13 * v + i * 3.1) * jitter + Math.sin(f * 0.37 * v + i) * jitter * 0.3;
        const yy = a.y + random(`${seed}y${i}`) * a.h + Math.cos(f * 0.11 * v + i * 1.3) * jitter * 0.8;
        const r = (kind === "gnats" ? 1.9 : 3.6) * depth;
        return (
          <g key={i} opacity={0.55 + 0.45 * depth}>
            {kind === "flies" ? <ellipse cx={xx} cy={yy - r} rx={r * 1.7} ry={r * 0.9} fill="rgba(210,210,220,0.35)" /> : null}
            <circle cx={xx} cy={yy} r={r} fill={col} />
          </g>
        );
      })}
    </svg>
  );
};

/** Hail streaking down (screen space), bouncing on `ground`; `fire` 0..1 mixes in streaks of flame. */
export const Hail: React.FC<{ intensity?: number; fire?: number; ground?: number; seed?: string; angle?: number }> = ({ intensity = 1, fire = 0, ground, seed = "hl", angle = 14 }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const gy = ground ?? H * 0.82;
  const n = Math.round(150 * intensity);
  const dx = Math.tan((angle * Math.PI) / 180);
  if (n <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: n }, (_, i) => {
        const life = range(`${seed}l${i}`, 18, 30);
        const t = mod(f + random(`${seed}o${i}`) * life, life) / life;
        const g = gy + range(`${seed}g${i}`, -40, H * 0.16);
        const x0 = random(`${seed}x${i}`) * (W + 300) - 150;
        const yy = lerp(-40, g, t);
        const xx = x0 + yy * dx;
        const flame = random(`${seed}f${i}`) < fire * 0.35;
        const r = range(`${seed}r${i}`, 2, 4.5);
        return (
          <g key={i}>
            <line x1={xx} y1={yy} x2={xx - 40 * dx} y2={yy - 40} stroke={flame ? "rgba(255,150,60,0.6)" : "rgba(235,240,250,0.35)"} strokeWidth={flame ? 3 : 1.4} />
            <circle cx={xx} cy={yy} r={r} fill={flame ? "#FFD090" : "#F2F6FF"} />
            {t > 0.9 ? <circle cx={xx} cy={g} r={(t - 0.9) * 140} fill="none" stroke={flame ? "rgba(255,170,80,0.5)" : "rgba(240,244,255,0.45)"} strokeWidth={1.4} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

/** Pillar of cloud by day and of fire by night, rising from (x, y) past the top of the frame (screen space). */
export const CloudPillar: React.FC<{ x: number; y: number; w?: number; fire?: number; opacity?: number; seed?: string; lean?: number; smoke?: number }> = ({ x, y, w = 220, fire = 0, opacity = 1, seed = "cp", lean = 0, smoke = 0 }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const id = useUid("cp");
  if (opacity <= 0.001) return null;
  const top = -260;
  const span = y - top;
  const outer = mixHex(mixHex("#9C9890", "#B83A14", fire), "#2E2A28", smoke);
  const mid = mixHex(mixHex("#D8D4CC", "#F07A28", fire), "#4A4542", smoke);
  const inner = mixHex(mixHex("#F8F6F0", "#FFD486", fire), "#6A6460", smoke * 0.85);
  const core = mixHex(mixHex("#FFFFFF", "#FFF4D6", fire), "#8A847E", smoke * 0.7);
  const layers = [
    { k: 0, w: 0.62, c: outer, a: 0.75 },
    { k: 1, w: 0.5, c: mid, a: 0.85 },
    { k: 2, w: 0.38, c: inner, a: 0.9 },
    { k: 3, w: 0.18, c: core, a: 0.4 + 0.4 * fire },
  ];
  const column = (lw: number, k: number) => {
    const L: Pt[] = [];
    const R: Pt[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const yy = y - u * span;
      const cx = x + lean * u * span + Math.sin(u * 6 + f * 0.02 + k) * w * 0.06;
      const half = w * lw * (0.7 + 0.55 * u);
      const wl = Math.sin(u * 11 - f * 0.07 + k * 1.9) * w * 0.07 + Math.sin(u * 27 - f * 0.11 + k) * w * 0.035;
      const wr = Math.sin(u * 13 - f * 0.08 + k * 2.3) * w * 0.07 + Math.sin(u * 23 - f * 0.1 + k * 0.7) * w * 0.035;
      L.push([cx - half + wl, yy]);
      R.push([cx + half + wr, yy]);
    }
    return smooth([...L, ...R.reverse()], true, 0.3);
  };
  const puffs = Array.from({ length: 22 }, (_, i) => {
    const u = mod(random(`${seed}u${i}`) + f * 0.0022, 1);
    const side = random(`${seed}s${i}`) > 0.5 ? 1 : -1;
    const r = w * range(`${seed}r${i}`, 0.12, 0.22) * (0.8 + 0.6 * u);
    return { u, x: x + lean * u * span + side * w * 0.48 * (0.7 + 0.55 * u), y: y - u * span, r, i };
  });
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", opacity }}>
      <defs>
        <filter id={`${id}b`} x="-60%" y="-20%" width="220%" height="140%">
          <feGaussianBlur stdDeviation={w * 0.07} />
        </filter>
        <linearGradient id={`${id}m`} x1="0" y1={y} x2="0" y2={top} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.1" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={1} />
        </linearGradient>
        <mask id={`${id}k`}>
          <rect x={x - w * 3} y={top - 50} width={w * 6} height={span + 100} fill={`url(#${id}m)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}k)`} filter={`url(#${id}b)`}>
        {layers.map((l) => (
          <path key={l.k} d={column(l.w, l.k)} fill={l.c} opacity={l.a} />
        ))}
        {puffs.map((pf) => (
          <circle key={pf.i} cx={pf.x} cy={pf.y} r={pf.r} fill={pf.i % 2 ? mid : outer} opacity={0.6} />
        ))}
      </g>
      {fire > 0
        ? Array.from({ length: 18 }, (_, i) => {
            const u = mod(random(`${seed}e${i}`) + f * 0.01, 1);
            return <circle key={`e${i}`} cx={x + (random(`${seed}ex${i}`) - 0.5) * w * 1.2 + lean * u * span} cy={y - u * span} r={range(`${seed}er${i}`, 1.5, 3.5)} fill={`rgba(255,236,180,${fire * (1 - u)})`} />;
          })
        : null}
    </svg>
  );
};

/**
 * The sea split in two (screen space, seen from the shore): two walls of water converge on the vanishing point
 * (vx, vy) with a dry seabed between. `open` 0..1 raises the walls; `close` 0..1 brings them crashing back.
 */
export const PartedSea: React.FC<{ open?: number; close?: number; vx?: number; vy?: number; gap?: number; seed?: string; night?: number }> = ({ open = 1, close = 0, vx, vy, gap, seed = "ps", night = 0 }) => {
  const f = useCurrentFrame();
  const { W, H, v } = useLayout();
  const id = useUid("ps");
  const X = vx ?? W / 2;
  const Y = vy ?? (v ? 1060 : 600);
  const g = (gap ?? (v ? 560 : 900)) * (1 - close * 0.95);
  const hgt = (v ? 1500 : 1000) * open * (1 - close * 0.3);
  const wallA = Math.min(1, open * 3);
  const water = mixHex("#2A6A80", "#0C1E2C", night);
  const deep = mixHex("#0E2A3A", "#040A12", night);
  const foam = mixHex("#E6F2F4", "#8A9AA8", night);
  const sand = mixHex("#8A7454", "#2A2418", night);
  const lx = X - g / 2;
  const rx = X + g / 2;
  const left = `M -200 ${H + 60} L ${lx} ${H + 60} L ${X - 18} ${Y} L ${X - 22} ${Y - hgt * 0.05} L -200 ${H - hgt} Z`;
  const right = `M ${W + 200} ${H + 60} L ${rx} ${H + 60} L ${X + 18} ${Y} L ${X + 22} ${Y - hgt * 0.05} L ${W + 200} ${H - hgt} Z`;
  const crest = (side: -1 | 1) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const ex = side < 0 ? lerp(-200, X - 22, t) : lerp(W + 200, X + 22, t);
      const ey = lerp(H - hgt, Y - hgt * 0.05, t) + Math.sin(t * 20 + f * 0.25 * side) * (10 * (1 - t) + 2) * open;
      pts.push([ex, ey]);
    }
    return pts;
  };
  const face = (side: -1 | 1) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const ex = side < 0 ? lerp(lx, X - 18, t) : lerp(rx, X + 18, t);
      pts.push([ex + Math.sin(t * 9 + f * 0.1) * 6 * (1 - t), lerp(H + 60, Y, t)]);
    }
    return pts;
  };
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1={H - hgt} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={tone(water, 0.2)} />
          <stop offset="0.35" stopColor={water} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`${id}f`} x1={X} y1="0" x2={X - g * 0.9} y2="0" gradientUnits="userSpaceOnUse" spreadMethod="reflect">
          <stop offset="0" stopColor="#000000" stopOpacity={0.35} />
          <stop offset="0.5" stopColor="#000000" stopOpacity={0.1} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0.06} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1={Y} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={tone(sand, -0.2)} />
          <stop offset="1" stopColor={sand} />
        </linearGradient>
      </defs>
      <g opacity={Math.min(1, open * 1.6) * (1 - Math.min(1, close * 1.4))}>
        <path d={`M ${lx} ${H + 60} L ${X - 18} ${Y} L ${X + 18} ${Y} L ${rx} ${H + 60} Z`} fill={`url(#${id}s)`} />
        {Array.from({ length: 14 }, (_, i) => {
          const t = Math.pow(i / 14, 1.6);
          const yy = lerp(Y, H + 60, t);
          const hw = lerp(18, g / 2, t);
          return <line key={i} x1={X - hw * 0.9} y1={yy} x2={X + hw * 0.9} y2={yy} stroke={`rgba(30,22,14,${0.12 + 0.1 * t})`} strokeWidth={1 + 2 * t} />;
        })}
      </g>
      {([-1, 1] as const).map((side) => (
        <g key={side} opacity={wallA}>
          <path d={side < 0 ? left : right} fill={`url(#${id}w)`} />
          <path d={side < 0 ? `M ${lx} ${H + 60} L ${X - 18} ${Y} L ${X - 22} ${Y - hgt * 0.05} L -200 ${H - hgt} L -200 ${H + 60} Z` : `M ${rx} ${H + 60} L ${X + 18} ${Y} L ${X + 22} ${Y - hgt * 0.05} L ${W + 200} ${H - hgt} L ${W + 200} ${H + 60} Z`} fill={`url(#${id}f)`} />
          {Array.from({ length: 22 }, (_, i) => {
            const t = random(`${seed}t${side}${i}`);
            const ex = side < 0 ? lerp(-200, lx, t) : lerp(W + 200, rx, t);
            const top = lerp(H - hgt, H + 60, 0) + (side < 0 ? (ex + 200) / (lx + 200) : (W + 200 - ex) / (W + 200 - rx)) * 0;
            const len = range(`${seed}l${side}${i}`, 60, 220);
            const yy = mod(random(`${seed}y${side}${i}`) * hgt + f * range(`${seed}v${side}${i}`, 2, 5), hgt) + H - hgt;
            return <line key={i} x1={ex} y1={Math.max(top, yy - len)} x2={ex} y2={yy} stroke={`rgba(220,240,250,${0.08 + 0.1 * random(`${seed}a${side}${i}`)})`} strokeWidth={range(`${seed}w${side}${i}`, 1, 4)} />;
          })}
          <path d={smooth(face(side), false)} stroke={`rgba(230,246,250,${0.55 * open})`} strokeWidth={3} fill="none" />
          <path d={smooth(crest(side), false)} stroke={foam} strokeWidth={10 * open + 2} fill="none" strokeLinecap="round" opacity={0.85 * Math.min(1, open * 3)} />
          {Array.from({ length: 16 }, (_, i) => {
            const t = random(`${seed}sp${side}${i}`);
            const c = crest(side)[Math.floor(t * 24)];
            const u = mod(f * 0.03 + random(`${seed}su${side}${i}`), 1);
            return <circle key={`sp${i}`} cx={c[0] + (random(`${seed}sx${side}${i}`) - 0.5) * 40} cy={c[1] - u * 50} r={2 + 3 * (1 - u)} fill={foam} opacity={0.6 * (1 - u) * open} />;
          })}
        </g>
      ))}
    </svg>
  );
};

/** The two stone tablets of the covenant. `write` 0..1 inscribes them; `glow` lights them; `broken` 0..1 shatters. */
export const Tablets: React.FC<Base & { glow?: number; write?: number; broken?: number }> = ({ x, y, s = 1, glow = 0, write = 1, broken = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const stone = glow > 0 ? mixHex(ink("#A8A296"), "#F2EAD8", glow * 0.6) : ink("#A8A296");
  const slab = (k: number) => {
    const ox = k * 36 + broken * k * 60;
    const rot = broken * k * 28;
    const drop = broken * 40;
    const lines = Array.from({ length: 5 }, (_, i) => i).filter((i) => i / 5 < write);
    return (
      <g key={k} transform={`translate(${ox} ${drop}) rotate(${rot} 0 -40)`}>
        <path d="M -30 0 L -30 -70 Q 0 -100 30 -70 L 30 0 Z" fill={stone} stroke={glow > 0 ? `rgba(255,240,200,${0.6 + 0.4 * glow})` : rim(0.9)} strokeWidth={1.6} />
        {lines.map((i) => (
          <line key={i} x1={-20} y1={-66 + i * 12} x2={lerp(-20, 20, Math.min(1, write * 5 - i))} y2={-66 + i * 12} stroke={glow > 0 ? "#5A3A1A" : tone(stone, -0.45)} strokeWidth={2.4} strokeDasharray="4 3" />
        ))}
        {broken > 0 ? <path d="M -30 -40 L -8 -30 L 4 -48 L 30 -36" stroke={tone(stone, -0.6)} strokeWidth={2} fill="none" /> : null}
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {glow > 0 ? <GlowS x={0} y={-50} r={150} squash={(110) / (150)} color="255,226,160" opacity={Math.min(1, (0.18 * glow) * 2.6)} /> : null}
      {slab(-1)}
      {slab(1)}
    </g>
  );
};

/** The golden calf on a stone plinth. */
export const GoldenCalf: React.FC<Base & { glow?: number; p?: number }> = ({ x, y, s = 1, flip = false, glow = 0.5, p = 1 }) => {
  const band = useBand();
  const gy = useBase(x, y);
  const k = s * band.k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  if (p <= 0) return null;
  return (
    <g opacity={Math.min(1, p * 1.4)}>
      <g transform={`translate(${x} ${gy}) scale(${k})`}>
        <ellipse cx={0} cy={0} rx={70} ry={7} fill="rgba(0,0,0,0.35)" />
        <rect x={-54} y={-34} width={108} height={34} fill={ink("#7A7064")} stroke={rim(0.8)} strokeWidth={1.3} />
        <rect x={-60} y={-40} width={120} height={8} fill={ink("#8A8074")} stroke={rim(0.8)} strokeWidth={1.1} />
        {glow > 0 ? <GlowS x={0} y={-90} r={140} squash={(90) / (140)} color="255,200,90" opacity={Math.min(1, (0.2 * glow * (0.85 + 0.15 * Math.sin(f * 0.1))) * 2.6)} /> : null}
      </g>
      <Animal kind="cow" x={x} y={gy - 40 * k} s={s * 1.05 * p} flip={flip} tint="#D8A830" />
      <g transform={`translate(${x} ${gy - 40 * k}) scale(${flip ? -k : k} ${k})`}>
        <path d="M 38 -56 Q 36 -66 44 -68 M 46 -55 Q 48 -64 56 -64" stroke="#F2D070" strokeWidth={3} fill="none" strokeLinecap="round" />
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx={range(`gc${i}`, -30, 40)} cy={-range(`gcy${i}`, 30, 60)} r={1.6} fill="#FFF6D0" opacity={Math.max(0, Math.sin(f * 0.2 + i * 1.3))} />
        ))}
      </g>
    </g>
  );
};

/** The ark of the covenant: a gold chest with two cherubim, carrying poles through its rings. Base at y. */
export const ArkCovenant: React.FC<Base & { glow?: number; poles?: boolean }> = ({ x, y, s = 1, flip = false, glow = 0.4, poles = true }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const gold = ink("#D2A43C");
  const g2 = tone(gold, -0.25);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      {glow > 0 ? <GlowS x={0} y={-46} r={130} squash={(80) / (130)} color="255,220,140" opacity={Math.min(1, (0.2 * glow * (0.9 + 0.1 * Math.sin(f * 0.08))) * 2.6)} /> : null}
      <rect x={-44} y={-40} width={88} height={40} fill={gold} stroke={rim(1)} strokeWidth={1.4} />
      <rect x={-44} y={-40} width={88} height={6} fill={tone(gold, 0.2)} />
      <rect x={-48} y={-46} width={96} height={7} fill={g2} stroke={rim(0.9)} strokeWidth={1} />
      <rect x={-30} y={-30} width={60} height={20} fill="none" stroke={g2} strokeWidth={1.4} />
      {poles ? <line x1={-96} y1={-14} x2={96} y2={-14} stroke={ink("#8A6A3A")} strokeWidth={5} strokeLinecap="round" /> : null}
      {[-1, 1].map((k) => (
        <g key={k}>
          <circle cx={k * 38} cy={-14} r={5} fill="none" stroke={tone(gold, 0.1)} strokeWidth={2} />
          <path d={`M ${k * 30} -46 Q ${k * 32} -60 ${k * 24} -66 Q ${k * 18} -70 ${k * 20} -60 L ${k * 22} -46 Z`} fill={gold} stroke={rim(0.8)} strokeWidth={1} />
          <circle cx={k * 25} cy={-70} r={5} fill={gold} />
          <path d={`M ${k * 28} -62 Q ${k * 40} -96 ${k * 4} -84 Q ${k * 16} -78 ${k * 26} -56 Z`} fill={tone(gold, 0.15)} stroke={rim(0.8)} strokeWidth={1} />
        </g>
      ))}
    </g>
  );
};

/** A heavy cluster of grapes hanging from (x, y) (the spies' harvest from Eshcol). Plain SVG units. */
export const GrapeBunch: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => {
  const ink = useInk();
  const rim = useRim();
  const berries: [number, number][] = [];
  for (let row = 0; row < 7; row++) {
    const n = 7 - row;
    for (let i = 0; i < n; i++) berries.push([(i - (n - 1) / 2) * 13 + (row % 2) * 2, 14 + row * 12]);
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 0 L 0 14" stroke={ink("#4A3A20")} strokeWidth={3} />
      <path d="M 2 6 Q 26 -6 34 10 Q 18 14 2 6 Z" fill={ink("#4E6A2A")} />
      {berries.map(([bx, by], i) => (
        <circle key={i} cx={bx} cy={by} r={7.5} fill={ink(mixHex("#4A2A5A", "#6A3A7A", random(`gb${i}`)))} stroke={rim(0.5)} strokeWidth={0.8} />
      ))}
    </g>
  );
};

/** The bronze serpent on a pole (Numbers 21). */
export const BronzeSerpent: React.FC<Base & { glow?: number; h?: number }> = ({ x, y, s = 1, glow = 0.5, h = 230 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const bronze = glow > 0 ? mixHex(ink("#B0702E"), "#FFD08A", glow * 0.4) : ink("#B0702E");
  const coil = smooth(
    Array.from({ length: 16 }, (_, i) => {
      const t = i / 15;
      return [Math.sin(t * Math.PI * 4) * 16, -h * 0.35 - t * h * 0.55] as Pt;
    }),
    false,
    0.4,
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {glow > 0 ? <GlowS x={0} y={-h * 0.8} r={120} squash={(120) / (120)} color="255,190,110" opacity={Math.min(1, (0.2 * glow * (0.85 + 0.15 * Math.sin(f * 0.1))) * 2.6)} /> : null}
      <ellipse cx={0} cy={0} rx={30} ry={5} fill="rgba(0,0,0,0.35)" />
      <line x1={0} y1={0} x2={0} y2={-h} stroke={ink("#6A4A2A")} strokeWidth={7} strokeLinecap="round" />
      <line x1={-40} y1={-h * 0.86} x2={40} y2={-h * 0.86} stroke={ink("#6A4A2A")} strokeWidth={6} strokeLinecap="round" />
      <path d={coil} stroke={rim(1)} strokeWidth={11} fill="none" strokeLinecap="round" opacity={0.6} />
      <path d={coil} stroke={bronze} strokeWidth={8.5} fill="none" strokeLinecap="round" />
      <ellipse cx={10} cy={-h * 0.92} rx={12} ry={7} fill={bronze} stroke={rim(1)} strokeWidth={1.2} />
      <path d={coil} stroke={tone(bronze, 0.35)} strokeWidth={2} fill="none" strokeDasharray="2 8" />
    </g>
  );
};

/** A dry-stone wall along the ground between x0 and x1 (vineyard walls, field boundaries). */
export const StoneWall: React.FC<{ x0: number; x1: number; h?: number; seed?: string }> = ({ x0, x1, h = 40, seed = "sw" }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const k = band.k;
  const stones: React.ReactNode[] = [];
  const rows = Math.max(2, Math.round(h / 13));
  for (let r = 0; r < rows; r++) {
    let xx = x0 + (r % 2) * 9 * k;
    let i = 0;
    while (xx < x1) {
      const w = range(`${seed}${r}w${i}`, 16, 28) * k;
      const gy = band.gy(xx + w / 2);
      stones.push(<rect key={`${r}-${i}`} x={xx} y={gy - (r + 1) * 13 * k} width={w - 2} height={12 * k} rx={4 * k} fill={ink(mixHex("#6E665A", "#8E8676", random(`${seed}${r}c${i}`)))} stroke={rim(0.6)} strokeWidth={1} />);
      xx += w;
      i++;
    }
  }
  return <g>{stones}</g>;
};

/** City gate: two towers, an arched passage, and two doors. `open` swings the doors; `doors={false}` leaves it gaping. */
export const Gate: React.FC<Base & { open?: number; doors?: boolean; color?: string; w?: number }> = ({ x, y, s = 1, open = 0, doors = true, color = "#8A7458", w = 300 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const hw = w / 2;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={hw + 40} ry={8} fill="rgba(0,0,0,0.35)" />
      <rect x={-hw} y={-150} width={w} height={150} fill={tone(c, -0.1)} stroke={rim(0.8)} strokeWidth={1.4} />
      {[-1, 1].map((k) => (
        <g key={k}>
          <rect x={k * hw - 40} y={-200} width={80} height={200} fill={c} stroke={rim(0.9)} strokeWidth={1.4} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={k * hw - 40 + i * 22} y={-214} width={14} height={14} fill={c} />
          ))}
          <rect x={k * hw - 8} y={-170} width={16} height={24} fill={tone(c, -0.6)} />
        </g>
      ))}
      {Array.from({ length: Math.floor(w / 24) - 3 }, (_, i) => (
        <rect key={i} x={-hw + 44 + i * 24} y={-162} width={14} height={12} fill={tone(c, -0.1)} />
      ))}
      <path d="M -48 0 L -48 -84 Q 0 -130 48 -84 L 48 0 Z" fill={tone(c, -0.65)} />
      {doors ? (
        <>
          <path d={`M -46 0 L -46 -84 Q -24 -108 0 -112 L 0 0 Z`} fill={ink("#5A3E24")} stroke={rim(0.7)} strokeWidth={1.2} transform={`translate(-46 0) scale(${1 - open * 0.85} 1) translate(46 0)`} />
          <path d={`M 46 0 L 46 -84 Q 24 -108 0 -112 L 0 0 Z`} fill={ink("#5A3E24")} stroke={rim(0.7)} strokeWidth={1.2} transform={`translate(46 0) scale(${1 - open * 0.85} 1) translate(-46 0)`} />
        </>
      ) : null}
    </g>
  );
};

/** The doors and bar of a city gate, as a single object to carry (Samson at Gaza). Plain SVG units, base at (x, y). */
export const GateDoors: React.FC<{ x: number; y: number; s?: number; rot?: number }> = ({ x, y, s = 1, rot = 0 }) => {
  const ink = useInk();
  const rim = useRim();
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M -46 0 L -46 -84 Q 0 -124 46 -84 L 46 0 Z" fill={ink("#5A3E24")} stroke={rim(0.9)} strokeWidth={1.4} />
      <line x1={0} y1={0} x2={0} y2={-112} stroke={ink("#3A2614")} strokeWidth={2} />
      <line x1={-56} y1={-50} x2={56} y2={-50} stroke={ink("#7A5A34")} strokeWidth={7} strokeLinecap="round" />
      {[-30, -10, 10, 30].map((xx) => (
        <circle key={xx} cx={xx} cy={-20} r={2.4} fill={ink("#2A1A0E")} />
      ))}
    </g>
  );
};

/** A hand mill: a round lower stone and an upper stone turned by a wooden beam; `turn` is the beam angle (radians). */
export const Millstone: React.FC<Base & { turn?: number }> = ({ x, y, s = 1, turn = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const st = ink("#7A746A");
  const bx = Math.sin(turn) * 120;
  const depthFront = Math.cos(turn) > 0;
  const beam = <line x1={0} y1={-46} x2={bx} y2={-40 + Math.cos(turn) * 6} stroke={ink("#6A4A2A")} strokeWidth={7} strokeLinecap="round" />;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={80} ry={10} fill="rgba(0,0,0,0.35)" />
      {!depthFront ? beam : null}
      <path d="M -70 -20 L -70 0 Q 0 14 70 0 L 70 -20 Z" fill={tone(st, -0.1)} stroke={rim(0.8)} strokeWidth={1.3} />
      <ellipse cx={0} cy={-20} rx={70} ry={11} fill={st} stroke={rim(0.8)} strokeWidth={1.2} />
      <path d="M -52 -44 L -52 -24 Q 0 -14 52 -24 L 52 -44 Z" fill={st} stroke={rim(0.9)} strokeWidth={1.3} />
      <ellipse cx={0} cy={-44} rx={52} ry={9} fill={tone(st, 0.12)} stroke={rim(0.8)} strokeWidth={1.1} />
      <ellipse cx={0} cy={-44} rx={9} ry={3} fill="#1A1814" />
      {depthFront ? beam : null}
    </g>
  );
};

/** The temple of Dagon: a pillared hall with a crowded roof; `collapse` 0..1 brings it down. */
export const Temple: React.FC<Base & { collapse?: number; w?: number; h?: number; crowd?: number; seed?: string }> = ({ x, y, s = 1, collapse = 0, w = 760, h = 260, crowd = 1, seed = "tp" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const stone = ink("#B09A78");
  const fall = Math.max(0, collapse);
  const cols = 8;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={12} fill="rgba(0,0,0,0.35)" />
      <rect x={-w / 2 - 20} y={-16} width={w + 40} height={16} fill={tone(stone, -0.2)} stroke={rim(0.7)} strokeWidth={1.2} />
      <rect x={-w / 2} y={-h} width={w} height={h - 16} fill={`rgba(16,12,8,0.7)`} opacity={1 - fall * 0.6} />
      {Array.from({ length: cols }, (_, i) => {
        const cx = -w / 2 + 40 + (i / (cols - 1)) * (w - 80);
        const central = i === 3 || i === 4;
        const tilt = fall * (central ? (i === 3 ? -24 : 24) : random(`${seed}t${i}`) * 40 - 20);
        const drop = fall * fall * (central ? 30 : 60);
        return (
          <g key={i} transform={`translate(0 ${drop}) rotate(${tilt} ${cx} -16)`}>
            <rect x={cx - (central ? 22 : 16)} y={-h + 20} width={central ? 44 : 32} height={h - 36} fill={central ? tone(stone, 0.06) : stone} stroke={rim(0.8)} strokeWidth={1.3} />
            <rect x={cx - (central ? 22 : 16)} y={-h + 20} width={10} height={h - 36} fill={tone(stone, 0.14)} />
            <rect x={cx - (central ? 28 : 22)} y={-h + 8} width={central ? 56 : 44} height={14} fill={tone(stone, -0.1)} />
          </g>
        );
      })}
      {[-1, 1].map((k) => {
        const rot = fall * k * 16;
        const drop = fall * fall * h * 0.75;
        return (
          <g key={k} transform={`translate(${k * fall * 40} ${drop}) rotate(${rot} ${k * w * 0.25} ${-h})`}>
            <rect x={k < 0 ? -w / 2 - 30 : 0} y={-h - 30} width={w / 2 + 30} height={30} fill={stone} stroke={rim(0.9)} strokeWidth={1.4} />
            {crowd > 0
              ? Array.from({ length: 16 }, (_, i) => {
                  const px = (k < 0 ? -w / 2 - 10 : 10) + (i / 16) * (w / 2);
                  const bob = Math.sin(f * 0.2 + i) * 1.5 * (1 - fall);
                  return (
                    <g key={i} opacity={crowd}>
                      <circle cx={px + 8} cy={-h - 52 + bob} r={6} fill={ink("#2A1E16")} />
                      <rect x={px + 3} y={-h - 46 + bob} width={10} height={16} fill={ink(mixHex("#6A3A28", "#3A4A5A", random(`${seed}c${k}${i}`)))} />
                    </g>
                  );
                })
              : null}
          </g>
        );
      })}
      {fall > 0
        ? Array.from({ length: 20 }, (_, i) => {
            const bx = range(`${seed}bx${i}`, -w / 2, w / 2);
            const t = Math.min(1, fall * 1.4 - random(`${seed}bt${i}`) * 0.4);
            if (t <= 0) return null;
            const by = lerp(-h - 20, -12, t * t);
            return <rect key={`b${i}`} x={bx} y={by} width={range(`${seed}bw${i}`, 16, 40)} height={range(`${seed}bh${i}`, 10, 22)} fill={stone} stroke={rim(0.6)} strokeWidth={1} transform={`rotate(${t * range(`${seed}br${i}`, -90, 90)} ${bx} ${by})`} />;
          })
        : null}
    </g>
  );
};

/** One great mountain standing on the band's ground (Sinai, Nebo, Tabor, Hor). */
export const Mountain: React.FC<Base & { w?: number; h?: number; seed?: string; color?: string; snow?: boolean; glow?: number; dome?: boolean }> = ({ x, y, s = 1, w = 900, h = 420, seed = "mt", color = "#6A5A50", glow = 0, dome = false }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const id = useUid("mt");
  const pts = mountainPts(w, h, seed, dome);
  const top = smooth(pts, false, 0.15);
  const peak = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
  const base = 420;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <defs>
        <linearGradient id={id} x1="0" y1={-h} x2="0" y2={base * 0.4} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={tone(c, 0.14)} />
          <stop offset="1" stopColor={tone(c, -0.4)} />
        </linearGradient>
      </defs>
      <path d={`${top} L ${w / 2 + 60} ${base} L ${-w / 2 - 60} ${base} Z`} fill={`url(#${id})`} />
      {dome ? (
        <>
          <path d={`${smooth(pts.filter((q) => q[0] >= peak[0] - w * 0.05), false, 0.15)} L ${w / 2 + 60} ${base} L ${peak[0] + w * 0.12} ${base} Q ${peak[0] + w * 0.06} ${-h * 0.4} ${peak[0] - w * 0.05} ${peak[1]} Z`} fill="rgba(0,0,0,0.14)" />
          {Array.from({ length: 70 }, (_, i) => {
            const tx = lerp(-w * 0.46, w * 0.46, random(`${seed}tx${i}`));
            const q = pts[Math.round(((tx + w / 2) / w) * (pts.length - 1))];
            const ty = lerp(q[1] + 10, 0, Math.pow(random(`${seed}ty${i}`), 0.8));
            return <ellipse key={i} cx={tx} cy={ty} rx={7 + 5 * random(`${seed}tr${i}`)} ry={5 + 3 * random(`${seed}tr${i}`)} fill={tone(c, -0.3)} opacity={0.5} />;
          })}
        </>
      ) : (
        <>
          <path d={`M ${peak[0]} ${peak[1]} L ${peak[0] + w * 0.08} ${-h * 0.5} L ${peak[0] + w * 0.2} ${base} L ${w / 2 + 60} ${base} L ${w / 2} 0 Z`} fill="rgba(0,0,0,0.16)" />
          {Array.from({ length: 7 }, (_, i) => {
            const sx = lerp(-w * 0.36, w * 0.36, i / 6);
            return <path key={i} d={`M ${peak[0] + (sx - peak[0]) * 0.1} ${peak[1] + 24} L ${peak[0] + (sx - peak[0]) * 0.55} ${-h * 0.45 + (random(`${seed}g${i}`) - 0.5) * 30} L ${sx * 1.15} 10`} stroke={tone(c, -0.28)} strokeWidth={2} fill="none" opacity={0.45} />;
          })}
        </>
      )}
      <path d={top} stroke={rim(0.8)} strokeWidth={1.6} fill="none" />
      {glow > 0 ? <GlowS x={peak[0]} y={peak[1]} r={w * 0.3} squash={(h * 0.3) / (w * 0.3)} color="255,200,120" opacity={Math.min(1, (0.25 * glow) * 2.6)} /> : null}
    </g>
  );
};

/** Ridge profile of a <Mountain>: a peaked massif with shoulders and broken crags, or a rounded dome (Tabor). */
const mountainPts = (w: number, h: number, seed: string, dome = false): Pt[] => {
  const pts: Pt[] = [];
  const N = 48;
  const cx = range(`${seed}cx`, -0.08, 0.08);
  let walk = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const c = 0.5 + cx;
    const u = t < c ? (c - t) / c : (t - c) / (1 - c);
    if (dome) {
      const env = Math.pow(Math.max(0, 1 - Math.pow(u, 2.2)), 0.75);
      const bump = 0.025 * Math.sin(t * Math.PI * 7 + range(`${seed}ph`, 0, 6)) * env;
      pts.push([lerp(-w / 2, w / 2, t), -h * (env + bump)]);
      continue;
    }
    const env = Math.max(0, 1 - Math.pow(u, 0.8));
    walk = walk * 0.6 + (random(`${seed}w${i}`) - 0.5) * 0.22;
    const shoulder = 0.1 * Math.sin(t * Math.PI * 4 + range(`${seed}ph`, 0, 6)) * env;
    const crag = random(`${seed}c${i}`) > 0.82 ? -0.06 * env : 0;
    pts.push([lerp(-w / 2, w / 2, t), -h * Math.min(1.02, env * (0.9 + shoulder + walk * 0.5) + crag)]);
  }
  return pts;
};

/** Peak position of a <Mountain> (local units, before band scale), for placing fire, smoke, or a figure on top. */
export const mountainPeak = (w = 900, h = 420, seed = "mt", dome = false): Pt => mountainPts(w, h, seed, dome).reduce((a, b) => (b[1] < a[1] ? b : a));

/** Jericho's walls: a massive wall with towers, Rahab's house in the wall with a scarlet cord. `fall` 0..1 brings it down. */
export const Walls: React.FC<Base & { w?: number; h?: number; fall?: number; cord?: number; seed?: string; lit?: number; rahab?: boolean }> = ({ x, y, s = 1, w = 1000, h = 190, fall = 0, cord = 0, seed = "jw", lit = 0, rahab = true }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const c = ink("#9A8460");
  const shake = fall > 0 && fall < 0.6 ? Math.sin(f * 2.1) * 3 * (1 - fall) : 0;
  const rx = w * 0.3;
  const segs = 14;
  const sw = w / segs;
  return (
    <g transform={`translate(${x + shake} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.55} ry={10} fill="rgba(0,0,0,0.35)" />
      {Array.from({ length: 12 }, (_, i) => {
        const hx = range(`${seed}hx${i}`, -w / 2 + 40, w / 2 - 40);
        const hh = range(`${seed}hh${i}`, 40, 90);
        const drop = Math.min(1, fall * 1.6) * (h + hh);
        return <rect key={`h${i}`} x={hx - 30} y={-h - hh + 40 + drop} width={60} height={hh} fill={tone(c, -0.2)} stroke={rim(0.5)} strokeWidth={1} opacity={1 - Math.min(1, fall * 1.4)} />;
      })}
      {Array.from({ length: segs }, (_, i) => {
        const sx = -w / 2 + i * sw;
        const isRahab = rahab && Math.abs(sx + sw / 2 - rx) < sw * 0.6;
        const t = isRahab ? 0 : Math.min(1, Math.max(0, fall * 1.5 - random(`${seed}f${i}`) * 0.5));
        const hh = h * (1 - t * 0.85);
        const tilt = t * (random(`${seed}r${i}`) - 0.5) * 30;
        return (
          <g key={i} transform={`rotate(${tilt} ${sx + sw / 2} 0)`}>
            <rect x={sx} y={-hh} width={sw + 1} height={hh} fill={mixHex(c, tone(c, -0.15), random(`${seed}c${i}`))} stroke={rim(0.7)} strokeWidth={1.2} />
            {Array.from({ length: Math.floor(hh / 18) }, (_, k) => (
              <line key={k} x1={sx} y1={-k * 18} x2={sx + sw} y2={-k * 18} stroke={tone(c, -0.3)} strokeWidth={0.8} opacity={0.6} />
            ))}
            {t < 0.2 ? [0, 1].map((k) => <rect key={`b${k}`} x={sx + 6 + k * (sw / 2)} y={-hh - 14} width={sw / 2 - 12} height={14} fill={c} />) : null}
            {i % 4 === 0 && t < 0.3 ? <rect x={sx - 10} y={-hh - 40} width={sw + 20} height={40} fill={tone(c, 0.05)} stroke={rim(0.8)} strokeWidth={1.2} /> : null}
          </g>
        );
      })}
      {rahab ? <rect x={rx - 20} y={-h * 0.62} width={40} height={30} fill={lit > 0 ? `rgba(255,190,110,${0.4 + 0.5 * lit})` : "#0C0A08"} stroke={rim(0.8)} strokeWidth={1.2} /> : null}
      {rahab && cord > 0 ? <path d={`M ${rx + 4} ${-h * 0.62 + 28} Q ${rx + 10 + Math.sin(f * 0.05) * 4} ${-h * 0.62 + 28 + h * 0.3 * cord} ${rx + 6} ${-h * 0.62 + 28 + h * 0.6 * cord}`} stroke="#C8241E" strokeWidth={4} fill="none" strokeLinecap="round" /> : null}
      {fall > 0.05 && fall < 0.995
        ? Array.from({ length: 26 }, (_, i) => {
            const bx = range(`${seed}dx${i}`, -w / 2, w / 2);
            if (Math.abs(bx - rx) < sw) return null;
            const u = mod(f * 0.012 + random(`${seed}du${i}`), 1);
            const k = Math.min(1, fall * 3) * Math.min(1, (1 - fall) * 4);
            return <GlowS key={`d${i}`} x={bx + (u - 0.5) * 60} y={-h * 0.3 - u * h * 0.8} r={50 + 90 * u} color="190,170,140" opacity={0.9 * (1 - u) * k} />;
          })
        : null}
    </g>
  );
};

/** A wool fleece on the threshing floor; `wet` 0..1 darkens it with dew, `dew` 0..1 sparkles the ground around it. */
export const Fleece: React.FC<Base & { wet?: number; dew?: number }> = ({ x, y, s = 1, wet = 0, dew = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const f = useCurrentFrame();
  const c = ink(mixHex("#E2D8C4", "#9A9488", wet));
  const pts: Pt[] = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [Math.cos(a) * 46 * range(`fl${i}`, 0.85, 1.1), Math.sin(a) * 9 - 6];
  });
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {dew > 0
        ? Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={range(`fd${i}`, -110, 110)} cy={range(`fdy${i}`, -4, 10)} r={1.4} fill="#F4FAFF" opacity={dew * (0.4 + 0.6 * Math.max(0, Math.sin(f * 0.15 + i)))} />
          ))
        : null}
      <path d={smooth(pts, true, 0.6)} fill={c} />
      {Array.from({ length: 10 }, (_, i) => (
        <circle key={i} cx={range(`flc${i}`, -36, 36)} cy={range(`flcy${i}`, -12, -2)} r={5} fill={tone(c, 0.1)} />
      ))}
      {wet > 0
        ? Array.from({ length: 8 }, (_, i) => <circle key={`w${i}`} cx={range(`fw${i}`, -30, 30)} cy={range(`fwy${i}`, -12, -2)} r={1.6} fill="#FFFFFF" opacity={wet * (0.5 + 0.5 * Math.sin(f * 0.2 + i))} />)
        : null}
    </g>
  );
};

/** A rock-cut winepress: a low stone basin in the ground. */
export const Winepress: React.FC<Base & { w?: number }> = ({ x, y, s = 1, w = 200 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const st = ink("#7A7064");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <path d={`M ${-w / 2} 6 L ${-w / 2 + 10} -34 L ${w / 2 - 10} -34 L ${w / 2} 6 Z`} fill={tone(st, -0.1)} stroke={rim(0.8)} strokeWidth={1.3} />
      <ellipse cx={0} cy={-34} rx={w / 2 - 10} ry={12} fill={tone(st, 0.1)} stroke={rim(0.8)} strokeWidth={1.2} />
      <ellipse cx={0} cy={-34} rx={w / 2 - 24} ry={8} fill="#1A1410" />
    </g>
  );
};

/** A heap of threshed grain with a few sheaves leaning on it. */
export const GrainHeap: React.FC<Base & { w?: number; glow?: number }> = ({ x, y, s = 1, w = 180, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(mixHex("#D8B060", "#FFE6A0", glow * 0.5));
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={7} fill="rgba(0,0,0,0.3)" />
      <path d={`M ${-w / 2} 0 Q ${-w / 4} ${-w * 0.36} 0 ${-w * 0.4} Q ${w / 4} ${-w * 0.36} ${w / 2} 0 Z`} fill={c} stroke={rim(0.8)} strokeWidth={1.2} />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={range(`gh${i}`, -w * 0.4, w * 0.4)} cy={-range(`ghy${i}`, 4, w * 0.3)} r={1.4} fill={tone(c, -0.2)} />
      ))}
      {glow > 0 ? <GlowS x={0} y={-w * 0.2} r={w * 0.8} squash={(w * 0.4) / (w * 0.8)} color="255,220,140" opacity={Math.min(1, (0.18 * glow) * 2.6)} /> : null}
    </g>
  );
};

/** A pagan cult object: a Baal figure on a plinth, or a carved Asherah pole. `fall` 0..1 topples it. */
export const Idol: React.FC<Base & { kind?: "baal" | "asherah" | "dagon"; fall?: number }> = ({ x, y, s = 1, flip = false, kind = "baal", fall = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const rot = fall * 88;
  if (kind === "asherah") {
    const wood = ink("#6A4A2A");
    return (
      <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s}) rotate(${rot})`}>
        <ellipse cx={0} cy={0} rx={24} ry={4} fill="rgba(0,0,0,0.35)" />
        <path d="M -8 0 L -6 -200 L 6 -200 L 8 0 Z" fill={wood} stroke={rim(0.8)} strokeWidth={1.2} />
        {[-150, -110, -70].map((yy, i) => (
          <path key={i} d={`M 0 ${yy} Q ${i % 2 ? -30 : 30} ${yy - 20} ${i % 2 ? -44 : 44} ${yy - 46}`} stroke={wood} strokeWidth={5} fill="none" strokeLinecap="round" />
        ))}
        <circle cx={0} cy={-208} r={10} fill={wood} stroke={rim(0.8)} strokeWidth={1} />
      </g>
    );
  }
  const bronze = ink(kind === "dagon" ? "#8A8A7A" : "#9A7A3A");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s}) rotate(${rot})`}>
      <ellipse cx={0} cy={0} rx={40} ry={5} fill="rgba(0,0,0,0.35)" />
      <rect x={-30} y={-30} width={60} height={30} fill={ink("#6E665A")} stroke={rim(0.8)} strokeWidth={1.2} />
      <path d="M -14 -30 L -12 -110 Q -14 -126 0 -128 Q 14 -126 12 -110 L 14 -30 Z" fill={bronze} stroke={rim(0.9)} strokeWidth={1.2} />
      <circle cx={0} cy={-140} r={12} fill={bronze} stroke={rim(0.9)} strokeWidth={1.2} />
      {kind === "baal" ? <path d="M -12 -148 Q -24 -166 -14 -176 M 12 -148 Q 24 -166 14 -176" stroke={bronze} strokeWidth={4} fill="none" strokeLinecap="round" /> : null}
      <path d="M 10 -116 L 34 -150" stroke={bronze} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
};

/** The tabernacle (tent of meeting): a long tent of dark curtains inside a linen-screened court. */
export const Tabernacle: React.FC<Base & { w?: number; glow?: number }> = ({ x, y, s = 1, w = 420, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const hw = w / 2;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={hw + 160} ry={10} fill="rgba(0,0,0,0.3)" />
      {glow > 0 ? <GlowS x={0} y={-80} r={hw + 80} squash={(110) / (hw + 80)} color="255,226,170" opacity={Math.min(1, (0.2 * glow) * 2.6)} /> : null}
      <path d={`M ${-hw} 0 L ${-hw} -110 L ${-hw + 30} -136 L ${hw - 30} -136 L ${hw} -110 L ${hw} 0 Z`} fill={ink("#3A2A26")} stroke={rim(0.9)} strokeWidth={1.4} />
      <path d={`M ${-hw + 30} -136 L ${hw - 30} -136 L ${hw} -110 L ${-hw} -110 Z`} fill={ink("#5A3A30")} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={-hw + (i + 1) * (w / 10)} y1={-110} x2={-hw + (i + 1) * (w / 10)} y2={-4} stroke={ink("#2A1E1A")} strokeWidth={1.2} />
      ))}
      <rect x={-50} y={-100} width={100} height={100} fill={ink("#6A2A44")} stroke={rim(0.8)} strokeWidth={1.2} />
      <rect x={-50} y={-100} width={33} height={100} fill={ink("#2A3A6A")} />
      <rect x={17} y={-100} width={33} height={100} fill={ink("#8A2A22")} />
      <rect x={-hw - 140} y={-60} width={w + 280} height={60} fill={ink("#DCD2BE")} opacity={0.9} stroke={rim(0.6)} strokeWidth={1} />
      {Array.from({ length: 16 }, (_, i) => (
        <line key={`p${i}`} x1={-hw - 140 + i * ((w + 280) / 15)} y1={-64} x2={-hw - 140 + i * ((w + 280) / 15)} y2={0} stroke={ink("#8A7A5A")} strokeWidth={2} />
      ))}
      <rect x={-60} y={-60} width={120} height={60} fill={ink("#6A2A44")} opacity={0.85} />
    </g>
  );
};

/** A house front with a doorway; `blood` 0..1 marks the lintel and doorposts (Passover), `lit` warms the door. */
export const Doorway: React.FC<Base & { blood?: number; lit?: number; w?: number; h?: number; color?: string }> = ({ x, y, s = 1, blood = 0, lit = 0, w = 170, h = 150, color = "#8A7458" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.62} ry={6} fill="rgba(0,0,0,0.35)" />
      <rect x={-w / 2} y={-h} width={w} height={h} fill={c} stroke={rim(0.8)} strokeWidth={1.3} />
      <rect x={-w / 2 - 5} y={-h - 8} width={w + 10} height={9} fill={tone(c, -0.2)} />
      <rect x={-28} y={-92} width={56} height={92} fill={lit > 0 ? `rgba(255,${170 + 30 * lit},${90 + 40 * lit},${0.35 + 0.6 * lit})` : tone(c, -0.6)} />
      <rect x={-34} y={-100} width={68} height={10} fill={tone(c, -0.25)} />
      <rect x={-34} y={-92} width={7} height={92} fill={tone(c, -0.25)} />
      <rect x={27} y={-92} width={7} height={92} fill={tone(c, -0.25)} />
      {blood > 0 ? (
        <g fill="#8A1A16" opacity={0.9}>
          <rect x={-30} y={-99} width={60 * Math.min(1, blood * 3)} height={7} rx={3} />
          <rect x={-33} y={-92} width={5} height={70 * Math.min(1, Math.max(0, blood * 3 - 1))} rx={2} />
          <rect x={28} y={-92} width={5} height={70 * Math.min(1, Math.max(0, blood * 3 - 2))} rx={2} />
        </g>
      ) : null}
      <rect x={w / 2 - 38} y={-h + 26} width={18} height={16} fill={lit > 0 ? `rgba(255,190,100,${0.3 + 0.5 * lit})` : tone(c, -0.5)} />
    </g>
  );
};

/** Rows of tents across a stretch of ground: the camp of Israel. */
export const Camp: React.FC<{ x0: number; x1: number; n?: number; seed?: string; light?: number; s?: number }> = ({ x0, x1, n = 12, seed = "cm", light = 0.4, s = 0.7 }) => {
  const items = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: lerp(x0, x1, (i + random(`${seed}${i}`) * 0.7) / n), w: range(`${seed}w${i}`, 110, 170), l: random(`${seed}l${i}`) })), [n, seed, x0, x1]);
  return (
    <>
      {items.map((t, i) => (
        <Tent key={i} x={t.x} w={t.w} s={s} light={light * t.l} color={i % 3 === 0 ? "#3A2E24" : "#2E2620"} />
      ))}
    </>
  );
};

/** The angel of the LORD: a tall figure of light (pair with <Person look={{ glow: 1 }}>), as a soft column of radiance. */
export const Radiance: React.FC<Base & { h?: number; p?: number }> = ({ x, y, s = 1, h = 260, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const f = useCurrentFrame();
  const id = useUid("rd");
  if (p <= 0) return null;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`} opacity={p}>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="rgb(255,248,226)" stopOpacity={0.55} />
          <stop offset="0.6" stopColor="rgb(255,226,170)" stopOpacity={0.15} />
          <stop offset="1" stopColor="rgb(255,226,170)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={-h * 0.5} rx={h * 0.55 * (1 + 0.04 * Math.sin(f * 0.1))} ry={h * 0.7} fill={`url(#${id})`} />
    </g>
  );
};

/** A small low fire for a camp or a hearth, sized for the band (wraps Fx Fire with a stone ring). */
export const Hearth: React.FC<Base & { p?: number }> = ({ x, y, s = 1, p = 1 }) => {
  const gy = useBase(x, y);
  const band = useBand();
  const ink = useInk();
  const f = useCurrentFrame();
  const k = s * band.k;
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <NoScale>
        <ellipse cx={0} cy={0} rx={30} ry={6} fill={ink("#4A4440")} />
        {p > 0
          ? [-8, 2, 10].map((fx, i) => {
              const h = (26 + 8 * Math.sin(f * 0.5 + i * 2)) * p;
              return <path key={i} d={`M ${fx - 9} 0 Q ${fx - 8} ${-h * 0.6} ${fx + Math.sin(f * 0.3 + i) * 3} ${-h} Q ${fx + 8} ${-h * 0.6} ${fx + 9} 0 Z`} fill={i === 1 ? "#FFD27A" : "#FF7A22"} opacity={0.92} />;
            })
          : null}
        <GlowS x={0} y={-14} r={80} squash={0.65} color="255,150,60" opacity={0.45 * p} />
      </NoScale>
    </g>
  );
};

/** Ground split open (Korah's rebellion): a jagged dark chasm along the band ground; `p` 0..1 opens it. */
export const Chasm: React.FC<{ x: number; w?: number; p?: number; seed?: string }> = ({ x, w = 520, p = 1, seed = "ch" }) => {
  const band = useBand();
  const stage = useStage();
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const pts: Pt[] = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const xx = x - w / 2 + t * w;
    pts.push([xx, band.gy(xx) + 4 + (random(`${seed}${i}`) - 0.5) * 10]);
  }
  const depth = 26 * p * band.k;
  const lower = pts.map(([xx, yy], i) => [xx + (random(`${seed}l${i}`) - 0.5) * 12, yy + depth * Math.sin((i / N) * Math.PI) * range(`${seed}d${i}`, 0.7, 1.2)] as Pt).reverse();
  const glow = stage.night > 0.3 ? 0.5 : 0.25;
  return (
    <g>
      <path d={`${smooth(pts, false, 0.2)} L ${lower.map((q) => `${q[0]} ${q[1]}`).join(" L ")} Z`} fill="#040302" />
      <path d={smooth(pts, false, 0.2)} stroke={`rgba(255,120,40,${glow * p * (0.7 + 0.3 * Math.sin(f * 0.2))})`} strokeWidth={2} fill="none" />
    </g>
  );
};
