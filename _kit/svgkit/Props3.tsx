import React from "react";
import { random, useCurrentFrame } from "remotion";
import { range, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { GlowS, useUid } from "./Atmos";
import { NoScale, useBand, useInk, useRim, useStage } from "./Stage";

/**
 * Props for 1–2 Samuel. Same conventions as Props.tsx: feet at y = 0 (on the band's ground at x unless y is given),
 * the band scale k applied automatically, up is negative. Children passed into a prop (a load, a figure on a roof
 * or in a window) are drawn inside the prop's scaled group with NoScale, so give them x/y relative to the anchor
 * named in the prop's comment (e.g. `<Person x={0} y={0} .../>`).
 */

type Base = { x: number; y?: number; s?: number; flip?: boolean };
const useBase = (x: number, y?: number) => {
  const band = useBand();
  return y ?? band.gy(x);
};

/** Two-wheeled ox cart (the new cart for the ark). Bed top at y = -46 (anchor for `load`); the pole runs forward to x = 150. */
export const Cart: React.FC<Base & { wheel?: number; load?: React.ReactNode; color?: string }> = ({ x, y, s = 1, flip = false, wheel = 0, load, color = "#7A5A36" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const wood = ink(color);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={96} ry={6} fill="rgba(0,0,0,0.35)" />
      <line x1={60} y1={-34} x2={150} y2={-44} stroke={wood} strokeWidth={5} strokeLinecap="round" />
      <path d="M -78 -46 L 70 -46 L 64 -30 L -72 -30 Z" fill={wood} stroke={rim(0.9)} strokeWidth={1.3} />
      {[-60, -30, 0, 30].map((xx) => (
        <line key={xx} x1={xx} y1={-46} x2={xx + 4} y2={-30} stroke={tone(wood, -0.3)} strokeWidth={1.2} />
      ))}
      <NoScale>
        <g transform="translate(-4 -46)">{load}</g>
      </NoScale>
      <circle cx={-6} cy={-24} r={24} fill="none" stroke={tone(wood, -0.25)} strokeWidth={5} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = wheel + (i / 6) * Math.PI * 2;
        return <line key={i} x1={-6} y1={-24} x2={-6 + Math.cos(a) * 22} y2={-24 + Math.sin(a) * 22} stroke={tone(wood, -0.2)} strokeWidth={2.4} />;
      })}
      <circle cx={-6} cy={-24} r={4} fill={tone(wood, -0.4)} />
    </g>
  );
};

/** The lamp of God: a clay lamp on a tall bronze stand. `lit` 0..1 (the flame gutters below 0.3). */
export const Lampstand: React.FC<Base & { lit?: number; h?: number }> = ({ x, y, s = 1, lit = 1, h = 120 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const flick = (0.85 + 0.15 * Math.sin(f * 0.41) * Math.sin(f * 0.17 + 2)) * (lit < 0.3 ? 0.6 + 0.4 * Math.sin(f * 0.9) : 1);
  const br = ink("#9A7A3A");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={22} ry={4} fill="rgba(0,0,0,0.35)" />
      <path d={`M -16 0 L -4 -10 L -3 ${-h + 8} L 3 ${-h + 8} L 4 -10 L 16 0 Z`} fill={br} stroke={rim(0.8)} strokeWidth={1.1} />
      <path d={`M -16 ${-h + 8} Q 0 ${-h + 20} 16 ${-h + 8} L 12 ${-h} L -12 ${-h} Z`} fill={br} stroke={rim(0.8)} strokeWidth={1.1} />
      <path d={`M -10 ${-h} Q -12 ${-h - 10} 0 ${-h - 10} Q 12 ${-h - 10} 14 ${-h - 4} L 20 ${-h - 8} L 18 ${-h} Z`} fill={ink("#8A5A36")} />
      {lit > 0 ? (
        <>
          <GlowS x={19} y={-h - 14} r={70 * lit} color="255,180,90" opacity={0.5 * lit * flick} />
          <ellipse cx={19} cy={-h - 16} rx={3.4} ry={8 * flick * Math.max(0.4, lit)} fill="#FFB050" opacity={0.95 * lit} />
          <ellipse cx={19} cy={-h - 14} rx={1.6} ry={4} fill="#FFF0C0" opacity={lit} />
        </>
      ) : null}
    </g>
  );
};

/** A seat: Eli's chair by the doorpost, or a carved royal throne (`royal`) for Saul and David. Seat top at y = -50. */
export const Seat: React.FC<Base & { royal?: boolean; color?: string }> = ({ x, y, s = 1, flip = false, royal = false, color }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color ?? (royal ? "#6A4A2A" : "#6E5A40"));
  const gold = ink("#C89A40");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={40} ry={5} fill="rgba(0,0,0,0.35)" />
      {royal ? <rect x={-50} y={-10} width={100} height={10} fill={ink("#5A4A3A")} stroke={rim(0.6)} strokeWidth={1} /> : null}
      <path d={`M -26 ${royal ? -10 : 0} L -24 -50 L 26 -50 L 28 ${royal ? -10 : 0}`} fill="none" stroke={c} strokeWidth={5} />
      <rect x={-30} y={-56} width={60} height={8} rx={2} fill={c} stroke={rim(0.8)} strokeWidth={1.1} />
      <path d={`M -30 -56 L -32 ${royal ? -140 : -110} Q -30 ${royal ? -150 : -116} -22 ${royal ? -150 : -116} L -20 -56 Z`} fill={c} stroke={rim(0.9)} strokeWidth={1.2} />
      {royal ? (
        <>
          <path d="M 18 -56 L 22 -84 Q 30 -92 36 -84 L 34 -56 Z" fill={c} stroke={rim(0.8)} strokeWidth={1.1} />
          <circle cx={-26} cy={-148} r={5} fill={gold} />
          <path d="M -30 -120 L -22 -120" stroke={gold} strokeWidth={2} />
          <path d="M 30 -84 Q 36 -96 30 -100" stroke={gold} strokeWidth={2.4} fill="none" />
        </>
      ) : null}
    </g>
  );
};

/** A tall house wall with a window high up (Michal lets David down; she looks down on the procession). `rope` 0..1
 *  lowers a rope from the sill; `inWindow` is clipped to the window opening and anchored at the sill centre, so a
 *  figure placed at y ≈ 60–80 (s 0.8) shows from the waist up. Sill at y = -h + 40. */
export const WallWindow: React.FC<Base & { w?: number; h?: number; rope?: number; lit?: number; color?: string; inWindow?: React.ReactNode }> = ({
  x,
  y,
  s = 1,
  flip = false,
  w = 240,
  h = 280,
  rope = 0,
  lit = 0,
  color = "#8A7458",
  inWindow,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const clip = useUid("ww");
  const c = ink(color);
  const sill = -h + 40;
  const opening = `M -34 ${sill} L -34 ${sill - 70} Q 0 ${sill - 96} 34 ${sill - 70} L 34 ${sill} Z`;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={8} fill="rgba(0,0,0,0.35)" />
      <rect x={-w / 2} y={-h} width={w} height={h} fill={c} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: Math.floor(h / 30) }, (_, r) => (
        <line key={r} x1={-w / 2} y1={-h + 30 * (r + 1)} x2={w / 2} y2={-h + 30 * (r + 1)} stroke={tone(c, -0.18)} strokeWidth={1} />
      ))}
      <rect x={-w / 2 - 6} y={-h - 10} width={w + 12} height={12} fill={tone(c, -0.1)} stroke={rim(0.8)} strokeWidth={1.1} />
      <defs>
        <clipPath id={clip}>
          <path d={opening} />
        </clipPath>
      </defs>
      <path d={opening} fill={lit > 0 ? mixHex("#120C08", "#C88A40", lit * 0.7) : "#100A08"} />
      <g clipPath={`url(#${clip})`}>
        <NoScale>
          <g transform={`translate(0 ${sill})`}>{inWindow}</g>
        </NoScale>
      </g>
      <rect x={-42} y={sill} width={84} height={8} fill={tone(c, 0.1)} stroke={rim(0.8)} strokeWidth={1} />
      {rope > 0 ? <path d={`M 10 ${sill + 4} Q 16 ${sill + (-sill) * rope * 0.5} 8 ${sill + (-sill - 6) * rope}`} stroke={ink("#9A8460")} strokeWidth={3} fill="none" /> : null}
      <path d={`M ${w / 2 - 70} 0 L ${w / 2 - 70} -110 L ${w / 2 - 20} -110 L ${w / 2 - 20} 0 Z`} fill={tone(c, -0.55)} />
    </g>
  );
};

/** A two-storey Israelite palace or great house with a flat roof and parapet; `roof` is drawn on the roof, anchored
 *  at its centre (y = -h). `lit` warms the windows. Cedar beams show under the parapet when `cedar`. */
export const RoofHouse: React.FC<Base & { w?: number; h?: number; lit?: number; cedar?: boolean; color?: string; roof?: React.ReactNode }> = ({
  x,
  y,
  s = 1,
  flip = false,
  w = 440,
  h = 210,
  lit = 0,
  cedar = true,
  color = "#9A8466",
  roof,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const win = lit > 0 ? mixHex("#120C08", "#E8A850", lit * 0.8) : "#120C08";
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={9} fill="rgba(0,0,0,0.35)" />
      <rect x={-w / 2} y={-h} width={w} height={h} fill={c} stroke={rim(0.9)} strokeWidth={1.4} />
      <line x1={-w / 2} y1={-h / 2} x2={w / 2} y2={-h / 2} stroke={tone(c, -0.25)} strokeWidth={2} />
      {cedar
        ? Array.from({ length: Math.floor(w / 26) }, (_, i) => <rect key={i} x={-w / 2 + 6 + i * 26} y={-h + 2} width={12} height={8} fill={ink("#5A3A22")} />)
        : null}
      {Array.from({ length: Math.max(2, Math.floor(w / 90)) }, (_, i) => {
        const nWin = Math.max(2, Math.floor(w / 90));
        const xx = -w / 2 + (w / (nWin + 1)) * (i + 1);
        return (
          <g key={i}>
            <path d={`M ${xx - 12} ${-h / 2 - 20} L ${xx - 12} ${-h / 2 - 58} Q ${xx} ${-h / 2 - 70} ${xx + 12} ${-h / 2 - 58} L ${xx + 12} ${-h / 2 - 20} Z`} fill={win} />
            {i % 2 === 0 ? <path d={`M ${xx - 12} -10 L ${xx - 12} -60 Q ${xx} -72 ${xx + 12} -60 L ${xx + 12} -10 Z`} fill={win} /> : null}
          </g>
        );
      })}
      <path d={`M -40 0 L -40 -80 Q 0 -104 40 -80 L 40 0 Z`} fill={tone(c, -0.6)} />
      <rect x={-w / 2 - 6} y={-h - 18} width={w + 12} height={18} fill={tone(c, 0.05)} stroke={rim(0.9)} strokeWidth={1.2} />
      {Array.from({ length: Math.floor(w / 36) }, (_, i) => (
        <rect key={`c${i}`} x={-w / 2 + 4 + i * 36} y={-h - 30} width={18} height={12} fill={tone(c, 0.05)} />
      ))}
      <NoScale>
        <g transform={`translate(0 ${-h})`}>{roof}</g>
      </NoScale>
    </g>
  );
};

/** A spear planted upright in the ground (Saul asleep, his spear by his head), with an optional water jug beside it. */
export const PlantedSpear: React.FC<Base & { lean?: number; jug?: boolean }> = ({ x, y, s = 1, lean = 6, jug = true }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <g transform={`rotate(${lean})`}>
        <line x1={0} y1={4} x2={0} y2={-150} stroke={ink("#6A4A2A")} strokeWidth={3.4} strokeLinecap="round" />
        <path d="M 0 -150 L -5 -136 L 0 -172 L 5 -136 Z" fill="#C8CCD4" stroke="rgba(255,255,255,0.6)" strokeWidth={0.6} />
      </g>
      {jug ? <path d="M 18 -30 Q 10 -16 16 0 L 34 0 Q 40 -16 32 -30 Z M 21 -30 L 20 -36 L 30 -36 L 29 -30 Z" fill={ink("#9A6A44")} stroke={rim(0.8)} strokeWidth={1.1} /> : null}
    </g>
  );
};

/** A rock outcrop with a dark cave mouth (Adullam, En-gedi), seen from outside. Mouth centre at (0, -h * 0.35). */
export const CaveMouth: React.FC<Base & { w?: number; h?: number; seed?: string; color?: string; glow?: number }> = ({ x, y, s = 1, flip = false, w = 420, h = 260, seed = "cv", color = "#6A5E52", glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const pts: [number, number][] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const xx = -w / 2 + w * t;
    const yy = -h * Math.sin(Math.PI * t) * range(`${seed}${i}`, 0.75, 1.05) - (i === 0 || i === n ? 0 : 10);
    pts.push([xx, yy]);
  }
  pts.push([w / 2, 0], [-w / 2, 0]);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={10} fill="rgba(0,0,0,0.35)" />
      <path d={smooth(pts, true, 0.35)} fill={c} stroke={rim(0.9)} strokeWidth={1.5} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M ${range(`${seed}cx${i}`, -w * 0.4, w * 0.4)} ${-range(`${seed}cy${i}`, h * 0.2, h * 0.8)} l ${range(`${seed}cl${i}`, 20, 50)} ${range(`${seed}cm${i}`, 6, 18)}`} stroke={tone(c, -0.3)} strokeWidth={2} fill="none" />
      ))}
      <path d={`M ${-w * 0.16} 0 Q ${-w * 0.18} ${-h * 0.6} 0 ${-h * 0.62} Q ${w * 0.18} ${-h * 0.6} ${w * 0.16} 0 Z`} fill="#06050A" />
      {glow > 0 ? <GlowS x={0} y={-h * 0.3} r={w * 0.25} color="255,170,90" opacity={0.5 * glow} /> : null}
    </g>
  );
};

/** A shallow stream across the ground between x0 and x1 (the brook in the Valley of Elah, Besor, the Kidron), with
 *  smooth stones on its bed. Follows the band's ground, offset `dy` below it. */
export const Stream: React.FC<{ x0: number; x1: number; w?: number; dy?: number; seed?: string; stones?: number; color?: string }> = ({ x0, x1, w = 26, dy = 10, seed = "st", stones = 14, color = "#4A7088" }) => {
  const band = useBand();
  const ink = useInk();
  const stage = useStage();
  const f = useCurrentFrame();
  const k = band.k;
  const top: string[] = [];
  const bot: string[] = [];
  for (let xx = x0; xx <= x1; xx += 20) {
    const wob = Math.sin(xx * 0.01 + 1) * 4 * k;
    top.push(`${xx === x0 ? "M" : "L"} ${xx} ${(band.gy(xx) + dy * k + wob).toFixed(1)}`);
    bot.unshift(`L ${xx} ${(band.gy(xx) + (dy + w) * k + wob).toFixed(1)}`);
  }
  const water = ink(color);
  return (
    <g>
      <path d={`${top.join(" ")} ${bot.join(" ")} Z`} fill={water} opacity={0.9} />
      <path d={top.join(" ")} fill="none" stroke={`rgba(${stage.rim},0.55)`} strokeWidth={1.4} />
      {Array.from({ length: stones }, (_, i) => {
        const xx = x0 + (x1 - x0) * random(`${seed}s${i}`);
        const yy = band.gy(xx) + (dy + w * range(`${seed}y${i}`, 0.3, 0.8)) * k;
        return <ellipse key={i} cx={xx} cy={yy} rx={5 * k} ry={3.4 * k} fill={ink("#9A948A")} opacity={0.85} />;
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const xx = x0 + ((x1 - x0) * ((i / 8 + f * 0.002) % 1));
        return <line key={`g${i}`} x1={xx} y1={band.gy(xx) + (dy + w * 0.5) * k} x2={xx + 18 * k} y2={band.gy(xx) + (dy + w * 0.5) * k} stroke="rgba(220,236,255,0.35)" strokeWidth={1.2} />;
      })}
    </g>
  );
};

/** An army drawn up on a ridge, as small silhouettes with spears and a banner or two: battle lines seen across a
 *  valley (Elah, Mizpah, Gilboa, Aphek). Cheap to draw; use Person for anyone the story looks at. `p` fades it in
 *  from the left; `march` 0..1 bobs the ranks; `tint` colours the cloaks. */
export const Host: React.FC<{ x0: number; x1: number; n?: number; rows?: number; seed?: string; tint?: string; spears?: boolean; banners?: number; p?: number; march?: number; plume?: boolean; flip?: boolean }> = ({
  x0,
  x1,
  n = 30,
  rows = 2,
  seed = "hs",
  tint = "#5A4636",
  spears = true,
  banners = 1,
  p = 1,
  march = 0,
  plume = false,
  flip = false,
}) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const k = band.k;
  const body = ink(tint);
  if (p <= 0) return null;
  const figs: React.ReactNode[] = [];
  for (let r = rows - 1; r >= 0; r--) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5 * (r % 2)) / n;
      if (t > p) continue;
      const xx = x0 + (x1 - x0) * t + range(`${seed}x${r}${i}`, -6, 6) * k;
      const yy = band.gy(xx) - r * 10 * k + (march > 0 ? -Math.abs(Math.sin(f * 0.25 + i)) * 2 * k * march : 0);
      const hgt = range(`${seed}h${r}${i}`, 34, 40) * k;
      const c = mixHex(body, "#000000", r * 0.15);
      figs.push(
        <g key={`${r}-${i}`}>
          <path d={`M ${xx - 7 * k} ${yy} L ${xx - 5 * k} ${yy - hgt * 0.72} Q ${xx} ${yy - hgt * 0.8} ${xx + 5 * k} ${yy - hgt * 0.72} L ${xx + 7 * k} ${yy} Z`} fill={c} />
          <circle cx={xx} cy={yy - hgt * 0.86} r={4.6 * k} fill={c} />
          {plume ? <path d={`M ${xx - 5 * k} ${yy - hgt * 0.9} Q ${xx} ${yy - hgt * 1.12} ${xx + 5 * k} ${yy - hgt * 0.9}`} stroke={ink("#C8B888")} strokeWidth={2.2 * k} fill="none" /> : null}
          {spears && i % 2 === 0 ? <line x1={xx + (flip ? -6 : 6) * k} y1={yy - hgt * 0.3} x2={xx + (flip ? -8 : 8) * k} y2={yy - hgt * 1.5} stroke={ink("#6A5A4A")} strokeWidth={1.4 * k} /> : null}
        </g>,
      );
    }
  }
  const flags = Array.from({ length: banners }, (_, i) => {
    const t = (i + 0.5) / banners;
    if (t > p) return null;
    const xx = x0 + (x1 - x0) * t;
    const yy = band.gy(xx) - 20 * k;
    const wave = Math.sin(f * 0.12 + i) * 4 * k;
    return (
      <g key={`b${i}`}>
        <line x1={xx} y1={yy} x2={xx} y2={yy - 80 * k} stroke={ink("#5A4A3A")} strokeWidth={2 * k} />
        <path d={`M ${xx} ${yy - 80 * k} Q ${xx + 14 * k} ${yy - 76 * k + wave} ${xx + 30 * k} ${yy - 80 * k + wave} L ${xx + 30 * k} ${yy - 60 * k + wave} Q ${xx + 14 * k} ${yy - 56 * k} ${xx} ${yy - 60 * k} Z`} fill={ink(tint === "#5A4636" ? "#8A2A22" : tone(tint, 0.2))} stroke={rim(0.6)} strokeWidth={1} />
      </g>
    );
  });
  return (
    <g>
      {figs}
      {flags}
    </g>
  );
};
