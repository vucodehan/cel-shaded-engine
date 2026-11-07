import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import { Pt, lerp, range, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { useBand, useInk, useRim, useStage } from "./Stage";

type Blob = { x: number; y: number; r: number };

/**
 * A complete tree drawn as ONE group (trunk, boughs, canopy shadow, canopy, highlights),
 * so nothing of it can interleave with other objects. Base at (x, ground).
 */
export const Tree: React.FC<{ x: number; y?: number; s?: number; kind?: "oak" | "olive" | "acacia" | "terebinth" | "dead"; seed?: string; grow?: number; flip?: boolean; fruit?: number }> = ({
  x,
  y,
  s = 1,
  kind = "oak",
  seed = "tr",
  grow = 1,
  flip = false,
  fruit = 0,
}) => {
  const f = useCurrentFrame();
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = y ?? band.gy(x);
  s = s * band.k;
  const leaf = { oak: "#2E4A2A", terebinth: "#3A5230", olive: "#5A6A52", acacia: "#4A5A30", dead: "#000000" }[kind];
  const bark = ink(kind === "olive" ? "#5A5048" : "#4A3424");
  const H = kind === "acacia" ? 120 : kind === "olive" ? 90 : 130;
  const blobs = useMemo<Blob[]>(() => {
    const out: Blob[] = [];
    const n = kind === "acacia" ? 9 : kind === "olive" ? 10 : 13;
    for (let i = 0; i < n; i++) {
      const a = random(`${seed}a${i}`) * Math.PI * 2;
      const rr = Math.sqrt(random(`${seed}r${i}`));
      const rx = kind === "acacia" ? 78 : kind === "olive" ? 50 : 58;
      const ry = kind === "acacia" ? 18 : kind === "olive" ? 32 : 40;
      out.push({ x: Math.cos(a) * rx * rr, y: -H + Math.sin(a) * ry * rr - (kind === "acacia" ? 6 : 0), r: range(`${seed}s${i}`, kind === "acacia" ? 16 : 18, kind === "acacia" ? 24 : 30) });
    }
    return out;
  }, [seed, kind, H]);
  const sway = Math.sin(f * 0.025 + random(seed) * 6) * 1.6;
  const trunkTop: Pt = [kind === "olive" ? 8 : 4, -H * 0.62];
  const trunk = smooth(
    [
      [-9, 0],
      [-6, -H * 0.3],
      [trunkTop[0] - 4, trunkTop[1]],
      [trunkTop[0] + 4, trunkTop[1] - 2],
      [7, -H * 0.3],
      [11, 0],
    ],
    true,
    0.4,
  );
  const boughs = [
    [trunkTop[0], trunkTop[1], -36, -H * 0.95],
    [trunkTop[0], trunkTop[1], 30, -H * 1.0],
    [trunkTop[0] - 2, trunkTop[1] + 10, -50, -H * 0.8],
    [trunkTop[0] + 2, trunkTop[1] + 6, 46, -H * 0.82],
    [trunkTop[0], trunkTop[1], 4, -H * 1.1],
  ];
  const g = Math.max(0, Math.min(1, grow));
  if (g <= 0) return null;
  const canopy = kind === "dead" ? 0 : Math.max(0, Math.min(1, (g - 0.35) / 0.65));
  const lc = ink(leaf);
  return (
    <g transform={`translate(${x} ${gy}) scale(${(flip ? -1 : 1) * s * lerp(0.3, 1, g)} ${s * lerp(0.3, 1, g)})`}>
      <ellipse cx={0} cy={0} rx={50} ry={6} fill="rgba(0,0,0,0.28)" />
      {boughs.map((b, i) => (
        <path key={i} d={`M ${b[0]} ${b[1]} Q ${(b[0] + b[2]) / 2} ${b[1] - 12} ${b[2] + sway} ${b[3]}`} stroke={bark} strokeWidth={kind === "dead" ? 5 - i * 0.6 : 6 - i * 0.8} fill="none" strokeLinecap="round" />
      ))}
      <path d={trunk} fill={bark} stroke={rim(0.7)} strokeWidth={1.2} />
      {canopy > 0 ? (
        <g transform={`translate(${sway} ${-H}) scale(${canopy}) translate(0 ${H})`}>
          {blobs.map((b, i) => (
            <circle key={`s${i}`} cx={b.x + 4} cy={b.y + 6} r={b.r} fill={tone(lc, -0.35)} />
          ))}
          {blobs.map((b, i) => (
            <circle key={`m${i}`} cx={b.x} cy={b.y} r={b.r} fill={lc} />
          ))}
          {blobs.map((b, i) =>
            b.y < -H + 8 ? <circle key={`h${i}`} cx={b.x - b.r * 0.25} cy={b.y - b.r * 0.3} r={b.r * 0.55} fill={tone(lc, 0.14)} /> : null,
          )}
          {blobs.map((b, i) =>
            b.y < -H ? <path key={`r${i}`} d={`M ${b.x - b.r * 0.8} ${b.y - b.r * 0.4} A ${b.r} ${b.r} 0 0 1 ${b.x + b.r * 0.7} ${b.y - b.r * 0.55}`} stroke={rim(0.7)} strokeWidth={1.4} fill="none" /> : null,
          )}
          {fruit > 0
            ? blobs.map((b, i) => (i % 2 ? <circle key={`f${i}`} cx={b.x + b.r * 0.3} cy={b.y + b.r * 0.4} r={3.4 * fruit} fill={ink(i % 4 ? "#C8502A" : "#E0A030")} /> : null))
            : null}
        </g>
      ) : null}
    </g>
  );
};

/** Date palm: curved ringed trunk, drooping fronds. */
export const Palm: React.FC<{ x: number; y?: number; s?: number; lean?: number; seed?: string }> = ({ x, y, s = 1, lean = 0.2, seed = "pm" }) => {
  const f = useCurrentFrame();
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = y ?? band.gy(x);
  s = s * band.k;
  const H = 170;
  const top: Pt = [lean * 60, -H];
  const trunk = ink("#5A4630");
  const frond = ink("#3E5428");
  const sway = Math.sin(f * 0.03 + random(seed) * 6) * 3;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={34} ry={5} fill="rgba(0,0,0,0.28)" />
      <path d={`M -7 0 Q ${top[0] * 0.2 - 6} ${-H * 0.5} ${top[0] - 4} ${top[1]} L ${top[0] + 4} ${top[1]} Q ${top[0] * 0.2 + 6} ${-H * 0.5} 7 0 Z`} fill={trunk} stroke={rim(0.6)} strokeWidth={1.2} />
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 1) / 10;
        const px = lerp(0, top[0], t * t);
        return <line key={i} x1={px - 6} y1={-H * t} x2={px + 6} y2={-H * t - 3} stroke={tone(trunk, -0.3)} strokeWidth={1.4} />;
      })}
      {Array.from({ length: 9 }, (_, i) => {
        const a = -Math.PI + (i / 8) * Math.PI;
        const len = range(`${seed}l${i}`, 62, 86);
        const ex = top[0] + Math.cos(a) * len + sway;
        const ey = top[1] + Math.sin(a) * len * 0.35 + 34;
        const cx = top[0] + Math.cos(a) * len * 0.5;
        const cy = top[1] - 26 + Math.sin(a) * 10;
        return <path key={i} d={`M ${top[0]} ${top[1]} Q ${cx} ${cy} ${ex} ${ey} Q ${cx} ${cy + 10} ${top[0]} ${top[1] + 4} Z`} fill={frond} stroke={rim(0.5)} strokeWidth={0.9} />;
      })}
      <circle cx={top[0] - 4} cy={top[1] + 10} r={5} fill={ink("#8A4A20")} />
      <circle cx={top[0] + 5} cy={top[1] + 12} r={4.5} fill={ink("#8A4A20")} />
    </g>
  );
};

/** Low shrub / thicket. `tangle` adds bare twigs (the thicket that caught the ram). */
export const Bush: React.FC<{ x: number; y?: number; s?: number; seed?: string; color?: string; tangle?: boolean }> = ({ x, y, s = 1, seed = "bs", color = "#34482A", tangle = false }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = y ?? band.gy(x);
  s = s * band.k;
  const c = ink(color);
  const blobs = Array.from({ length: 7 }, (_, i) => ({ x: range(`${seed}x${i}`, -36, 36), y: -range(`${seed}y${i}`, 10, 34), r: range(`${seed}r${i}`, 12, 20) }));
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={44} ry={5} fill="rgba(0,0,0,0.26)" />
      {blobs.map((b, i) => (
        <circle key={`d${i}`} cx={b.x + 3} cy={b.y + 4} r={b.r} fill={tone(c, -0.35)} />
      ))}
      {blobs.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={c} />
      ))}
      {blobs.map((b, i) => (i < 3 ? <path key={`r${i}`} d={`M ${b.x - b.r * 0.8} ${b.y - b.r * 0.3} A ${b.r} ${b.r} 0 0 1 ${b.x + b.r * 0.6} ${b.y - b.r * 0.6}`} stroke={rim(0.6)} strokeWidth={1.2} fill="none" /> : null))}
      {tangle
        ? Array.from({ length: 14 }, (_, i) => {
            const a = range(`${seed}ta${i}`, -2.8, -0.3);
            const l = range(`${seed}tl${i}`, 30, 56);
            return <path key={`t${i}`} d={`M ${range(`${seed}tx${i}`, -20, 20)} -6 q ${Math.cos(a) * l * 0.5} ${Math.sin(a) * l * 0.6} ${Math.cos(a) * l} ${Math.sin(a) * l}`} stroke={ink("#3A2C1C")} strokeWidth={1.8} fill="none" />;
          })
        : null}
    </g>
  );
};

/** Grass tufts scattered along the band's ground between x0 and x1. */
export const Grass: React.FC<{ x0: number; x1: number; n?: number; seed?: string; h?: [number, number]; color?: [string, string]; dy?: [number, number]; grow?: number }> = ({
  x0,
  x1,
  n = 120,
  seed = "gr",
  h = [10, 30],
  color = ["#3A5A2A", "#A8B860"],
  dy = [0, 30],
  grow = 1,
}) => {
  const f = useCurrentFrame();
  const band = useBand();
  const ink = useInk();
  const blades = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ x: lerp(x0, x1, random(`${seed}x${i}`)), dy: range(`${seed}d${i}`, dy[0], dy[1]), h: range(`${seed}h${i}`, h[0], h[1]), c: random(`${seed}c${i}`), lean: range(`${seed}l${i}`, -8, 8) })),
    [n, seed, x0, x1, h[0], h[1], dy[0], dy[1]],
  );
  if (grow <= 0) return null;
  return (
    <>
      {blades.map((b, i) => {
        const y = band.gy(b.x) + b.dy;
        const sw = Math.sin(f * 0.06 + b.x * 0.013) * 4;
        const hh = b.h * grow * band.k;
        return <path key={i} d={`M ${b.x} ${y} Q ${b.x + (b.lean + sw) * 0.3} ${y - hh * 0.5} ${b.x + b.lean + sw} ${y - hh}`} stroke={ink(mixHex(color[0], color[1], b.c))} strokeWidth={1.7} fill="none" strokeLinecap="round" />;
      })}
    </>
  );
};

/** Rows of grain between x0 and x1; `grow` 0..1, `ripe` 0 green .. 1 gold, `thin` for blighted ears. */
export const Field: React.FC<{ x0: number; x1: number; n?: number; seed?: string; grow?: number; ripe?: number; h?: number; dy?: [number, number]; thin?: number }> = ({
  x0,
  x1,
  n = 140,
  seed = "fd",
  grow = 1,
  ripe = 1,
  h = 46,
  dy = [0, 26],
  thin = 0,
}) => {
  const f = useCurrentFrame();
  const band = useBand();
  const ink = useInk();
  const stalks = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: lerp(x0, x1, random(`${seed}x${i}`)), dy: range(`${seed}d${i}`, dy[0], dy[1]), h: range(`${seed}h${i}`, 0.75, 1.1), ph: random(`${seed}p${i}`) * 6 })), [n, seed, x0, x1, dy[0], dy[1]]);
  const col = ink(mixHex(mixHex("#5A7A34", "#D8B456", ripe), "#6A5A3A", thin));
  const head = ink(mixHex(mixHex("#7A9A44", "#F0CC6A", ripe), "#7A6A48", thin));
  if (grow <= 0) return null;
  return (
    <>
      {stalks
        .slice()
        .sort((a, b) => a.dy - b.dy)
        .map((st, i) => {
          const y = band.gy(st.x) + st.dy;
          const hh = h * st.h * grow * band.k;
          const sw = Math.sin(f * 0.05 + st.x * 0.01 + st.ph * 0.2) * 5;
          const tx = st.x + sw;
          const ty = y - hh;
          return (
            <g key={i}>
              <path d={`M ${st.x} ${y} Q ${st.x + sw * 0.3} ${y - hh * 0.5} ${tx} ${ty}`} stroke={col} strokeWidth={1.6} fill="none" />
              {grow > 0.6 ? <ellipse cx={tx} cy={ty - 5 * (1 - thin * 0.5)} rx={2.6 * (1 - thin * 0.5)} ry={7 * (1 - thin * 0.4)} fill={head} transform={`rotate(${sw * 2} ${tx} ${ty})`} /> : null}
            </g>
          );
        })}
    </>
  );
};

/** A bound sheaf of grain; `bow` (deg) tilts it, as in Joseph's dream. */
export const Sheaf: React.FC<{ x: number; y?: number; s?: number; bow?: number; glow?: number; ripe?: number }> = ({ x, y, s = 1, bow = 0, glow = 0, ripe = 1 }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = y ?? band.gy(x);
  s = s * band.k;
  const c = glow > 0 ? mixHex(ink("#D8B456"), "#FFE8A8", glow) : ink(mixHex("#7A9A44", "#D8B456", ripe));
  return (
    <g transform={`translate(${x} ${gy}) rotate(${bow}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={22} ry={4} fill="rgba(0,0,0,0.3)" />
      {Array.from({ length: 13 }, (_, i) => {
        const a = (i - 6) * 3.4;
        return <path key={i} d={`M ${(i - 6) * 1.6} 0 Q ${(i - 6) * 0.6} -40 ${Math.sin((a * Math.PI) / 180) * 74} ${-Math.cos((a * Math.PI) / 180) * 74}`} stroke={c} strokeWidth={2.4} fill="none" />;
      })}
      {Array.from({ length: 9 }, (_, i) => {
        const a = ((i - 4) * 5.5 * Math.PI) / 180;
        return <ellipse key={`h${i}`} cx={Math.sin(a) * 80} cy={-Math.cos(a) * 80} rx={4} ry={10} fill={c} transform={`rotate(${(i - 4) * 5.5} ${Math.sin(a) * 80} ${-Math.cos(a) * 80})`} />;
      })}
      <rect x={-9} y={-34} width={18} height={6} rx={2} fill={ink("#8A6A3A")} stroke={rim(0.7)} strokeWidth={0.8} />
      {glow > 0 ? <ellipse cx={0} cy={-50} rx={50} ry={60} fill={`rgba(255,226,160,${0.16 * glow})`} /> : null}
    </g>
  );
};

/** An irregular boulder or stone. */
export const Rock: React.FC<{ x: number; y?: number; s?: number; seed?: string; color?: string; w?: number; h?: number }> = ({ x, y, s = 1, seed = "rk", color = "#5A5450", w = 60, h = 36 }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = y ?? band.gy(x);
  s = s * band.k;
  const pts: Pt[] = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI + (i / 8) * Math.PI;
    return [Math.cos(a) * w * 0.5 * range(`${seed}a${i}`, 0.85, 1.1), Math.min(0, Math.sin(a) * h * range(`${seed}b${i}`, 0.8, 1.15))];
  });
  const c = ink(color);
  return (
    <g transform={`translate(${x} ${gy + 3}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.55} ry={4} fill="rgba(0,0,0,0.3)" />
      <path d={smooth([...pts, [w * 0.5, 0], [-w * 0.5, 0]], true, 0.35)} fill={c} stroke={rim(0.8)} strokeWidth={1.3} />
      <path d={smooth(pts.slice(1, 5).map(([px, py]) => [px * 0.7, py * 0.75] as Pt), false)} stroke={tone(c, 0.15)} strokeWidth={2} fill="none" opacity={0.6} />
    </g>
  );
};

/** River reeds (Egypt). */
export const Reeds: React.FC<{ x0: number; x1: number; n?: number; seed?: string; h?: number }> = ({ x0, x1, n = 40, seed = "rd", h = 70 }) => {
  const f = useCurrentFrame();
  const band = useBand();
  const ink = useInk();
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const x = lerp(x0, x1, random(`${seed}${i}`));
        const y = band.gy(x) + range(`${seed}d${i}`, 0, 12);
        const hh = h * band.k * range(`${seed}h${i}`, 0.6, 1.1);
        const sw = Math.sin(f * 0.04 + x * 0.02) * 4;
        return (
          <g key={i}>
            <path d={`M ${x} ${y} Q ${x + sw * 0.4} ${y - hh * 0.6} ${x + sw} ${y - hh}`} stroke={ink("#4A6A3A")} strokeWidth={2} fill="none" />
            <ellipse cx={x + sw} cy={y - hh - 6} rx={2.4} ry={8} fill={ink("#7A5A3A")} />
          </g>
        );
      })}
    </>
  );
};

/** A grapevine with three branches; `bloom` 0..1 buds to blossoms, `ripe` 0..1 grapes swell. */
export const Vine: React.FC<{ x: number; y: number; s?: number; bloom?: number; ripe?: number }> = ({ x, y, s = 1, bloom = 1, ripe = 1 }) => {
  const stage = useStage();
  const branches: [number, number][] = [
    [-70, -120],
    [0, -150],
    [70, -120],
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 0 Q -6 -40 0 -70" stroke="#6A4A2A" strokeWidth={8} fill="none" strokeLinecap="round" />
      {branches.map(([bx, by], i) => (
        <g key={i}>
          <path d={`M 0 -70 Q ${bx * 0.4} ${-80 + by * 0.2} ${bx} ${by}`} stroke="#6A4A2A" strokeWidth={4} fill="none" strokeLinecap="round" />
          {[0.5, 0.8].map((t, j) => (
            <path key={j} d={`M ${bx * t} ${-70 + (by + 70) * t} q 14 -8 22 4 q -10 8 -22 -4 Z`} fill="#4A7A3A" transform={`rotate(${j * 60 - 30} ${bx * t} ${-70 + (by + 70) * t})`} opacity={Math.min(1, bloom * 2)} />
          ))}
          {bloom > 0 && ripe < 0.3 ? <circle cx={bx} cy={by} r={6 * bloom} fill="#F4EEDC" opacity={0.9} /> : null}
          {ripe > 0
            ? Array.from({ length: 9 }, (_, k) => {
                const row = Math.floor(Math.sqrt(k * 2));
                return <circle key={k} cx={bx + (k % 3) * 6 - 6 + row} cy={by + 6 + row * 6} r={3.6 * ripe} fill={stage.night > 0.5 ? "#5A3A7A" : "#6A2A6A"} stroke="rgba(255,220,255,0.4)" strokeWidth={0.6} />;
              })
            : null}
        </g>
      ))}
    </g>
  );
};
