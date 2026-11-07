import React from "react";
import { random, useCurrentFrame } from "remotion";
import { mod, range, smooth } from "./anim";
import { tone } from "./color";
import { SvgIfLoose, useBand, useInk, useRim } from "./Stage";

/** Leg: hip x, hip y, upper length, lower length. Order: far back, far front, near back, near front. */
type Leg = [number, number, number, number];
type Spec = { body: string; head: string; tail?: string; legs: Leg[]; legW: number; color: string; dark: string; extra?: string; extraFill?: string; extraStroke?: number; spots?: [number, number, number][] };

const wool = (cx: number, cy: number, rx: number, ry: number, n = 16, b = 3.2) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 1 + (i % 2 ? b / Math.max(rx, ry) : 0);
    pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
  }
  return smooth(pts, true, 0.6);
};

export const SPECS: Record<string, Spec> = {
  sheep: {
    body: wool(0, -30, 29, 15),
    head: "M 22 -38 Q 30 -45 38 -39 Q 45 -33 41 -27 Q 35 -23 27 -28 Z M 27 -39 L 20 -44 L 24 -36 Z",
    tail: "M -29 -32 Q -35 -28 -33 -22",
    legs: [[-17, -18, 9, 9], [16, -18, 9, 9], [-21, -18, 9, 9], [20, -18, 9, 9]],
    legW: 3.6,
    color: "#DCD3C2",
    dark: "#2B2420",
  },
  ram: {
    body: wool(0, -32, 31, 16),
    head: "M 22 -40 Q 30 -48 39 -42 Q 46 -35 42 -28 Q 36 -24 27 -29 Z",
    tail: "M -31 -34 Q -37 -30 -35 -23",
    legs: [[-18, -19, 10, 9], [17, -19, 10, 9], [-22, -19, 10, 9], [21, -19, 10, 9]],
    legW: 4,
    color: "#D2C8B4",
    dark: "#2B2420",
    extra: "M 30 -45 C 20 -54 12 -44 16 -36 C 19 -30 26 -32 25 -38",
    extraFill: "none",
    extraStroke: 4.5,
  },
  goat: {
    body: "M -27 -32 Q -27 -44 -12 -44 L 14 -44 Q 26 -44 27 -34 Q 26 -24 14 -23 L -18 -23 Q -27 -24 -27 -32 Z",
    head: "M 18 -40 Q 26 -54 35 -53 Q 43 -51 45 -45 Q 41 -40 35 -42 L 26 -32 Z M 42 -43 L 40 -34 L 37 -42 Z",
    tail: "M -27 -38 L -32 -46",
    legs: [[-18, -23, 11, 12], [16, -23, 11, 12], [-22, -23, 11, 12], [20, -23, 11, 12]],
    legW: 3.4,
    color: "#5E4B3C",
    dark: "#2A2019",
    extra: "M 33 -53 Q 29 -65 20 -67",
    extraFill: "none",
    extraStroke: 3,
  },
  camel: {
    body: "M -36 -58 Q -38 -74 -20 -76 Q -12 -98 2 -96 Q 14 -94 20 -76 Q 34 -74 38 -62 Q 36 -50 22 -48 L -26 -48 Q -36 -50 -36 -58 Z",
    head: "M 30 -66 Q 44 -64 50 -80 Q 54 -96 62 -98 Q 72 -98 77 -92 Q 75 -87 66 -88 Q 60 -86 58 -76 Q 52 -56 34 -54 Z",
    tail: "M -36 -62 Q -42 -54 -40 -44",
    legs: [[-24, -52, 26, 26], [25, -52, 26, 26], [-28, -52, 26, 26], [29, -52, 26, 26]],
    legW: 5.5,
    color: "#A27B4F",
    dark: "#5E4428",
  },
  donkey: {
    body: "M -30 -38 Q -30 -50 -14 -50 L 16 -50 Q 30 -50 32 -40 Q 32 -30 20 -30 L -22 -30 Q -30 -30 -30 -38 Z",
    head: "M 24 -46 Q 34 -58 42 -56 Q 50 -52 51 -46 Q 49 -40 42 -42 Q 36 -44 30 -36 Z M 36 -56 L 33 -71 L 39 -57 Z M 39 -55 L 42 -70 L 43 -56 Z",
    tail: "M -30 -42 Q -36 -34 -34 -25",
    legs: [[-20, -30, 15, 15], [20, -30, 15, 15], [-24, -30, 15, 15], [24, -30, 15, 15]],
    legW: 4.2,
    color: "#7C746A",
    dark: "#3E3A35",
  },
  cow: {
    body: "M -36 -42 Q -36 -60 -18 -60 L 18 -60 Q 34 -60 36 -46 Q 36 -31 22 -29 L -26 -29 Q -36 -31 -36 -42 Z",
    head: "M 30 -52 Q 40 -56 48 -52 Q 55 -46 51 -39 Q 45 -35 38 -39 Q 34 -45 28 -43 Z",
    tail: "M -36 -48 Q -42 -38 -40 -26",
    legs: [[-24, -29, 14, 15], [22, -29, 14, 15], [-28, -29, 14, 15], [26, -29, 14, 15]],
    legW: 5.4,
    color: "#8B6A48",
    dark: "#3E2E20",
    extra: "M 38 -55 Q 40 -63 47 -63",
    extraFill: "none",
    extraStroke: 3,
  },
  thincow: {
    body: "M -34 -42 Q -34 -55 -18 -55 L 16 -55 Q 30 -55 32 -46 Q 32 -38 20 -38 Q 0 -34 -22 -38 Q -34 -36 -34 -42 Z",
    head: "M 28 -50 Q 38 -54 46 -50 Q 52 -44 48 -38 Q 42 -34 36 -38 Q 32 -44 26 -42 Z",
    tail: "M -34 -46 Q -40 -36 -38 -24",
    legs: [[-22, -38, 18, 20], [20, -38, 18, 20], [-26, -38, 18, 20], [24, -38, 18, 20]],
    legW: 3.2,
    color: "#5C4D3E",
    dark: "#2A221A",
    extra: "M -14 -50 Q -12 -44 -14 -40 M -6 -51 Q -4 -45 -6 -40 M 2 -51 Q 4 -45 2 -40 M 10 -51 Q 12 -45 10 -40",
    extraFill: "none",
    extraStroke: 1.2,
  },
  lion: {
    body: "M -32 -36 Q -32 -48 -16 -48 L 14 -48 Q 26 -48 28 -40 Q 28 -28 18 -26 L -24 -26 Q -32 -28 -32 -36 Z",
    head: "M 30 -53 Q 44 -55 48 -47 Q 50 -39 42 -37 Q 34 -37 30 -43 Z",
    tail: "M -32 -40 Q -46 -36 -48 -24",
    legs: [[-22, -26, 13, 13], [20, -26, 13, 13], [-26, -26, 13, 13], [24, -26, 13, 13]],
    legW: 5,
    color: "#B98B4C",
    dark: "#5A3E1C",
    extra: "M 32 -46 m -16 0 a 16 16 0 1 0 32 0 a 16 16 0 1 0 -32 0",
    extraFill: "#7A5528",
  },
  bear: {
    body: "M -40 -44 Q -44 -66 -24 -72 Q -4 -80 10 -82 Q 24 -82 30 -70 Q 40 -58 38 -44 Q 36 -30 22 -28 L -30 -28 Q -40 -30 -40 -44 Z",
    head: "M 26 -70 Q 34 -80 46 -76 Q 52 -72 54 -66 L 64 -62 Q 66 -56 60 -54 L 50 -54 Q 40 -52 32 -58 Q 26 -62 26 -70 Z M 34 -80 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
    tail: "M -40 -50 Q -44 -48 -43 -44",
    legs: [[-26, -30, 14, 14], [24, -30, 14, 14], [-30, -30, 14, 14], [28, -30, 14, 14]],
    legW: 9,
    color: "#4A3628",
    dark: "#22180F",
  },
  mule: {
    body: "M -32 -42 Q -32 -54 -15 -54 L 17 -54 Q 32 -54 34 -43 Q 34 -33 21 -33 L -23 -33 Q -32 -33 -32 -42 Z",
    head: "M 26 -50 Q 36 -64 45 -62 Q 53 -58 54 -51 Q 52 -45 45 -47 Q 38 -48 32 -40 Z M 38 -62 L 35 -78 L 41 -63 Z M 42 -61 L 45 -77 L 46 -62 Z",
    tail: "M -32 -46 Q -38 -37 -36 -27",
    legs: [[-21, -33, 17, 17], [21, -33, 17, 17], [-25, -33, 17, 17], [25, -33, 17, 17]],
    legW: 4.6,
    color: "#5E5248",
    dark: "#2E2824",
  },
  fox: {
    body: "M -22 -24 Q -22 -32 -10 -33 L 12 -33 Q 22 -32 23 -25 Q 22 -18 12 -18 L -14 -18 Q -22 -18 -22 -24 Z M -21 -28 Q -38 -35 -48 -21 Q -40 -14 -30 -19 Q -26 -21 -21 -21 Z",
    head: "M 18 -30 Q 24 -38 32 -37 L 42 -32 Q 40 -27 32 -27 Q 26 -24 20 -22 Z M 24 -36 L 25 -46 L 30 -37 Z M 29 -36 L 33 -45 L 33 -35 Z",
    legs: [[-14, -18, 9, 9], [14, -18, 9, 9], [-17, -18, 9, 9], [17, -18, 9, 9]],
    legW: 3,
    color: "#B0602A",
    dark: "#5A2E14",
  },
  elephant: {
    body: "M -50 -60 Q -52 -96 -10 -100 Q 30 -102 46 -84 Q 52 -68 44 -50 Q 30 -42 -36 -44 Q -50 -46 -50 -60 Z",
    head: "M 38 -92 Q 62 -96 66 -76 Q 68 -60 64 -40 Q 62 -30 66 -22 Q 60 -20 58 -30 Q 54 -50 50 -58 Q 44 -66 38 -66 Z M 40 -90 Q 30 -86 32 -66 Q 40 -62 48 -70 Z",
    tail: "M -50 -66 Q -56 -56 -54 -44",
    legs: [[-30, -44, 22, 22], [30, -44, 22, 22], [-35, -44, 22, 22], [35, -44, 22, 22]],
    legW: 13,
    color: "#706B66",
    dark: "#3E3A36",
  },
  giraffe: {
    body: "M -30 -90 Q -30 -106 -10 -108 L 20 -110 Q 34 -108 34 -94 Q 32 -82 18 -80 L -22 -80 Q -30 -82 -30 -90 Z",
    head: "M 18 -104 L 50 -186 Q 56 -196 66 -194 Q 74 -190 72 -184 Q 64 -182 58 -180 L 34 -96 Z M 58 -194 L 56 -204 M 63 -195 L 62 -205",
    tail: "M -30 -96 Q -36 -86 -34 -72",
    legs: [[-20, -80, 40, 40], [22, -80, 40, 40], [-24, -80, 40, 40], [26, -80, 40, 40]],
    legW: 4.5,
    color: "#C99A5B",
    dark: "#6A4A26",
    spots: [[-12, -94, 5], [4, -98, 6], [18, -92, 5], [-20, -88, 4], [30, -140, 4], [40, -160, 4]],
  },
  horse: {
    body: "M -34 -54 Q -34 -68 -16 -68 L 16 -70 Q 30 -70 32 -58 Q 30 -46 18 -44 L -24 -44 Q -34 -46 -34 -54 Z",
    head: "M 24 -64 Q 34 -86 44 -94 Q 54 -96 61 -88 Q 61 -82 52 -82 Q 46 -76 38 -60 Z",
    tail: "M -34 -60 Q -46 -52 -43 -34",
    legs: [[-24, -44, 22, 22], [22, -44, 22, 22], [-28, -44, 22, 22], [26, -44, 22, 22]],
    legW: 5,
    color: "#5A4030",
    dark: "#2A1E16",
    extra: "M 28 -66 Q 36 -84 46 -92",
    extraFill: "none",
    extraStroke: 4,
  },
  /** A lean medium dog (Tobit's dog): deep chest, tucked belly, upright ears, a long tail. Withers at about the sheep's back. */
  dog: {
    body: "M -28 -37 Q -28 -47 -15 -47 L 11 -48 Q 26 -49 28 -39 Q 28 -28 16 -26 Q 3 -30 -13 -31 Q -27 -30 -28 -37 Z",
    head: "M 16 -43 Q 21 -54 30 -58 Q 37 -60 41 -56 L 53 -50 Q 55 -45 50 -44 L 40 -43 Q 31 -40 25 -34 Z M 28 -56 L 28 -70 L 35 -58 Z M 33 -58 L 37 -71 L 40 -57 Z",
    tail: "M -27 -40 Q -42 -41 -46 -31 Q -49 -22 -44 -16",
    legs: [[-19, -31, 15, 16], [17, -28, 14, 14], [-22, -31, 15, 16], [20, -28, 14, 14]],
    legW: 4.2,
    color: "#9A7A52",
    dark: "#6A4E34",
  },
};

export type AnimalKind = keyof typeof SPECS;

/**
 * A walking (or standing) quadruped, facing right, hooves on the ground.
 * `walk` is a phase; omit to stand. `p` fades/draws it in.
 */
export const Animal: React.FC<{ kind: AnimalKind; x: number; y?: number; s?: number; flip?: boolean; walk?: number; p?: number; graze?: number; load?: boolean; tint?: string }> = ({
  kind,
  x,
  y,
  s = 1,
  flip = false,
  walk,
  p = 1,
  graze = 0,
  load = false,
  tint,
}) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const sp = SPECS[kind];
  const gy = y ?? band.gy(x);
  s = s * band.k;
  const col = ink(tint ?? sp.color);
  const dark = ink(sp.dark);
  const far = tone(dark, -0.25);
  const rimW = 1.4 / Math.max(0.3, s);
  const walking = walk !== undefined;
  const bob = walking ? -Math.abs(Math.sin(walk!)) * 1.4 : 0;
  const offs = [0, Math.PI, Math.PI, 0];
  const leg = (l: Leg, i: number, color: string) => {
    const phs = (walk ?? 0) + offs[i];
    const a = walking ? Math.sin(phs) * 22 : 0;
    const b = walking ? Math.max(0, -Math.cos(phs)) * 26 : 0;
    const knee = [l[0] + Math.sin((a * Math.PI) / 180) * l[2], l[1] + bob + Math.cos((a * Math.PI) / 180) * l[2]];
    const ang = ((a - b) * Math.PI) / 180;
    const foot = [knee[0] + Math.sin(ang) * l[3], knee[1] + Math.cos(ang) * l[3]];
    return <path key={i} d={`M ${l[0]} ${l[1] + bob} L ${knee[0].toFixed(1)} ${knee[1].toFixed(1)} L ${foot[0].toFixed(1)} ${foot[1].toFixed(1)}`} stroke={color} strokeWidth={sp.legW} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  };
  if (p <= 0) return null;
  const headRot = graze * 38;
  const neckPivot = kind === "giraffe" ? [22, -100] : kind === "camel" ? [30, -62] : [22, sp.legs[1][1] - 16];
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`} opacity={Math.min(1, p * 1.4)}>
      <ellipse cx={0} cy={0} rx={sp.legs[3][0] - sp.legs[2][0] + 16} ry={4} fill="rgba(0,0,0,0.3)" />
      {leg(sp.legs[0], 0, far)}
      {leg(sp.legs[1], 1, far)}
      <g transform={`translate(0 ${bob})`}>
        {sp.tail ? <path d={sp.tail} stroke={dark} strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
        <path d={sp.body} fill={col} stroke={rim(1)} strokeWidth={rimW} />
        {sp.spots?.map(([sx, sy, sr], i) => <circle key={i} cx={sx} cy={sy} r={sr} fill={tone(col, -0.3)} />)}
        {load ? <path d="M -16 -50 Q -18 -62 0 -62 Q 18 -62 16 -50 L 18 -38 L -18 -38 Z" fill={ink("#6A5A44")} stroke={rim(0.8)} strokeWidth={rimW} /> : null}
        <g transform={`rotate(${headRot} ${neckPivot[0]} ${neckPivot[1]})`}>
          <path d={sp.head} fill={kind === "sheep" || kind === "ram" ? dark : col} stroke={rim(1)} strokeWidth={rimW} />
          {sp.extra ? <path d={sp.extra} fill={sp.extraFill === "none" ? "none" : ink(sp.extraFill ?? sp.dark)} stroke={sp.extraFill === "none" ? ink(kind === "ram" ? "#9A8A66" : sp.dark) : rim(0.8)} strokeWidth={sp.extraStroke ?? rimW} strokeLinecap="round" /> : null}
          {kind === "lion" ? <path d={sp.head} fill={col} /> : null}
        </g>
      </g>
      {leg(sp.legs[2], 2, dark)}
      {leg(sp.legs[3], 3, dark)}
    </g>
  );
};

/** A single bird in flight, wings flapping. */
export const Bird: React.FC<{ x: number; y: number; s?: number; color?: string; flap?: number; flip?: boolean; glow?: boolean }> = ({ x, y, s = 1, color = "#1A1A1E", flap = 0, flip = false, glow = false }) => {
  const w = Math.sin(flap);
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {glow ? <circle r={30} fill="rgba(255,250,236,0.18)" /> : null}
      <path d={`M -16 ${-12 * w} Q -8 ${-4 - 6 * w} 0 0 Q 8 ${-4 - 6 * w} 16 ${-12 * w} Q 8 ${2 - 3 * w} 0 4 Q -8 ${2 - 3 * w} -16 ${-12 * w} Z`} fill={color} />
      <ellipse cx={3} cy={2} rx={9} ry={3.6} fill={color} />
      <circle cx={12} cy={0.5} r={2.8} fill={color} />
    </g>
  );
};

/** A flock crossing an area; silhouettes by day, gold by night. */
export const Flock: React.FC<{ n: number; area: { x: number; y: number; w: number; h: number }; color?: string; seed?: string; speed?: number; s?: number; dir?: 1 | -1 }> = ({
  n,
  area,
  color = "rgba(26,30,42,0.85)",
  seed = "fl",
  speed = 1.4,
  s = 0.7,
  dir = 1,
}) => {
  const f = useCurrentFrame();
  return (
    <SvgIfLoose>
      {Array.from({ length: n }, (_, i) => {
        const v = range(`${seed}s${i}`, 0.7, 1.3) * speed;
        const xx = mod(random(`${seed}x${i}`) * (area.w + 300) + f * v * dir, area.w + 300) - 150;
        const yy = area.y + random(`${seed}y${i}`) * area.h + Math.sin(f * 0.03 + i) * 14;
        return <Bird key={i} x={area.x + xx} y={yy} s={s * range(`${seed}z${i}`, 0.7, 1.3)} color={color} flap={f * 0.42 + i * 1.7} flip={dir < 0} />;
      })}
    </SvgIfLoose>
  );
};

/** A small herd walking or grazing in a loose row. */
export const Herd: React.FC<{ kind: AnimalKind; n: number; x0: number; x1: number; s?: number; seed?: string; walk?: number; flip?: boolean; graze?: boolean; p?: number }> = ({
  kind,
  n,
  x0,
  x1,
  s = 1,
  seed = "hd",
  walk,
  flip = false,
  graze = true,
  p = 1,
}) => {
  const f = useCurrentFrame();
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + ((i + random(`${seed}${i}`) * 0.6) / n) * (x1 - x0);
        const g = graze && walk === undefined ? Math.max(0, Math.sin(f * 0.02 + i * 2.1)) : 0;
        return <Animal key={i} kind={kind} x={x} s={s * range(`${seed}s${i}`, 0.85, 1.1)} flip={walk === undefined && random(`${seed}f${i}`) > 0.5 ? !flip : flip} walk={walk !== undefined ? walk + i * 1.3 : undefined} graze={g} p={p} />;
      })}
    </>
  );
};
