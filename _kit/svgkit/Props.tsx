import React from "react";
import { random, useCurrentFrame } from "remotion";
import { lerp, range } from "./anim";
import { mixHex, tone } from "./color";
import { useUid } from "./Atmos";
import { NoScale, useBand, useInk, useRim, useStage } from "./Stage";
import { Animal } from "./Animals";

type Base = { x: number; y?: number; s?: number; flip?: boolean };
const useBase = (x: number, y?: number) => {
  const band = useBand();
  return y ?? band.gy(x);
};

/** Stone altar; `fire` 0..1 lights a fire on top (pair with <Smoke>). */
export const Altar: React.FC<Base & { fire?: number; p?: number }> = ({ x, y, s = 1, fire = 0, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const stones: [number, number, number, number][] = [
    [-40, -16, 26, 16], [-14, -16, 28, 16], [14, -16, 26, 16],
    [-32, -31, 24, 15], [-8, -31, 26, 15], [18, -31, 20, 15],
    [-26, -45, 26, 14], [0, -45, 24, 14],
  ];
  const n = Math.round(stones.length * Math.min(1, p));
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={52} ry={6} fill="rgba(0,0,0,0.35)" />
      {stones.slice(0, n).map(([sx, sy, w, h], i) => (
        <rect key={i} x={sx} y={sy} width={w} height={h} rx={5} fill={ink(mixHex("#6A6258", "#8A8070", random(`al${i}`)))} stroke={rim(0.8)} strokeWidth={1.2} />
      ))}
      {fire > 0 ? (
        <g transform={`translate(0 -46) scale(${fire})`}>
          {[-14, 0, 13].map((fx, i) => {
            const h = 34 + 10 * Math.sin(f * 0.5 + i * 2) + 6 * Math.sin(f * 1.3 + i);
            return (
              <g key={i}>
                <path d={`M ${fx - 12} 0 Q ${fx - 10} ${-h * 0.6} ${fx + Math.sin(f * 0.3 + i) * 4} ${-h} Q ${fx + 10} ${-h * 0.6} ${fx + 12} 0 Z`} fill="#FF7A1E" opacity={0.9} />
                <path d={`M ${fx - 6} 0 Q ${fx - 5} ${-h * 0.4} ${fx} ${-h * 0.65} Q ${fx + 5} ${-h * 0.4} ${fx + 6} 0 Z`} fill="#FFE29A" />
              </g>
            );
          })}
          <ellipse cx={0} cy={-10} rx={70} ry={50} fill="rgba(255,150,60,0.16)" />
        </g>
      ) : null}
    </g>
  );
};

/** Bedouin goat-hair tent: sagging roof between poles, a warm-lit opening. */
export const Tent: React.FC<Base & { w?: number; light?: number; color?: string }> = ({ x, y, s = 1, flip = false, w = 180, light = 0.6, color = "#2E2620" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const hw = w / 2;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={hw + 20} ry={7} fill="rgba(0,0,0,0.35)" />
      <path d={`M ${-hw} 0 L ${-hw + 8} -52 Q ${-hw / 2} -40 0 -66 Q ${hw / 2} -40 ${hw - 8} -52 L ${hw} 0 Z`} fill={c} stroke={rim(0.9)} strokeWidth={1.5} />
      <path d={`M ${-hw + 8} -52 Q ${-hw / 2} -40 0 -66 Q ${hw / 2} -40 ${hw - 8} -52`} stroke={tone(c, 0.18)} strokeWidth={2} fill="none" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={lerp(-hw + 10, hw - 10, i / 5)} y1={-46 + Math.abs(i - 2.5) * 4} x2={lerp(-hw + 10, hw - 10, i / 5)} y2={-4} stroke={tone(c, -0.3)} strokeWidth={1} />
      ))}
      <path d={`M ${hw * 0.1} 0 L ${hw * 0.14} -44 L ${hw * 0.52} -40 L ${hw * 0.56} 0 Z`} fill={`rgba(255,${170 + 40 * light},${90 + 40 * light},${0.25 + 0.65 * light})`} />
      <line x1={-hw - 18} y1={0} x2={-hw + 8} y2={-52} stroke={ink("#6A5A44")} strokeWidth={1} />
      <line x1={hw + 18} y1={0} x2={hw - 8} y2={-52} stroke={ink("#6A5A44")} strokeWidth={1} />
    </g>
  );
};

/** One flat-roofed mud-brick house. */
export const House: React.FC<Base & { w?: number; h?: number; lit?: number; seed?: string; color?: string }> = ({ x, y, s = 1, w = 60, h = 44, lit = 0, seed = "hs", color = "#8A7458" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} fill={c} stroke={rim(0.7)} strokeWidth={1.2} />
      <rect x={-w / 2 - 3} y={-h - 5} width={w + 6} height={6} fill={tone(c, -0.2)} />
      <rect x={-6} y={-20} width={12} height={20} fill={tone(c, -0.55)} />
      {random(`${seed}w`) > 0.3 ? <rect x={w / 2 - 18} y={-h + 12} width={9} height={9} fill={lit > 0 ? `rgba(255,190,100,${0.4 + 0.6 * lit})` : tone(c, -0.5)} /> : null}
    </g>
  );
};

/** A walled city: a cluster of houses behind a crenellated wall with a gate. */
export const City: React.FC<Base & { w?: number; lit?: number; seed?: string; wall?: boolean; color?: string; burn?: number; ruin?: number }> = ({
  x,
  y,
  s = 1,
  w = 420,
  lit = 0,
  seed = "ct",
  wall = true,
  color = "#8A7458",
  burn = 0,
  ruin = 0,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const c = ink(color);
  const houses = Array.from({ length: 16 }, (_, i) => ({ x: range(`${seed}x${i}`, -w / 2 + 30, w / 2 - 30), y: -range(`${seed}y${i}`, 20, 70), w: range(`${seed}w${i}`, 34, 70), h: range(`${seed}h${i}`, 30, 70) })).sort((a, b) => a.y - b.y);
  const wallH = 46;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {houses.map((hs, i) => {
        const hh = hs.h * (1 - ruin * random(`${seed}r${i}`) * 0.8);
        return (
          <g key={i}>
            <rect x={hs.x - hs.w / 2} y={hs.y - hh} width={hs.w} height={hh + 40} fill={mixHex(c, tone(c, -0.3), random(`${seed}c${i}`))} stroke={rim(0.5)} strokeWidth={1} />
            <rect x={hs.x - 4} y={hs.y - hh + 10} width={8} height={8} fill={lit > 0 || burn > 0 ? `rgba(255,${170 - burn * 60},${90 - burn * 50},${Math.min(1, 0.3 + 0.7 * Math.max(lit, burn))})` : tone(c, -0.5)} />
          </g>
        );
      })}
      {i18nTower(-w / 2, wallH + 20, c, rim(0.7))}
      {i18nTower(w / 2, wallH + 20, c, rim(0.7))}
      {wall ? (
        <>
          <rect x={-w / 2} y={-wallH} width={w} height={wallH} fill={tone(c, -0.12)} stroke={rim(0.8)} strokeWidth={1.4} />
          {Array.from({ length: Math.floor(w / 18) }, (_, i) => (
            <rect key={i} x={-w / 2 + i * 18} y={-wallH - 8} width={10} height={8} fill={tone(c, -0.12)} />
          ))}
          <path d={`M -22 0 L -22 -28 Q 0 -46 22 -28 L 22 0 Z`} fill={lit > 0 ? `rgba(255,190,110,${0.25 + 0.5 * lit})` : tone(c, -0.6)} />
        </>
      ) : null}
      {burn > 0
        ? Array.from({ length: 9 }, (_, i) => {
            const fx = range(`${seed}fx${i}`, -w / 2, w / 2);
            const h = (50 + 40 * Math.sin(f * 0.4 + i * 2)) * burn;
            return <path key={`b${i}`} d={`M ${fx - 22} ${-30} Q ${fx - 10} ${-30 - h * 0.6} ${fx} ${-30 - h} Q ${fx + 12} ${-30 - h * 0.6} ${fx + 22} -30 Z`} fill={i % 2 ? "#FF6A1A" : "#FFB040"} opacity={0.85} />;
          })
        : null}
    </g>
  );
};
const i18nTower = (x: number, h: number, c: string, rim: string) => (
  <g>
    <rect x={x - 16} y={-h} width={32} height={h} fill={tone(c, -0.18)} stroke={rim} strokeWidth={1.2} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={x - 16 + i * 12} y={-h - 8} width={8} height={8} fill={tone(c, -0.18)} />
    ))}
  </g>
);

/** Stepped ziggurat tower. `built` 0..1 raises it tier by tier; workers and scaffolds while building. */
export const Ziggurat: React.FC<Base & { built?: number; tiers?: number; w?: number; tierH?: number; color?: string; crack?: number }> = ({
  x,
  y,
  s = 1,
  built = 1,
  tiers = 7,
  w = 520,
  tierH = 70,
  color = "#A88A62",
  crack = 0,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const c = ink(color);
  const level = built * tiers;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={12} fill="rgba(0,0,0,0.35)" />
      {Array.from({ length: tiers }, (_, i) => {
        const p = Math.max(0, Math.min(1, level - i));
        if (p <= 0) return null;
        const tw = w * (1 - i / (tiers + 1.5));
        const y0 = -i * tierH;
        const h = tierH * p;
        return (
          <g key={i}>
            <rect x={-tw / 2} y={y0 - h} width={tw} height={h} fill={mixHex(c, tone(c, -0.25), i % 2 ? 0.4 : 0)} stroke={rim(0.8)} strokeWidth={1.5} />
            {Array.from({ length: Math.max(1, Math.floor(h / 12)) }, (_, k) => (
              <line key={k} x1={-tw / 2} y1={y0 - k * 12} x2={tw / 2} y2={y0 - k * 12} stroke={tone(c, -0.3)} strokeWidth={0.8} opacity={0.6} />
            ))}
            {Array.from({ length: Math.floor(tw / 60) }, (_, k) => (
              <rect key={`n${k}`} x={-tw / 2 + 20 + k * 60} y={y0 - h * 0.7} width={10} height={h * 0.5} fill={tone(c, -0.45)} opacity={0.7} />
            ))}
            <path d={`M ${-tw * 0.08} ${y0} L ${tw * 0.08 - tw * 0.16 * p} ${y0 - h}`} stroke={tone(c, 0.15)} strokeWidth={10} opacity={0.5} />
            {p < 1 ? (
              <>
                {[-0.4, 0, 0.4].map((u, k) => (
                  <g key={`sc${k}`} stroke={ink("#6A5030")} strokeWidth={2}>
                    <line x1={tw * u - 14} y1={y0} x2={tw * u - 14} y2={y0 - tierH - 20} />
                    <line x1={tw * u + 14} y1={y0} x2={tw * u + 14} y2={y0 - tierH - 20} />
                    <line x1={tw * u - 14} y1={y0 - tierH * 0.5} x2={tw * u + 14} y2={y0 - tierH * 0.5} />
                    <line x1={tw * u - 14} y1={y0 - tierH} x2={tw * u + 14} y2={y0 - tierH} />
                  </g>
                ))}
                {Array.from({ length: 6 }, (_, k) => {
                  const wx = -tw / 2 + 20 + ((k * 97 + f * (k % 2 ? 0.6 : -0.6)) % (tw - 40) + (tw - 40)) % (tw - 40);
                  return (
                    <g key={`wk${k}`} transform={`translate(${wx} ${y0 - h})`}>
                      <circle cx={0} cy={-13} r={3} fill={ink("#2A2018")} />
                      <rect x={-3} y={-10} width={6} height={10} fill={ink("#2A2018")} />
                    </g>
                  );
                })}
              </>
            ) : null}
          </g>
        );
      })}
      {crack > 0 ? <path d={`M 10 ${-tiers * tierH} L -6 ${-tiers * tierH * 0.7} L 14 ${-tiers * tierH * 0.45} L -4 ${-tiers * tierH * 0.2}`} stroke={`rgba(20,10,5,${crack})`} strokeWidth={3} fill="none" /> : null}
    </g>
  );
};

/** Noah's ark: long hull, three decks, roof, side door. `built` 0..1 goes from ribs to planked hull. */
export const Ark: React.FC<Base & { built?: number; door?: number; len?: number; lit?: number; sink?: number }> = ({ x, y, s = 1, flip = false, built = 1, door = 0, len = 600, lit = 0, sink = 0 }) => {
  const gy0 = useBase(x, y);
  s = s * useBand().k;
  const gy = gy0 + sink * s;
  const ink = useInk();
  const rim = useRim();
  const wood = ink("#6A4A2C");
  const dark = tone(wood, -0.35);
  const L = len / 2;
  const hull = `M ${-L} -120 L ${L} -120 L ${L - 30} -20 Q ${L - 50} 0 ${L - 90} 0 L ${-L + 90} 0 Q ${-L + 50} 0 ${-L + 30} -20 Z`;
  const ribs = built < 0.45;
  const plank = Math.max(0, Math.min(1, (built - 0.3) / 0.6));
  const id = useUid("ak");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <defs>
        <clipPath id={id}>
          <rect x={-L - 10} y={-10 - 130 * plank} width={len + 20} height={140 * plank + 10} />
        </clipPath>
      </defs>
      <ellipse cx={0} cy={2} rx={L + 40} ry={10} fill="rgba(0,0,0,0.3)" />
      {Array.from({ length: 21 }, (_, i) => {
        const xx = -L + 30 + (i / 20) * (len - 60);
        return <line key={i} x1={xx} y1={-4} x2={xx} y2={-120 * Math.min(1, built / 0.3)} stroke={dark} strokeWidth={5} opacity={ribs || plank < 1 ? 1 : 0} />;
      })}
      <g clipPath={`url(#${id})`}>
        <path d={hull} fill={wood} stroke={rim(1)} strokeWidth={1.6} />
        {[-40, -80].map((dy) => (
          <line key={dy} x1={-L + 10} y1={dy} x2={L - 10} y2={dy} stroke={dark} strokeWidth={2} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`p${i}`} x1={-L} y1={-120 + i * 10} x2={L} y2={-120 + i * 10} stroke={tone(wood, -0.15)} strokeWidth={0.8} opacity={0.6} />
        ))}
        <rect x={L * 0.2} y={-78} width={46} height={64} fill={tone(wood, -0.5)} />
        <rect x={L * 0.2} y={-78} width={46} height={64} fill={wood} stroke={rim(0.8)} strokeWidth={1.2} opacity={1 - door} />
        {door > 0 ? <rect x={L * 0.2 + 4} y={-74} width={38} height={58} fill={`rgba(255,200,120,${0.35 * door * lit})`} /> : null}
      </g>
      {built > 0.85 ? (
        <>
          <path d={`M ${-L + 40} -120 L ${-L + 60} -160 L ${L - 60} -160 L ${L - 40} -120 Z`} fill={tone(wood, -0.15)} stroke={rim(0.9)} strokeWidth={1.4} opacity={(built - 0.85) / 0.15} />
          <rect x={-L + 70} y={-152} width={len - 140} height={10} fill={lit > 0 ? `rgba(255,200,120,${0.3 + 0.6 * lit})` : tone(wood, -0.6)} opacity={(built - 0.85) / 0.15} />
          <path d={`M ${-L + 50} -160 L 0 -186 L ${L - 50} -160 Z`} fill={tone(wood, -0.25)} stroke={rim(0.9)} strokeWidth={1.4} opacity={(built - 0.85) / 0.15} />
        </>
      ) : null}
    </g>
  );
};

/** Stone well with a dark mouth; `lid` 0..1 slides the covering stone off (1 = covered). */
export const Well: React.FC<Base & { lid?: number; rope?: boolean }> = ({ x, y, s = 1, lid = 0, rope = false }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const st = ink("#7A7066");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={62} ry={10} fill="rgba(0,0,0,0.35)" />
      <path d="M -54 -34 L -54 0 Q 0 14 54 0 L 54 -34 Z" fill={st} stroke={rim(0.8)} strokeWidth={1.4} />
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={-54 + i * 27} y1={-34 + (i % 2) * 8} x2={-54 + i * 27} y2={4} stroke={tone(st, -0.3)} strokeWidth={1} />
      ))}
      <line x1={-54} y1={-17} x2={54} y2={-17} stroke={tone(st, -0.3)} strokeWidth={1} />
      <ellipse cx={0} cy={-34} rx={54} ry={12} fill={tone(st, 0.1)} stroke={rim(0.9)} strokeWidth={1.4} />
      <ellipse cx={0} cy={-34} rx={42} ry={8} fill="#05070A" />
      {lid > 0 ? <ellipse cx={lerp(70, 0, lid)} cy={-38} rx={46} ry={11} fill={ink("#6A6258")} stroke={rim(0.9)} strokeWidth={1.4} /> : null}
      {rope ? <path d="M 0 -34 L 0 -6" stroke={ink("#8A7A5A")} strokeWidth={1.5} /> : null}
    </g>
  );
};

/** Pyramids on the horizon (Egypt). */
export const Pyramid: React.FC<Base & { h?: number }> = ({ x, y, s = 1, h = 160 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink("#C8A070");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <path d={`M ${-h * 1.3} 0 L 0 ${-h} L ${h * 1.3} 0 Z`} fill={c} />
      <path d={`M 0 ${-h} L ${h * 1.3} 0 L ${h * 0.25} 0 Z`} fill={tone(c, -0.3)} />
      <path d={`M ${-h * 1.3} 0 L 0 ${-h} L ${h * 1.3} 0`} fill="none" stroke={rim(0.6)} strokeWidth={1.2} />
    </g>
  );
};

/** Egyptian colonnade with lotus capitals and a lintel; `banners` hang between columns. */
export const Palace: React.FC<Base & { w?: number; h?: number; cols?: number; lit?: number; banners?: boolean }> = ({ x, y, s = 1, w = 760, h = 300, cols = 8, lit = 0.3, banners = true }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const stone = ink("#C2A27A");
  const shade = tone(stone, -0.3);
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <rect x={-w / 2 - 30} y={-18} width={w + 60} height={18} fill={shade} stroke={rim(0.7)} strokeWidth={1.2} />
      <rect x={-w / 2} y={-h} width={w} height={h - 18} fill={`rgba(20,14,8,${0.75 - lit * 0.4})`} />
      {Array.from({ length: cols }, (_, i) => {
        const cx = -w / 2 + 40 + (i / (cols - 1)) * (w - 80);
        return (
          <g key={i}>
            <rect x={cx - 18} y={-h + 30} width={36} height={h - 48} fill={stone} stroke={rim(0.7)} strokeWidth={1.2} />
            <rect x={cx - 18} y={-h + 30} width={12} height={h - 48} fill={tone(stone, 0.12)} />
            <path d={`M ${cx - 28} ${-h + 30} Q ${cx - 30} ${-h + 10} ${cx - 20} ${-h + 4} L ${cx + 20} ${-h + 4} Q ${cx + 30} ${-h + 10} ${cx + 28} ${-h + 30} Z`} fill={stone} stroke={rim(0.7)} strokeWidth={1} />
            {[0.3, 0.55, 0.8].map((t, k) => (
              <line key={k} x1={cx - 18} y1={-h + 30 + (h - 48) * t} x2={cx + 18} y2={-h + 30 + (h - 48) * t} stroke={ink("#2A4A7A")} strokeWidth={2} opacity={0.6} />
            ))}
            {banners && i < cols - 1 ? <rect x={cx + 30} y={-h + 50} width={20} height={90} fill={ink(i % 2 ? "#8A2A22" : "#2A4A7A")} opacity={0.85} /> : null}
          </g>
        );
      })}
      <rect x={-w / 2 - 20} y={-h - 26} width={w + 40} height={30} fill={stone} stroke={rim(0.9)} strokeWidth={1.4} />
      <rect x={-w / 2 - 20} y={-h - 4} width={w + 40} height={6} fill={ink("#2A4A7A")} opacity={0.7} />
      <path d={`M -40 ${-h - 13} q 20 -14 40 0 q 20 14 40 0`} stroke="#E8C060" strokeWidth={2.4} fill="none" />
      <circle cx={0} cy={-h - 13} r={7} fill="#E8C060" />
    </g>
  );
};

/** Beehive granaries; `fill` 0..1 shows grain heaped at their doors. */
export const Granary: React.FC<Base & { n?: number; fill?: number }> = ({ x, y, s = 1, n = 4, fill = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink("#B89470");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {Array.from({ length: n }, (_, i) => {
        const cx = (i - (n - 1) / 2) * 90;
        return (
          <g key={i}>
            <path d={`M ${cx - 38} 0 L ${cx - 38} -60 Q ${cx - 38} -120 ${cx} -124 Q ${cx + 38} -120 ${cx + 38} -60 L ${cx + 38} 0 Z`} fill={c} stroke={rim(0.8)} strokeWidth={1.4} />
            <path d={`M ${cx + 10} 0 L ${cx + 10} -60 Q ${cx + 30} -110 ${cx + 38} -60 L ${cx + 38} 0 Z`} fill={tone(c, -0.25)} />
            <rect x={cx - 10} y={-34} width={20} height={34} rx={8} fill={tone(c, -0.6)} />
            {fill > 0 ? <path d={`M ${cx - 30} 0 Q ${cx} ${-26 * fill} ${cx + 30} 0 Z`} fill={ink("#E0B860")} /> : null}
          </g>
        );
      })}
    </g>
  );
};

/** Jacob's stairway: luminous steps rising into the sky. `p` draws it upward. */
export const Stairway: React.FC<{ x0: number; y0: number; x1: number; y1: number; w0?: number; w1?: number; p?: number; steps?: number }> = ({ x0, y0, x1, y1, w0 = 120, w1 = 26, p = 1, steps = 26 }) => {
  const n = Math.round(steps * p);
  return (
    <g>
      <path d={`M ${x0 - w0 / 2} ${y0} L ${lerp(x0, x1, p) - lerp(w0, w1, p) / 2} ${lerp(y0, y1, p)} L ${lerp(x0, x1, p) + lerp(w0, w1, p) / 2} ${lerp(y0, y1, p)} L ${x0 + w0 / 2} ${y0} Z`} fill="rgba(255,236,190,0.12)" />
      {Array.from({ length: n }, (_, i) => {
        const t = i / steps;
        const cx = lerp(x0, x1, t);
        const cy = lerp(y0, y1, t);
        const w = lerp(w0, w1, t);
        return <line key={i} x1={cx - w / 2} y1={cy} x2={cx + w / 2} y2={cy} stroke={`rgba(255,240,206,${0.85 - t * 0.4})`} strokeWidth={lerp(3, 1, t)} />;
      })}
      <line x1={x0 - w0 / 2} y1={y0} x2={lerp(x0, x1, p) - lerp(w0, w1, p) / 2} y2={lerp(y0, y1, p)} stroke="rgba(255,236,190,0.7)" strokeWidth={2} />
      <line x1={x0 + w0 / 2} y1={y0} x2={lerp(x0, x1, p) + lerp(w0, w1, p) / 2} y2={lerp(y0, y1, p)} stroke="rgba(255,236,190,0.7)" strokeWidth={2} />
    </g>
  );
};

/** A single standing stone (a memorial pillar). `oil` adds a glistening anointed top. */
export const Pillar: React.FC<Base & { h?: number; oil?: number; glow?: number }> = ({ x, y, s = 1, h = 90, oil = 0, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = glow > 0 ? mixHex(ink("#7A746A"), "#FFE8B8", glow * 0.5) : ink("#7A746A");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={30} ry={5} fill="rgba(0,0,0,0.35)" />
      <path d={`M -18 0 L -15 ${-h * 0.8} Q -10 ${-h} 2 ${-h} Q 14 ${-h} 16 ${-h * 0.8} L 19 0 Z`} fill={c} stroke={rim(0.9)} strokeWidth={1.4} />
      {oil > 0 ? <path d={`M -10 ${-h + 4} Q 0 ${-h - 4} 12 ${-h + 4} L 10 ${-h + 30 * oil} Q 0 ${-h + 20} -8 ${-h + 26 * oil} Z`} fill={`rgba(255,222,140,${0.75 * oil})`} /> : null}
    </g>
  );
};

/** A heap of stones (a witness cairn). */
export const Heap: React.FC<Base & { n?: number; p?: number }> = ({ x, y, s = 1, n = 18, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const stones = Array.from({ length: n }, (_, i) => {
    const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
    const inRow = i - (row * (row + 1)) / 2;
    const perRow = row + 1;
    return { x: (inRow - (perRow - 1) / 2) * 26, y: -12 - (5 - row) * 0 - (Math.floor(Math.sqrt(n * 2)) - row) * 18 + 18 * Math.floor(Math.sqrt(n * 2)) - 18 * Math.floor(Math.sqrt(n * 2)), row };
  });
  const rows = Math.max(...stones.map((st) => st.row)) + 1;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={rows * 16} ry={6} fill="rgba(0,0,0,0.35)" />
      {stones
        .map((st, i) => ({ ...st, i, yy: -12 - (rows - 1 - st.row) * 18 }))
        .sort((a, b) => b.row - a.row)
        .map((st) => (st.i / n < p ? <ellipse key={st.i} cx={st.x} cy={st.yy} rx={14} ry={10} fill={ink(mixHex("#6A6258", "#8A8070", random(`hp${st.i}`)))} stroke={rim(0.8)} strokeWidth={1.1} /> : null))}
    </g>
  );
};

/** An empty cistern: a dark opening in the ground with a stone lip. */
export const Pit: React.FC<Base & { w?: number }> = ({ x, y, s = 1, w = 120 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={w * 0.16} fill={ink("#6A6258")} stroke={rim(0.8)} strokeWidth={1.4} />
      <ellipse cx={0} cy={0} rx={w * 0.48} ry={w * 0.11} fill="#030304" />
    </g>
  );
};

/** Two-wheeled chariot drawn by a horse. */
export const Chariot: React.FC<Base & { walk?: number; rider?: React.ReactNode }> = ({ x, y, s = 1, flip = false, walk, rider }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const gold = ink("#C89A40");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <NoScale>
      <g transform="translate(-60 0)">{rider}</g>
      <path d="M -90 -54 L -36 -54 L -30 -24 L -96 -24 Z" fill={gold} stroke={rim(1)} strokeWidth={1.4} />
      <line x1={-36} y1={-34} x2={40} y2={-40} stroke={ink("#5A3A20")} strokeWidth={4} />
      <circle cx={-62} cy={-26} r={26} fill="none" stroke={ink("#4A3020")} strokeWidth={4} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + (walk !== undefined ? f * 0.15 : 0);
        return <line key={i} x1={-62} y1={-26} x2={-62 + Math.cos(a) * 26} y2={-26 + Math.sin(a) * 26} stroke={ink("#4A3020")} strokeWidth={2} />;
      })}
      <g transform="translate(78 0)">
        <Animal kind="horse" x={0} y={0} s={1} walk={walk} />
      </g>
      </NoScale>
    </g>
  );
};

/** Lot's wife: a figure-shaped column of salt, glittering. `p` turns her from person-shadow to salt. */
export const SaltPillar: React.FC<Base & { p?: number }> = ({ x, y, s = 1, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const f = useCurrentFrame();
  const stage = useStage();
  const salt = mixHex("#2A2420", stage.night > 0.5 ? "#C8CCD8" : "#ECE8E0", p);
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={30} ry={5} fill="rgba(0,0,0,0.3)" />
      <path d="M -16 0 L -14 -90 Q -16 -120 -6 -138 Q 0 -150 8 -148 Q 18 -140 14 -120 Q 18 -96 16 -60 L 18 0 Z" fill={salt} stroke={`rgba(255,255,255,${0.5 * p})`} strokeWidth={1.2} />
      <circle cx={2} cy={-160} r={13} fill={salt} />
      {p > 0.5
        ? Array.from({ length: 14 }, (_, i) => (
            <circle key={i} cx={range(`sp${i}`, -14, 14)} cy={-range(`spy${i}`, 10, 160)} r={1.2} fill="#FFFFFF" opacity={0.4 + 0.6 * Math.max(0, Math.sin(f * 0.2 + i))} />
          ))
        : null}
    </g>
  );
};

/** Clay water jar standing on the ground. */
export const Jar: React.FC<Base> = ({ x, y, s = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <path d="M -10 -40 Q -20 -22 -12 0 L 12 0 Q 20 -22 10 -40 Z M -6 -40 L -7 -48 L 7 -48 L 6 -40 Z" fill={ink("#9A6A44")} stroke={rim(0.8)} strokeWidth={1.2} />
    </g>
  );
};

/** Egyptian coffin (sarcophagus) on a bier. */
export const Coffin: React.FC<Base & { glow?: number }> = ({ x, y, s = 1, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink("#C89A48");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <rect x={-110} y={-30} width={220} height={30} fill={ink("#4A3A2A")} stroke={rim(0.6)} strokeWidth={1.2} />
      <path d="M -100 -30 L -100 -62 Q -100 -78 -70 -80 L 80 -80 Q 104 -78 104 -56 L 100 -30 Z" fill={c} stroke={rim(1)} strokeWidth={1.4} />
      {[-60, -20, 20, 60].map((xx) => (
        <line key={xx} x1={xx} y1={-78} x2={xx} y2={-32} stroke={ink("#2A4A7A")} strokeWidth={2} opacity={0.7} />
      ))}
      {glow > 0 ? <ellipse cx={0} cy={-56} rx={180} ry={70} fill={`rgba(255,220,150,${0.14 * glow})`} /> : null}
    </g>
  );
};

/** Throne with steps (Pharaoh's, then Joseph's seat of authority). */
export const Throne: React.FC<Base> = ({ x, y, s = 1, flip = false }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const g = ink("#C89A40");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <rect x={-70} y={-16} width={140} height={16} fill={ink("#8A7050")} stroke={rim(0.7)} strokeWidth={1} />
      <rect x={-50} y={-30} width={100} height={14} fill={ink("#9A8060")} stroke={rim(0.7)} strokeWidth={1} />
      <path d="M -30 -30 L -30 -70 L 30 -70 L 30 -30 Z" fill={g} stroke={rim(1)} strokeWidth={1.4} />
      <path d="M -34 -70 L -34 -150 Q -34 -160 -24 -160 L -20 -160 L -20 -70 Z" fill={g} stroke={rim(1)} strokeWidth={1.4} />
    </g>
  );
};

/** Smoking fire pot and a flaming torch (Genesis 15), floating between the halves. */
export const FirePot: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => {
  const f = useCurrentFrame();
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -26 -30 Q -32 -6 -18 0 L 18 0 Q 32 -6 26 -30 Z" fill="#3A2A1E" stroke="rgba(255,190,110,0.8)" strokeWidth={1.4} />
      <ellipse cx={0} cy={-30} rx={26} ry={6} fill="#FF8A2A" />
      {Array.from({ length: 6 }, (_, i) => {
        const t = ((f * 0.9 + i * 16) % 96) / 96;
        return <circle key={i} cx={Math.sin(t * 6 + i) * 10 * t} cy={-36 - t * 120} r={8 + t * 26} fill={`rgba(120,110,105,${0.45 * (1 - t)})`} />;
      })}
      <ellipse cx={0} cy={-40} rx={46} ry={40} fill="rgba(255,150,60,0.18)" />
    </g>
  );
};
