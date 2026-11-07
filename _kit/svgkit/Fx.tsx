import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { CLAMP, ease, lerp, mod, prog, range } from "./anim";
import { useUid } from "./Atmos";
import { useLayout } from "./layout";
import { SvgIfLoose } from "./Stage";
import { fonts } from "./theme";

/** Flickering flames whose base sits at (x, y) (SVG units; place inside a Band or an Svg). */
export const Fire: React.FC<{ x: number; y: number; s?: number; n?: number; p?: number; seed?: string; w?: number }> = ({ x, y, s = 1, n = 3, p = 1, seed = "fi", w = 30 }) => {
  const f = useCurrentFrame();
  if (p <= 0) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * p})`}>
      <ellipse cx={0} cy={-20} rx={w * 2.6} ry={w * 2} fill="rgba(255,140,50,0.14)" />
      {Array.from({ length: n }, (_, i) => {
        const fx = (i - (n - 1) / 2) * w * 0.8;
        const ph = random(`${seed}${i}`) * 6;
        const h = w * 1.8 + w * 0.5 * Math.sin(f * 0.5 + ph) + w * 0.3 * Math.sin(f * 1.3 + ph);
        const lean = Math.sin(f * 0.3 + ph) * w * 0.15;
        return (
          <g key={i}>
            <path d={`M ${fx - w * 0.5} 0 Q ${fx - w * 0.45} ${-h * 0.6} ${fx + lean} ${-h} Q ${fx + w * 0.45} ${-h * 0.6} ${fx + w * 0.5} 0 Z`} fill="#FF6A18" opacity={0.92} />
            <path d={`M ${fx - w * 0.3} 0 Q ${fx - w * 0.28} ${-h * 0.45} ${fx + lean * 0.6} ${-h * 0.72} Q ${fx + w * 0.28} ${-h * 0.45} ${fx + w * 0.3} 0 Z`} fill="#FFB43C" />
            <path d={`M ${fx - w * 0.16} 0 Q ${fx - w * 0.14} ${-h * 0.25} ${fx} ${-h * 0.42} Q ${fx + w * 0.14} ${-h * 0.25} ${fx + w * 0.16} 0 Z`} fill="#FFF2C4" />
          </g>
        );
      })}
    </g>
  );
};

/**
 * Smoke column from (x, y). `rise` px per frame, `drift` px per frame sideways.
 * `low` makes the smoke sink and spread along the ground instead of rising (a refused offering).
 */
export const Smoke: React.FC<{ x: number; y: number; s?: number; n?: number; life?: number; rise?: number; drift?: number; low?: boolean; color?: string; opacity?: number; seed?: string; p?: number }> = ({
  x,
  y,
  s = 1,
  n = 14,
  life = 150,
  rise = 1.6,
  drift = 0.3,
  low = false,
  color = "200,196,190",
  opacity = 0.5,
  seed = "sm",
  p = 1,
}) => {
  const f = useCurrentFrame();
  if (p <= 0 || opacity <= 0) return null;
  return (
    <SvgIfLoose>
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({ length: n }, (_, i) => {
        const age = mod(f + (i * life) / n + random(`${seed}${i}`) * 10, life);
        const t = age / life;
        const wob = Math.sin(age * 0.05 + i) * 10 * t;
        const px = low ? drift * age * 1.6 + wob + (random(`${seed}d${i}`) - 0.5) * 80 * t : drift * age + wob;
        const py = low ? -Math.min(age, 30) * rise * 0.6 + Math.max(0, age - 40) * 0.25 : -age * rise;
        const r = (10 + 50 * t) * (low ? 1.3 : 1);
        const a = opacity * p * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
        return <ellipse key={i} cx={px} cy={py} rx={r} ry={r * (low ? 0.55 : 0.85)} fill={`rgba(${color},${(a * 0.6).toFixed(3)})`} />;
      })}
    </g>
    </SvgIfLoose>
  );
};

/** Full-frame rain streaks. */
export const Rain: React.FC<{ intensity?: number; angle?: number; speed?: number; seed?: string; color?: string }> = ({ intensity = 1, angle = 12, speed = 38, seed = "rn", color = "200,214,236" }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const n = Math.round(260 * intensity);
  const dx = Math.tan((angle * Math.PI) / 180);
  if (n <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: n }, (_, i) => {
        const len = range(`${seed}l${i}`, 30, 70);
        const sp = speed * range(`${seed}s${i}`, 0.8, 1.2);
        const y = mod(random(`${seed}y${i}`) * (H + 200) + f * sp, H + 200) - 100;
        const x = mod(random(`${seed}x${i}`) * (W + 300) + y * dx, W + 300) - 150;
        return <line key={i} x1={x} y1={y} x2={x - len * dx} y2={y - len} stroke={`rgba(${color},${range(`${seed}a${i}`, 0.15, 0.45) * Math.min(1, intensity * 1.5)})`} strokeWidth={1.3} />;
      })}
    </svg>
  );
};

/** A lightning bolt from the top of the frame to (x, y) at frame `at`, with a sky flash. */
export const Lightning: React.FC<{ at: number; x: number; y: number; seed?: string; dur?: number }> = ({ at, x, y, seed = "lt", dur = 10 }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const a = interpolate(f, [at, at + 1, at + 3, at + 4, at + dur], [0, 1, 0.35, 0.9, 0], CLAMP);
  if (a <= 0.01) return null;
  const pts: string[] = [];
  const steps = 12;
  let cx = x + range(`${seed}0`, -120, 120);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const yy = lerp(-20, y, t);
    cx = lerp(cx, x, 0.25) + range(`${seed}${i}`, -40, 40) * (1 - t);
    pts.push(`${i === 0 ? "M" : "L"} ${cx.toFixed(1)} ${yy.toFixed(1)}`);
  }
  return (
    <>
      <AbsoluteFill style={{ background: "rgba(200,214,255,1)", opacity: a * 0.32, mixBlendMode: "screen" }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <path d={pts.join(" ")} stroke={`rgba(200,220,255,${a * 0.5})`} strokeWidth={10} fill="none" strokeLinejoin="round" />
        <path d={pts.join(" ")} stroke={`rgba(255,255,255,${a})`} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** Rainbow arc. `p` sweeps it in from left to right. */
export const Rainbow: React.FC<{ cx: number; cy: number; r: number; p?: number; opacity?: number; width?: number }> = ({ cx, cy, r, p = 1, opacity = 0.7, width = 70 }) => {
  const { W, H } = useLayout();
  const id = useUid("rb");
  const cols = ["#E8483A", "#F08A30", "#F2D040", "#5AB84A", "#3A8AD8", "#4A4AB0", "#7A4AA8"];
  const band = width / cols.length;
  if (p <= 0) return null;
  const sweep = Math.PI * p;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity }}>
      <defs>
        <linearGradient id={id} x1="0" y1={cy - r} x2="0" y2={cy} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="0.85" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id={`${id}m`}>
          <rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
        </mask>
      </defs>
      <g mask={`url(#${id}m)`}>
        {cols.map((c, i) => {
          const rr = r - i * band;
          const x1 = cx - rr;
          const ex = cx - rr * Math.cos(sweep);
          const ey = cy - rr * Math.sin(sweep);
          return <path key={i} d={`M ${x1} ${cy} A ${rr} ${rr} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`} stroke={c} strokeWidth={band + 1} fill="none" opacity={0.75} />;
        })}
      </g>
    </svg>
  );
};

/** A shaft of light from above onto (x, y): God's presence or a call. */
export const Beam: React.FC<{ x: number; y: number; w?: number; top?: number; opacity?: number; color?: string; motes?: boolean }> = ({ x, y, w = 160, top = -40, opacity = 0.6, color = "255,236,196", motes = true }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const id = useUid("bm");
  if (opacity <= 0.001) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity }}>
      <defs>
        <linearGradient id={id} x1="0" y1={top} x2="0" y2={y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={0.05} />
          <stop offset="0.5" stopColor={`rgb(${color})`} stopOpacity={0.35} />
          <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0.6} />
        </linearGradient>
      </defs>
      <path d={`M ${x - w * 0.25} ${top} L ${x + w * 0.25} ${top} L ${x + w / 2} ${y} L ${x - w / 2} ${y} Z`} fill={`url(#${id})`} />
      <ellipse cx={x} cy={y} rx={w * 0.8} ry={w * 0.12} fill={`rgba(${color},0.35)`} />
      {motes
        ? Array.from({ length: 26 }, (_, i) => {
            const t = mod(random(`bmy${i}`) + f * 0.003 * (0.5 + random(`bms${i}`)), 1);
            const yy = lerp(y, top, t);
            const ww = lerp(w / 2, w * 0.25, t);
            return <circle key={i} cx={x + (random(`bmx${i}`) - 0.5) * 2 * ww} cy={yy} r={range(`bmr${i}`, 0.8, 2.2)} fill={`rgba(255,250,236,${0.7 * Math.sin(Math.PI * t)})`} />;
          })
        : null}
    </svg>
  );
};

/** Burning sulfur raining down on an area (Genesis 19). */
export const FireRain: React.FC<{ intensity?: number; x0?: number; x1?: number; ground?: number; seed?: string }> = ({ intensity = 1, x0 = 0, x1, ground, seed = "fr" }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const right = x1 ?? W;
  const gy = ground ?? H * 0.75;
  const n = Math.round(70 * intensity);
  if (n <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
      {Array.from({ length: n }, (_, i) => {
        const life = range(`${seed}l${i}`, 36, 60);
        const t = mod(f + random(`${seed}o${i}`) * life, life) / life;
        const sx = lerp(x0, right, random(`${seed}x${i}`)) + 160;
        const x = sx - t * 200;
        const y = lerp(-60, gy, t);
        const len = 70;
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={x + len * 0.35} y2={y - len} stroke="rgba(255,140,50,0.55)" strokeWidth={3} />
            <circle cx={x} cy={y} r={4} fill="rgba(255,236,170,0.95)" />
            {t > 0.92 ? <circle cx={x} cy={gy} r={30 * (t - 0.92) * 12} fill={`rgba(255,160,60,${0.5 * (1 - (t - 0.92) / 0.08)})`} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

/** Stars appearing one by one across the sky; `p` 0..1 reveals them (Abram counting the stars). */
export const StarField: React.FC<{ n?: number; p?: number; area?: { x: number; y: number; w: number; h: number }; seed?: string; big?: number }> = ({ n = 900, p = 1, area, seed = "sf", big = 40 }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const a = area ?? { x: 0, y: 0, w: W, h: H * 0.6 };
  const stars = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: a.x + random(`${seed}x${i}`) * a.w, y: a.y + Math.pow(random(`${seed}y${i}`), 1.15) * a.h, r: i < big ? range(`${seed}r${i}`, 1.8, 3.2) : range(`${seed}r${i}`, 0.4, 1.5), at: random(`${seed}t${i}`), ph: random(`${seed}p${i}`) * 6 })), [n, seed, a.x, a.y, a.w, a.h, big]);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {stars.map((s, i) => {
        const k = prog(p, s.at * 0.85, 0.15, ease.outSoft);
        if (k <= 0) return null;
        const tw = 0.6 + 0.4 * Math.sin(f * 0.08 + s.ph);
        return (
          <g key={i}>
            {s.r > 1.7 ? <circle cx={s.x} cy={s.y} r={s.r * 4} fill={`rgba(220,230,255,${0.1 * k * tw})`} /> : null}
            <circle cx={s.x} cy={s.y} r={s.r} fill={`rgba(240,244,255,${(0.9 * k * tw).toFixed(3)})`} />
          </g>
        );
      })}
    </svg>
  );
};

/** Words of many languages flying apart from a point (Babel). */
const WORDS = ["γλῶσσα", "שָׂפָה", "لغة", "语言", "भाषा", "язык", "langue", "lengua", "Sprache", "言葉", "언어", "lugha", "lingua", "taal", "kieli", "dil", "ngôn ngữ", "jezik", "språk", "γλώσσα", "ભાષા", "ቋንቋ"];
export const Glyphs: React.FC<{ x: number; y: number; at: number; dur?: number; n?: number; spread?: number; seed?: string }> = ({ x, y, at, dur = 150, n = 44, spread = 900, seed = "gy" }) => {
  const f = useCurrentFrame();
  const t = prog(f, at, dur, ease.out);
  if (f < at) return null;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const d = range(`${seed}d${i}`, 0.3, 1) * spread;
        const k = prog(f, at + random(`${seed}t${i}`) * 30, dur, ease.out);
        const px = x + Math.cos(a) * d * k;
        const py = y + Math.sin(a) * d * k * 0.6;
        const op = Math.min(1, k * 4) * (1 - prog(f, at + dur * 0.6, dur * 0.6, ease.inOut)) * 0.9;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              transform: `translate(-50%,-50%) rotate(${(random(`${seed}r${i}`) - 0.5) * 30 * k}deg) scale(${0.7 + 0.6 * k})`,
              fontFamily: `${fonts.serif}, "Segoe UI", "Nirmala UI", "Microsoft YaHei", "Yu Gothic", "Malgun Gothic", "Ebrima", sans-serif`,
              fontSize: range(`${seed}s${i}`, 26, 52),
              fontWeight: 600,
              color: i % 3 ? "#FFE6B0" : "#F4F0E6",
              textShadow: "0 0 14px rgba(255,190,110,0.6), 0 2px 10px rgba(0,0,0,0.8)",
              opacity: op,
              whiteSpace: "nowrap",
            }}
          >
            {WORDS[i % WORDS.length]}
          </div>
        );
      })}
      {t < 0.3 ? <div style={{ position: "absolute", left: x - 200, top: y - 200, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,230,180,0.6), rgba(255,230,180,0))", opacity: 1 - t / 0.3 }} /> : null}
    </>
  );
};

/** Dream framing: dark soft edges, a cool tint and drifting sparkles around a clear centre. */
export const DreamFrame: React.FC<{ p?: number; cx?: number; cy?: number; r?: number; tint?: string }> = ({ p = 1, cx, cy, r, tint = "60,70,140" }) => {
  const f = useCurrentFrame();
  const { W, H, v } = useLayout();
  const x = cx ?? W / 2;
  const y = cy ?? (v ? H * 0.58 : H * 0.6);
  const rr = r ?? (v ? 560 : 520);
  if (p <= 0) return null;
  return (
    <>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${rr * 1.25}px ${rr}px at ${x}px ${y}px, rgba(${tint},0) 55%, rgba(${tint},0.35) 75%, rgba(4,5,14,0.92) 100%)`, opacity: p }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: p, mixBlendMode: "screen" }}>
        {Array.from({ length: 50 }, (_, i) => {
          const a = random(`df${i}`) * Math.PI * 2 + f * 0.002 * (random(`dfs${i}`) - 0.5);
          const d = rr * range(`dfd${i}`, 0.95, 1.35);
          return <circle key={i} cx={x + Math.cos(a) * d * 1.25} cy={y + Math.sin(a) * d} r={range(`dfr${i}`, 0.8, 2.4)} fill={`rgba(230,230,255,${0.5 + 0.5 * Math.sin(f * 0.1 + i)})`} />;
        })}
      </svg>
    </>
  );
};

/** Gold line-art that draws itself on as p goes 0 -> 1 (SVG; place inside a Band or Svg). */
export const GoldLine: React.FC<{ d: string; p: number; w?: number; color?: string; glow?: number; fill?: string }> = ({ d, p, w = 2.4, color = "#F8D488", glow = 0.6, fill }) => {
  if (p <= 0) return null;
  return (
    <>
      {glow > 0 ? <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke={`rgba(255,200,110,${0.35 * glow})`} strokeWidth={w * 4} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke={color} strokeWidth={w} fill={fill ?? "none"} fillOpacity={fill ? p : undefined} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
};

/** A soft glowing mark (e.g. the mark the LORD put on Cain): a small point of light. */
export const Mark: React.FC<{ x: number; y: number; p?: number; r?: number }> = ({ x, y, p = 1, r = 10 }) => {
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const pulse = 1 + 0.12 * Math.sin(f * 0.12);
  return (
    <g opacity={p}>
      <circle cx={x} cy={y} r={r * 5 * pulse} fill="rgba(255,226,160,0.12)" />
      <circle cx={x} cy={y} r={r * 2 * pulse} fill="rgba(255,236,190,0.35)" />
      <circle cx={x} cy={y} r={r * 0.6} fill="#FFF6DC" />
    </g>
  );
};
