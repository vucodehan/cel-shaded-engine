import React, { createContext, useContext, useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { Glow, useUid } from "./Atmos";
import { lerp, mod, range } from "./anim";
import { useLayout } from "./layout";
import { SkyPal, mixHex, nightness, rimAt, skyAt, stormy, tone } from "./color";

/**
 * Depth-ordered stage. Everything is painted strictly back to front:
 *   Sky -> Band(far) -> Band(mid) -> Band(near) -> Band(front)
 * Each Band paints its own ground first and then the objects standing on it, inside one SVG,
 * so a nearer band always covers every part of a farther band's objects (trunks, leaves, people).
 */

export type Cam = { zoom: number; x: number; y: number };
export const CAM0: Cam = { zoom: 1, x: 0, y: 0 };

type StageInfo = { W: number; H: number; v: boolean; cam: Cam; night: number; haze: string; rim: string; rimA: number; ink: string };
const StageCtx = createContext<StageInfo | null>(null);
export const useStage = (): StageInfo => {
  const s = useContext(StageCtx);
  const { W, H, v } = useLayout();
  return s ?? { W, H, v, cam: CAM0, night: 0, haze: "#8A8A90", rim: "255,224,170", rimA: 0.7, ink: "#05060C" };
};

/** `k` scales every object drawn in the band (people, animals, props, plants). */
type BandInfo = { depth: number; haze: number; gy: (x: number) => number; k: number; inBand?: boolean };
const BandCtx = createContext<BandInfo>({ depth: 1, haze: 0, gy: () => 0, k: 1 });
export const useBand = () => useContext(BandCtx);

/** SVG-only children used outside a Band (e.g. in a scene's `fx`): wrap them in a full-frame svg so they render. */
export const SvgIfLoose: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const b = useContext(BandCtx);
  const { W, H } = useLayout();
  if (b.inBand) return <>{children}</>;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      {children}
    </svg>
  );
};

/** Children already inside a scaled group: stop the band scale from applying twice. */
export const NoScale: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const b = useContext(BandCtx);
  return <BandCtx.Provider value={{ ...b, k: 1 }}>{children}</BandCtx.Provider>;
};

/** Colour as seen in the current band: hazed toward the horizon colour, darkened by night. */
export const useInk = () => {
  const s = useStage();
  const b = useBand();
  return (c: string, extraHaze = 0) => mixHex(mixHex(c, s.haze, Math.min(1, b.haze + extraHaze)), s.ink, s.night * 0.5);
};

/** Rim-light stroke colour for the current band. */
export const useRim = () => {
  const s = useStage();
  const b = useBand();
  return (a = 1) => `rgba(${s.rim},${Math.max(0, s.rimA * a * (1 - b.haze * 0.75)).toFixed(3)})`;
};

export type Ridge = { base: number; amp: number; seed: string; k?: number };

/** Height of a ridge at x: three summed sines, seeded. `k` scales the frequency (bigger = busier). */
export const ridgeY = (r: Ridge, x: number) => {
  const k = r.k ?? 1;
  const k1 = range(`${r.seed}k1`, 0.0016, 0.0028) * k;
  const k2 = range(`${r.seed}k2`, 0.004, 0.007) * k;
  const k3 = range(`${r.seed}k3`, 0.011, 0.018) * k;
  const p1 = range(`${r.seed}p1`, 0, 6.28);
  const p2 = range(`${r.seed}p2`, 0, 6.28);
  const p3 = range(`${r.seed}p3`, 0, 6.28);
  return r.base + r.amp * (0.55 * Math.sin(x * k1 + p1) + 0.3 * Math.sin(x * k2 + p2) + 0.15 * Math.sin(x * k3 + p3));
};

/** Mountain ridge with sharper peaks (abs-sine), for far ranges. */
export const peakY = (r: Ridge, x: number) => {
  const k = r.k ?? 1;
  const a = Math.abs(Math.sin(x * range(`${r.seed}a`, 0.0022, 0.0034) * k + range(`${r.seed}b`, 0, 6)));
  const b = Math.abs(Math.sin(x * range(`${r.seed}c`, 0.006, 0.009) * k + range(`${r.seed}d`, 0, 6)));
  return r.base - r.amp * (0.7 * a + 0.3 * b) + r.amp * 0.5;
};

const camT = (s: StageInfo, d: number) => {
  const ox = s.W / 2;
  const oy = s.H * 0.62;
  const sc = 1 + (s.cam.zoom - 1) * d;
  return `translate(${(ox - s.cam.x * d).toFixed(2)} ${(oy - s.cam.y * d).toFixed(2)}) scale(${sc.toFixed(4)}) translate(${-ox} ${-oy})`;
};

/** Pure version of the band projection: where a point at depth d lands on screen under camera `cam`. */
export const projectPt = (cam: Cam, W: number, H: number, x: number, y: number, d: number) => {
  const ox = W / 2;
  const oy = H * 0.62;
  const sc = 1 + (cam.zoom - 1) * d;
  return { x: ox - cam.x * d + (x - ox) * sc, y: oy - cam.y * d + (y - oy) * sc, s: sc };
};

/** Screen position of a point that lives in a band of depth d (for HTML overlays such as Glow). */
export const useProject = () => {
  const s = useStage();
  return (x: number, y: number, d: number) => {
    const ox = s.W / 2;
    const oy = s.H * 0.62;
    const sc = 1 + (s.cam.zoom - 1) * d;
    return { x: ox - s.cam.x * d + (x - ox) * sc, y: oy - s.cam.y * d + (y - oy) * sc, s: sc };
  };
};

export const Stage: React.FC<{
  cam?: Cam;
  tod?: number;
  night?: number;
  haze?: string;
  rim?: string;
  rimA?: number;
  children?: React.ReactNode;
}> = ({ cam = CAM0, tod = 0.45, night, haze, rim, rimA = 0.7, children }) => {
  const { W, H, v } = useLayout();
  const info: StageInfo = {
    W,
    H,
    v,
    cam,
    night: night ?? nightness(tod),
    haze: haze ?? skyAt(tod).hz,
    rim: rim ?? rimAt(tod),
    rimA,
    ink: "#04050C",
  };
  return (
    <StageCtx.Provider value={info}>
      <AbsoluteFill style={{ overflow: "hidden" }}>{children}</AbsoluteFill>
    </StageCtx.Provider>
  );
};

/**
 * One depth band: ground (optional) + objects, painted together in a single SVG.
 * `depth` drives parallax (0 = fixed to the sky, 1 = full camera motion).
 */
export const Band: React.FC<{
  depth: number;
  ridge?: Ridge;
  peaks?: boolean;
  fill?: string;
  fill2?: string;
  haze?: number;
  edge?: number;
  gy?: (x: number) => number;
  children?: React.ReactNode;
  opacity?: number;
  k?: number;
  /** Custom ground profile y(x) (e.g. a single mountain); drawn like a ridge and used for placement. */
  shape?: (x: number) => number;
}> = ({ depth, ridge, peaks = false, fill = "#2A2A2A", fill2, haze = 0, edge = 0.5, gy: gyProp, children, opacity = 1, k = 1, shape }) => {
  const s = useStage();
  const id = useUid("bd");
  const yAt = (x: number) => (shape ? shape(x) : ridge ? (peaks ? peakY(ridge, x) : ridgeY(ridge, x)) : s.H + 400);
  const gy = gyProp ?? yAt;
  const c1 = mixHex(mixHex(fill, s.haze, haze), s.ink, s.night * 0.5);
  const c2 = mixHex(mixHex(fill2 ?? tone(fill, -0.45), s.haze, haze * 0.6), s.ink, s.night * 0.55);
  let ground: React.ReactNode = null;
  if (ridge || shape) {
    const pts: string[] = [];
    let minY = Infinity;
    for (let x = -480; x <= s.W + 480; x += 16) {
      const yy = yAt(x);
      minY = Math.min(minY, yy);
      pts.push(`${x === -480 ? "M" : "L"} ${x} ${yy.toFixed(1)}`);
    }
    const top = pts.join(" ");
    ground = (
      <>
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={minY} x2={0} y2={Math.min(s.H + 200, minY + s.H * 0.5)}>
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        </defs>
        <path d={`${top} L ${s.W + 480} ${s.H + 600} L -480 ${s.H + 600} Z`} fill={`url(#${id})`} />
        {edge > 0 ? <path d={top} fill="none" stroke={`rgba(${s.rim},${(s.rimA * edge * (1 - haze * 0.6)).toFixed(3)})`} strokeWidth={1.5} /> : null}
      </>
    );
  }
  return (
    <svg width={s.W} height={s.H} style={{ position: "absolute", inset: 0, overflow: "visible", opacity }}>
      <g transform={camT(s, depth)}>
        {ground}
        <BandCtx.Provider value={{ depth, haze, gy, k, inBand: true }}>{children}</BandCtx.Provider>
      </g>
    </svg>
  );
};

/** Gradient sky with optional sun, moon, stars and drifting clouds. Painted first, under every Band. */
export const Sky: React.FC<{
  tod?: number;
  pal?: Partial<SkyPal>;
  storm?: number;
  hzY?: number;
  stars?: number;
  sun?: { x: number; y: number; size?: number; a?: number } | null;
  moon?: { x: number; y: number; r?: number; a?: number } | null;
  clouds?: number;
  cloudColor?: string;
  seed?: string;
}> = ({ tod = 0.45, pal, storm = 0, hzY, stars = 0, sun, moon, clouds = 0.5, cloudColor, seed = "sky" }) => {
  const f = useCurrentFrame();
  const s = useStage();
  const { hz } = useLayout();
  const base = { ...stormy(skyAt(tod), storm) };
  for (const k of ["top", "mid", "hz"] as const) if (pal?.[k]) base[k] = pal[k] as string;
  const h = hzY ?? hz;
  const hp = (h / s.H) * 100;
  const night = s.night;
  const starList = useMemo(
    () => Array.from({ length: 240 }, (_, i) => ({ x: random(`${seed}sx${i}`) * s.W, y: Math.pow(random(`${seed}sy${i}`), 1.25) * h * 0.95, r: range(`${seed}sr${i}`, 0.5, 2.1), ph: random(`${seed}sp${i}`) * 6.28 })),
    [s.W, h, seed],
  );
  const px = -s.cam.x * 0.05;
  const py = -s.cam.y * 0.05;
  const cc = cloudColor ?? mixHex(mixHex(base.hz, "#FFFFFF", 0.35), "#1A1C24", night * 0.8 + storm * 0.5);
  return (
    <>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${base.top} 0%, ${base.mid} ${hp * 0.62}%, ${base.hz} ${hp}%, ${mixHex(base.hz, base.mid, 0.4)} 100%)` }} />
      {stars > 0 ? (
        <svg width={s.W} height={s.H} style={{ position: "absolute", inset: 0 }}>
          {starList.map((st, i) => {
            const a = stars * (0.12 + 0.88 * night) * (0.55 + 0.45 * Math.sin(f * 0.06 + st.ph)) * (1 - storm);
            return a > 0.01 ? <circle key={i} cx={st.x + px} cy={st.y + py} r={st.r} fill={`rgba(232,238,255,${a.toFixed(3)})`} /> : null;
          })}
        </svg>
      ) : null}
      {sun && (sun.a ?? 1) > 0 ? (
        <>
          <Glow x={sun.x + px} y={sun.y + py} size={(sun.size ?? 1) * 1100} color="255,200,130" opacity={0.5 * (sun.a ?? 1) * (1 - storm)} />
          <Glow x={sun.x + px} y={sun.y + py} size={(sun.size ?? 1) * 200} color="255,240,214" opacity={(sun.a ?? 1) * (1 - storm * 0.8)} />
          <Glow x={sun.x + px} y={sun.y + py} size={(sun.size ?? 1) * 80} color="255,255,248" opacity={(sun.a ?? 1) * (1 - storm)} />
        </>
      ) : null}
      {moon && (moon.a ?? 1) > 0 ? (
        <>
          <Glow x={moon.x + px} y={moon.y + py} size={(moon.r ?? 34) * 9} color="200,214,255" opacity={0.42 * (moon.a ?? 1)} />
          <svg width={s.W} height={s.H} style={{ position: "absolute", inset: 0 }}>
            <circle cx={moon.x + px} cy={moon.y + py} r={moon.r ?? 34} fill={`rgba(238,242,255,${0.96 * (moon.a ?? 1)})`} />
            <circle cx={moon.x + px + (moon.r ?? 34) * 0.4} cy={moon.y + py - (moon.r ?? 34) * 0.18} r={(moon.r ?? 34) * 0.9} fill={base.top} opacity={0.9 * (moon.a ?? 1)} />
          </svg>
        </>
      ) : null}
      {clouds > 0
        ? Array.from({ length: 9 }, (_, i) => {
            const w = range(`${seed}cw${i}`, 380, 900);
            const yy = range(`${seed}cy${i}`, h * 0.06, h * 0.7);
            const xx = mod(random(`${seed}cx${i}`) * (s.W + 900) + f * range(`${seed}cs${i}`, 0.12, 0.45), s.W + 900) - 450 + px * 2;
            const a = clouds * 0.42 * (0.5 + 0.5 * random(`${seed}ca${i}`)) * (1 + storm);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: xx - w / 2,
                  top: yy - 60 + py * 2,
                  width: w,
                  height: lerp(110, 200, random(`${seed}ch${i}`)) * (1 + storm * 0.6),
                  borderRadius: "50%",
                  background: `radial-gradient(closest-side, ${cc}${Math.round(Math.min(1, a) * 255)
                    .toString(16)
                    .padStart(2, "0")}, ${cc}00)`,
                }}
              />
            );
          })
        : null}
    </>
  );
};

/** Water surface band (sea, flood, river). Objects float on `y`. */
export const Water: React.FC<{
  depth: number;
  y: number;
  color?: string;
  deep?: string;
  waves?: number;
  shine?: { x: number; a: number } | null;
  haze?: number;
  children?: React.ReactNode;
  front?: React.ReactNode;
  rough?: number;
  k?: number;
}> = ({ depth, y, color = "#2A4A60", deep = "#06101A", waves = 1, shine, haze = 0, children, front, rough = 0, k = 1 }) => {
  const f = useCurrentFrame();
  const s = useStage();
  const c1 = mixHex(mixHex(color, s.haze, haze), s.ink, s.night * 0.5);
  const c2 = mixHex(deep, s.ink, s.night * 0.5);
  const id = useUid("wt");
  const surf = (x: number) => y + Math.sin(x * 0.012 + f * 0.05) * (3 + rough * 14) + Math.sin(x * 0.031 - f * 0.08) * (1.5 + rough * 7);
  const pts: string[] = [];
  for (let x = -480; x <= s.W + 480; x += 16) pts.push(`${x === -480 ? "M" : "L"} ${x} ${surf(x).toFixed(1)}`);
  const top = pts.join(" ");
  return (
    <svg width={s.W} height={s.H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={y} x2={0} y2={s.H + 100}>
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <g transform={camT(s, depth)}>
        <BandCtx.Provider value={{ depth, haze, gy: surf, k }}>
          {children}
          <path d={`${top} L ${s.W + 480} ${s.H + 600} L -480 ${s.H + 600} Z`} fill={`url(#${id})`} />
          <path d={top} fill="none" stroke={`rgba(${s.rim},${(0.55 * s.rimA).toFixed(3)})`} strokeWidth={1.4} />
          {Array.from({ length: Math.round(40 * waves) }, (_, i) => {
            const u = Math.pow(random(`wv${i}`), 1.5);
            const yy = y + 8 + u * (s.H - y) * 0.85;
            const xx = mod(random(`wx${i}`) * (s.W + 400) + f * (0.4 + u) * (random(`wd${i}`) > 0.5 ? 1 : -1), s.W + 400) - 200;
            const w = 30 + 220 * u;
            const near = shine ? Math.max(0, 1 - Math.abs(xx - shine.x) / (200 + 500 * u)) : 0;
            const a = (0.08 + 0.18 * (1 - u)) * (0.5 + 0.5 * Math.sin(f * 0.09 + i)) + near * (shine?.a ?? 0) * 0.5;
            return <line key={i} x1={xx - w / 2} y1={yy} x2={xx + w / 2} y2={yy} stroke={`rgba(${s.rim},${a.toFixed(3)})`} strokeWidth={1.2} />;
          })}
          {front}
        </BandCtx.Provider>
      </g>
    </svg>
  );
};

export type LandPreset = "hills" | "desert" | "plain" | "mountains" | "egypt" | "wilderness" | "valley";

type PresetDef = { far: string; mid: string; near: string; front: string; peaks: boolean; farAmp: number; midAmp: number; nearAmp: number };
const PRESETS: Record<LandPreset, PresetDef> = {
  hills: { far: "#56627A", mid: "#4A5A3C", near: "#36452A", front: "#1E2816", peaks: false, farAmp: 70, midAmp: 34, nearAmp: 20 },
  desert: { far: "#9A7A62", mid: "#8C6A46", near: "#6E5134", front: "#3E2D1C", peaks: false, farAmp: 60, midAmp: 26, nearAmp: 14 },
  plain: { far: "#8A7A68", mid: "#7A6848", near: "#5C4C32", front: "#33291A", peaks: false, farAmp: 24, midAmp: 12, nearAmp: 8 },
  mountains: { far: "#5A6478", mid: "#4A5060", near: "#3A3A3E", front: "#1C1C20", peaks: true, farAmp: 170, midAmp: 60, nearAmp: 22 },
  egypt: { far: "#B89068", mid: "#A07C50", near: "#7E6038", front: "#45331E", peaks: false, farAmp: 18, midAmp: 12, nearAmp: 8 },
  wilderness: { far: "#8A6E62", mid: "#7A5E4A", near: "#5A4434", front: "#30241A", peaks: true, farAmp: 110, midAmp: 40, nearAmp: 16 },
  valley: { far: "#4A5468", mid: "#3E4A3A", near: "#2E3828", front: "#182014", peaks: true, farAmp: 150, midAmp: 70, nearAmp: 26 },
};

export type LandGeo = { far: Ridge; mid: Ridge; near: Ridge; front: Ridge; hz: number };

/** Ridge geometry of a preset for the current orientation (exposed so scenes can place things exactly). */
export const useLandGeo = (preset: LandPreset = "hills", seed = "l"): LandGeo => {
  const { v, hz } = useLayout();
  const d = PRESETS[preset];
  return v
    ? {
        hz,
        far: { base: hz - 30, amp: d.farAmp * 1.1, seed: `${seed}f` },
        mid: { base: hz + 90, amp: d.midAmp, seed: `${seed}m` },
        near: { base: hz + 290, amp: d.nearAmp, seed: `${seed}n` },
        front: { base: 1770, amp: 18, seed: `${seed}x` },
      }
    : {
        hz,
        far: { base: hz - 20, amp: d.farAmp, seed: `${seed}f` },
        mid: { base: hz + 75, amp: d.midAmp, seed: `${seed}m` },
        near: { base: hz + 255, amp: d.nearAmp, seed: `${seed}n` },
        front: { base: 1050, amp: 14, seed: `${seed}x` },
      };
};

/** Object scale per band so the near ground carries large, readable figures in both formats. */
export const useBandK = () => {
  const { v } = useLayout();
  return v ? { far: 1, mid: 1.3, near: 1.65, front: 1.65 } : { far: 0.9, mid: 1.15, near: 1.4, front: 1.4 };
};

/**
 * A complete landscape: sky, far range, middle ground, near ground, front lip. Pass objects to each band;
 * `fx` renders above everything (rain, rays). Depth order is guaranteed by construction.
 */
export const Land: React.FC<{
  preset?: LandPreset;
  seed?: string;
  tod?: number;
  cam?: Cam;
  storm?: number;
  sky?: React.ComponentProps<typeof Sky>;
  colors?: Partial<PresetDef>;
  back?: React.ReactNode;
  far?: React.ReactNode;
  mid?: React.ReactNode;
  near?: React.ReactNode;
  front?: React.ReactNode;
  fx?: React.ReactNode;
  noFront?: boolean;
  night?: number;
  rimA?: number;
  waterMid?: number | null;
  water?: { color?: string; deep?: string; rough?: number; front?: React.ReactNode };
}> = ({ preset = "hills", seed = "l", tod = 0.45, cam, storm = 0, sky, colors, back, far, mid, near, front, fx, noFront = false, night, rimA, waterMid = null, water }) => {
  const g = useLandGeo(preset, seed);
  const K = useBandK();
  const d = { ...PRESETS[preset], ...colors };
  return (
    <Stage cam={cam} tod={tod} night={night} rimA={rimA}>
      <Sky tod={tod} storm={storm} {...sky} />
      {back}
      <Band depth={0.12} ridge={g.far} peaks={d.peaks} fill={d.far} haze={0.55} edge={0.35} k={K.far}>
        {far}
      </Band>
      {waterMid !== null ? <Water depth={0.3} y={waterMid} haze={0.3} k={K.mid} color={water?.color} deep={water?.deep} rough={water?.rough} front={water?.front} /> : null}
      <Band depth={0.4} ridge={g.mid} fill={d.mid} haze={0.28} edge={0.4} k={K.mid}>
        {mid}
      </Band>
      <Band depth={0.8} ridge={g.near} fill={d.near} haze={0.06} edge={0.55} k={K.near}>
        {near}
      </Band>
      {noFront ? null : (
        <Band depth={1} ridge={g.front} fill={d.front} haze={0} edge={0.3} k={K.front}>
          {front}
        </Band>
      )}
      {fx}
    </Stage>
  );
};

/** Camera move keyed over a scene: from -> to with ease. */
export const useCam = (dur: number, from: Partial<Cam>, to: Partial<Cam>, start = 0, end?: number): Cam => {
  const f = useCurrentFrame();
  const e = end ?? dur;
  const t = Math.min(1, Math.max(0, (f - start) / Math.max(1, e - start)));
  const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const a = { ...CAM0, ...from };
  const b = { ...CAM0, ...to };
  return { zoom: lerp(a.zoom, b.zoom, k), x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
};
