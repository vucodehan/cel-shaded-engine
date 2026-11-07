import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Pt, lerp, mod, range, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { GlowS, useUid } from "./Atmos";
import { Animal, Bird } from "./Animals";
import { Look, Person, Pose } from "./Person";
import { NoScale, SvgIfLoose, useBand, useInk, useRim } from "./Stage";
import { fonts } from "./theme";

/**
 * Props for the Gospels and Acts (films 67–89). Same conventions as Props.tsx: feet/base at y = 0 (on the band's ground at
 * x unless y is given), the band scale k applied automatically, up is negative, local units × s × K.<band> = pixels.
 * Two scales, as in Props4:
 *  - Person scale (a man = 174 units): FishingBoat, FishNet, Manger, WaterJars, LoafBaskets, FigTree, Cross, CrownOfThorns,
 *    RockTomb, GraveClothes, Stocks, PrisonChains, SilverShrines, ArtemisStatue, UnknownAltar, MerchantShip, Colt,
 *    MoneyTable, Stable, RomanHouse, Carriage, JudgmentSeat, SupperTable.
 *  - Monumental props seen from a distance (a man ≈ 40 units, a Person at s ≈ 0.23 in the same band): HerodTemple,
 *    ClassicTemple, Acropolis, Theatre, RomeSkyline; Colonnade takes its column height `h` in either scale.
 * Plain-SVG pieces placed at (x, y) in the units of the layer they are drawn in (band or fx): BethlehemStar, Dove,
 * TonguesOfFire, VisionSheet, CrossSign, Viper. Slots (crew, deck, seat, inside, onStone, rider) are drawn inside the
 * prop's scaled group with NoScale, so give a Person x/y relative to the anchor named in the prop's comment.
 */

type Base = { x: number; y?: number; s?: number; flip?: boolean };
const useBase = (x: number, y?: number) => {
  const band = useBand();
  return y ?? band.gy(x);
};
const poly = (pts: Pt[]) => `${pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} Z`;
const flameD = (fx: number, w: number, h: number, lean: number) => `M ${fx - w / 2} 0 Q ${fx - w * 0.45} ${-h * 0.6} ${fx + lean} ${-h} Q ${fx + w * 0.45} ${-h * 0.6} ${fx + w / 2} 0 Z`;
const clamp1 = (t: number) => Math.min(1, Math.max(0, t));

/** A level strip of water drawn over the lower hull of a boat (local units, waterline y = 0). */
const WaterLip: React.FC<{ x0: number; x1: number; color: string; f: number; rough?: number; depth?: number }> = ({ x0, x1, color, f, rough = 0, depth = 40 }) => {
  const rim = useRim();
  const id = useUid("wl");
  const pts: string[] = [];
  for (let xx = x0; xx <= x1; xx += 12) pts.push(`${xx === x0 ? "M" : "L"} ${xx} ${(Math.sin(xx * 0.03 + f * 0.09) * (2 + rough * 7)).toFixed(1)}`);
  const top = pts.join(" ");
  const e = Math.min(90, (x1 - x0) * 0.18);
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.96} />
          <stop offset="0.5" stopColor={color} stopOpacity={0.72} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${top} L ${x1} 2 Q ${x1 - e * 0.4} ${depth} ${x1 - e} ${depth} L ${x0 + e} ${depth} Q ${x0 + e * 0.4} ${depth} ${x0} 2 Z`} fill={`url(#${id})`} />
      <path d={top} stroke={rim(0.8)} strokeWidth={1.4} fill="none" />
      <path d={top} transform="translate(0 6)" stroke="rgba(230,240,248,0.22)" strokeWidth={1} fill="none" />
    </g>
  );
};

// ── Galilee ───────────────────────────────────────────────────────────────────────────────

/** Heights of a FishingBoat at s = 1 above its waterline: the near gunwale amidships, the floor the crew stands on, the mast top. */
export const BOAT_H = { gunwale: 46, deck: 12, mast: 300 };

/**
 * A Galilee fishing boat, about 520 long (bow on the right; flip for left), waterline at y = 0 (set y to the water
 * surface, or leave it on a beach with `water={null}`). `sail` 0..1 sets the square sail from furled to full (null: no
 * mast, a rowing boat); `oars` shows two oars on the near side; `roll` tilts it (degrees, animate ±3–6 in a storm) and
 * `bob` lifts it; `storm` 0..1 adds spray at the bow; `net` hangs a net over the near side; `lamp` lights a stern
 * lantern. `crew` is drawn inside the hull before the near side, anchored on the boat's floor at the middle (a Person at
 * y = 0, x = ±150 stands with the gunwale at hip height; pose sit: 1 sits on a thwart); `front` is drawn over the hull.
 */
export const FishingBoat: React.FC<
  Base & { len?: number; sail?: number | null; oars?: boolean; roll?: number; bob?: number; storm?: number; net?: boolean; water?: string | null; color?: string; crew?: React.ReactNode; front?: React.ReactNode; lamp?: number; seed?: string }
> = ({ x, y, s = 1, flip = false, len = 520, sail = null, oars = true, roll = 0, bob = 0, storm = 0, net = false, water = "#1E3C4A", color = "#5A3E28", crew, front, lamp = 0, seed = "fb" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const wood = ink(color);
  const dark = tone(wood, -0.4);
  const L = len / 2;
  const hull = `M ${-L} -56 Q 0 -36 ${L + 14} -82 Q ${L + 4} -22 ${L - 40} 12 Q 0 24 ${-L + 36} 12 Q ${-L - 6} -12 ${-L} -56 Z`;
  const inner = `M ${-L + 8} -64 Q 0 -50 ${L + 6} -88 L ${L + 14} -82 Q 0 -36 ${-L} -56 Z`;
  const mx = L * 0.1;
  const sailC = ink("#D8CCB0");
  const billow = (sail ?? 0) * (1 + 0.04 * Math.sin(f * 0.07));
  return (
    <g transform={`translate(${x} ${gy + bob}) scale(${flip ? -s : s} ${s})`}>
      {water === null ? <ellipse cx={0} cy={4} rx={L + 30} ry={9} fill="rgba(0,0,0,0.35)" /> : null}
      <g transform={`rotate(${roll})`}>
        <path d={inner} fill={dark} />
        {[-0.3, 0.05, 0.35].map((u) => (
          <line key={u} x1={u * len} y1={-56 + Math.abs(u) * 10} x2={u * len + 8} y2={-44 + Math.abs(u) * 6} stroke={tone(wood, -0.15)} strokeWidth={5} />
        ))}
        {sail !== null ? (
          <g>
            <line x1={mx} y1={-14} x2={mx} y2={-BOAT_H.mast} stroke={tone(wood, -0.2)} strokeWidth={5} strokeLinecap="round" />
            <line x1={mx - 120} y1={-BOAT_H.mast + 24} x2={mx + 110} y2={-BOAT_H.mast + 14} stroke={tone(wood, -0.1)} strokeWidth={3.6} strokeLinecap="round" />
            {billow > 0.02 ? (
              <>
                <path
                  d={`M ${mx - 118} ${-BOAT_H.mast + 26} L ${mx + 108} ${-BOAT_H.mast + 16} Q ${mx + 108 + 46 * billow} ${-BOAT_H.mast + 90} ${mx + 100 + 10 * billow} ${-112} L ${mx - 104} ${-104} Q ${mx - 104 + 40 * billow} ${-BOAT_H.mast + 100} ${mx - 118} ${-BOAT_H.mast + 26} Z`}
                  fill={sailC}
                  stroke={rim(0.9)}
                  strokeWidth={1.4}
                />
                {[0.33, 0.66].map((t) => (
                  <path key={t} d={`M ${mx - 116 + 4 * t} ${lerp(-BOAT_H.mast + 26, -104, t)} Q ${mx + 30 * billow} ${lerp(-BOAT_H.mast + 30, -100, t) + 6} ${mx + 104 + 40 * billow * (1 - t)} ${lerp(-BOAT_H.mast + 16, -112, t)}`} stroke={tone(sailC, -0.18)} strokeWidth={1.2} fill="none" />
                ))}
                <line x1={mx + 100 + 10 * billow} y1={-112} x2={L - 10} y2={-70} stroke={ink("#8A7A5A")} strokeWidth={1} />
                <line x1={mx - 104} y1={-104} x2={-L + 20} y2={-58} stroke={ink("#8A7A5A")} strokeWidth={1} />
              </>
            ) : (
              <path d={`M ${mx - 116} ${-BOAT_H.mast + 24} Q ${mx} ${-BOAT_H.mast + 40} ${mx + 106} ${-BOAT_H.mast + 14} Q ${mx} ${-BOAT_H.mast + 28} ${mx - 116} ${-BOAT_H.mast + 24} Z`} fill={sailC} stroke={rim(0.7)} strokeWidth={1} />
            )}
          </g>
        ) : null}
        {crew ? (
          <NoScale>
            <g transform={`translate(0 ${-BOAT_H.deck})`}>{crew}</g>
          </NoScale>
        ) : null}
        <path d={hull} fill={wood} stroke={rim(1)} strokeWidth={1.5} />
        {[12, 24, 36].map((o) => (
          <path key={o} d={`M ${-L + 4 + o * 0.3} ${-56 + o} Q 0 ${-36 + o} ${L + 8 - o * 0.5} ${-82 + o * 1.3}`} stroke={tone(wood, -0.25)} strokeWidth={1.2} fill="none" />
        ))}
        <path d={`M ${-L} -56 Q 0 -36 ${L + 14} -82`} stroke={tone(wood, 0.25)} strokeWidth={4} fill="none" />
        <path d={`M ${-L + 2} -48 Q 0 -29 ${L + 10} -73`} stroke={ink("#7A2E22")} strokeWidth={3} fill="none" opacity={0.85} />
        <circle cx={L - 18} cy={-62} r={4} fill={ink("#E8DCC0")} />
        {net ? (
          <g opacity={0.85}>
            <path d={`M ${-L * 0.7} -46 Q ${-L * 0.55} 6 ${-L * 0.45} 30 L ${-L * 0.25} 30 Q ${-L * 0.3} -4 ${-L * 0.2} -42 Z`} fill={ink("#7A6C50")} opacity={0.55} />
            {Array.from({ length: 7 }, (_, i) => (
              <line key={i} x1={-L * 0.7 + i * L * 0.075} y1={-44} x2={-L * 0.52 + i * L * 0.04} y2={30} stroke={ink("#A89A78")} strokeWidth={0.8} />
            ))}
            {[-20, 0, 18].map((yy) => (
              <line key={yy} x1={-L * 0.66} y1={yy} x2={-L * 0.26} y2={yy - 4} stroke={ink("#A89A78")} strokeWidth={0.8} />
            ))}
          </g>
        ) : null}
        {oars
          ? [-0.28, 0.12].map((u, i) => {
              const ox = u * len;
              const sw = Math.sin(f * 0.08 + i) * 6;
              return (
                <g key={u}>
                  <line x1={ox} y1={-52} x2={ox - 92 + sw} y2={34} stroke={tone(wood, 0.15)} strokeWidth={3.2} strokeLinecap="round" />
                  <ellipse cx={ox - 96 + sw} cy={38} rx={5} ry={13} transform={`rotate(-45 ${ox - 96 + sw} 38)`} fill={tone(wood, 0.1)} />
                  <circle cx={ox} cy={-52} r={3} fill={dark} />
                </g>
              );
            })
          : null}
        {lamp > 0 ? (
          <g>
            <line x1={-L + 10} y1={-56} x2={-L + 4} y2={-112} stroke={dark} strokeWidth={2.4} />
            <GlowS x={-L + 4} y={-118} r={90} color="255,180,90" opacity={0.6 * lamp} />
            <rect x={-L - 3} y={-126} width={14} height={14} rx={2} fill={`rgba(255,200,110,${0.5 + 0.5 * lamp})`} stroke={dark} strokeWidth={1.4} />
          </g>
        ) : null}
        {front}
      </g>
      {water !== null ? <WaterLip x0={-L - 40} x1={L + 40} color={ink(water)} f={f} rough={storm} /> : null}
      {storm > 0
        ? Array.from({ length: 10 }, (_, i) => {
            const age = mod(f * 1.3 + i * 9 + random(`${seed}sp${i}`) * 20, 40) / 40;
            return <circle key={i} cx={L * 0.8 + age * 90 * (random(`${seed}sx${i}`) - 0.2)} cy={-20 - age * 70 + age * age * 60} r={3 + age * 5} fill={`rgba(226,236,244,${(0.5 * storm * (1 - age)).toFixed(3)})`} />;
          })
        : null}
    </g>
  );
};

/**
 * A fishing net. `mode` "water": hanging in the water below the surface at y (floats along the top, the mesh bag bulging
 * with `haul` 0..1 of silver fish; `tear` 0..1 breaks strands, Luke 5:6); "heap": a pile of net on the shore with the
 * catch spilling round it (John 21: 153 fish). Person scale; default w = 300 (water: bag up to `depth` 120 deep).
 */
export const FishNet: React.FC<Base & { w?: number; depth?: number; haul?: number; tear?: number; mode?: "water" | "heap"; seed?: string; water?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  w = 300,
  depth = 120,
  haul = 0.5,
  tear = 0,
  mode = "water",
  seed = "fn",
  water = "#2A4A5A",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const clip = useUid("fnc");
  const meshC = ink("#B8AA88");
  const fishC = ink("#B8C4C4");
  const fish = (fx: number, fy: number, a: number, l: number, key: string) => (
    <g key={key} transform={`translate(${fx.toFixed(1)} ${fy.toFixed(1)}) rotate(${a.toFixed(1)})`}>
      <path d={`M ${-l / 2} 0 Q 0 ${-l * 0.26} ${l / 2} 0 Q 0 ${l * 0.26} ${-l / 2} 0 Z M ${-l / 2} 0 L ${-l * 0.72} ${-l * 0.16} L ${-l * 0.72} ${l * 0.16} Z`} fill={fishC} stroke={rim(0.5)} strokeWidth={0.6} />
      <line x1={-l * 0.1} y1={-l * 0.08} x2={l * 0.2} y2={-l * 0.08} stroke="rgba(255,255,255,0.6)" strokeWidth={0.8} />
    </g>
  );
  if (mode === "heap") {
    const n = Math.round(10 + haul * 34);
    const mound = `M ${-w / 2} 0 Q ${-w * 0.36} ${-26 - 20 * haul} ${-w * 0.1} ${-34 - 24 * haul} Q ${w * 0.16} ${-40 - 20 * haul} ${w * 0.34} ${-22 - 10 * haul} Q ${w * 0.46} -8 ${w / 2} 0 Z`;
    return (
      <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
        <ellipse cx={0} cy={2} rx={w * 0.6} ry={8} fill="rgba(0,0,0,0.3)" />
        <defs>
          <clipPath id={clip}>
            <path d={mound} />
          </clipPath>
        </defs>
        <path d={mound} fill={ink("#6A5E46")} stroke={rim(0.7)} strokeWidth={1.1} />
        <g clipPath={`url(#${clip})`}>
          {Array.from({ length: 26 }, (_, i) => (
            <g key={i}>
              <line x1={-w / 2 + i * (w / 20)} y1={-70} x2={-w / 2 + i * (w / 20) - 40} y2={4} stroke={meshC} strokeWidth={0.8} opacity={0.7} />
              <line x1={-w / 2 + i * (w / 20) - 40} y1={-70} x2={-w / 2 + i * (w / 20)} y2={4} stroke={meshC} strokeWidth={0.8} opacity={0.7} />
            </g>
          ))}
          {Array.from({ length: Math.round(n * 0.6) }, (_, i) => fish(range(`${seed}hx${i}`, -w * 0.4, w * 0.4), -range(`${seed}hy${i}`, 6, 40 * haul + 8), range(`${seed}ha${i}`, -30, 30), range(`${seed}hl${i}`, 20, 30), `h${i}`))}
        </g>
        {Array.from({ length: Math.round(n * 0.4) }, (_, i) => fish(range(`${seed}gx${i}`, -w * 0.62, w * 0.62), range(`${seed}gy${i}`, -3, 6), range(`${seed}ga${i}`, -14, 14), range(`${seed}gl${i}`, 22, 32), `g${i}`))}
        {[-0.3, -0.05, 0.22].map((u, i) => (
          <ellipse key={i} cx={u * w} cy={-30 - 18 * haul + (i % 2) * 8} rx={4} ry={2.6} fill={ink("#C8A060")} />
        ))}
      </g>
    );
  }
  const d = depth * (0.7 + 0.5 * haul);
  const bag = `M ${-w / 2} 0 Q ${-w * 0.5} ${d * 0.8} ${-w * 0.1} ${d} Q ${w * 0.3} ${d * 1.04} ${w * 0.48} ${d * 0.5} L ${w / 2} 0 Z`;
  const n = Math.round(haul * 46);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <defs>
        <clipPath id={clip}>
          <path d={bag} />
        </clipPath>
      </defs>
      <path d={bag} fill={tone(ink(water), -0.35)} opacity={0.55} />
      <g clipPath={`url(#${clip})`}>
        {Array.from({ length: n }, (_, i) => {
          const fx = range(`${seed}x${i}`, -w * 0.45, w * 0.42);
          const fy = range(`${seed}y${i}`, 10, d * 0.95);
          return fish(fx + Math.sin(f * 0.2 + i) * 3, fy + Math.cos(f * 0.17 + i) * 2, range(`${seed}a${i}`, -40, 40) + Math.sin(f * 0.3 + i) * 12, range(`${seed}l${i}`, 18, 28), `f${i}`);
        })}
        {Array.from({ length: 24 }, (_, i) => {
          const broken = tear > 0 && random(`${seed}t${i}`) < tear * 0.5;
          return broken ? null : (
            <g key={`m${i}`}>
              <line x1={-w / 2 + i * (w / 16)} y1={0} x2={-w / 2 + i * (w / 16) - 60} y2={d + 10} stroke={meshC} strokeWidth={0.9} opacity={0.75} />
              <line x1={-w / 2 + i * (w / 16) - 60} y1={0} x2={-w / 2 + i * (w / 16)} y2={d + 10} stroke={meshC} strokeWidth={0.9} opacity={0.75} />
            </g>
          );
        })}
      </g>
      <path d={bag} fill="none" stroke={meshC} strokeWidth={1.6} opacity={0.8} />
      <path d={`M ${-w / 2} 0 L ${w / 2} 0`} stroke={ink("#9A8A68")} strokeWidth={2.4} />
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={i} cx={-w / 2 + (i + 0.5) * (w / 9)} cy={-1 + Math.sin(f * 0.1 + i) * 1.5} rx={6} ry={3.4} fill={ink("#C8A060")} stroke={rim(0.6)} strokeWidth={0.8} />
      ))}
      {haul > 0.5
        ? Array.from({ length: 8 }, (_, i) => {
            const age = mod(f + i * 7 + random(`${seed}s${i}`) * 30, 34) / 34;
            const sx = range(`${seed}sx${i}`, -w * 0.4, w * 0.4);
            return <circle key={`s${i}`} cx={sx} cy={-age * 26 + age * age * 22} r={2 + age * 2} fill={`rgba(230,240,248,${(0.7 * (haul - 0.5) * 2 * (1 - age)).toFixed(3)})`} />;
          })
        : null}
    </g>
  );
};

// ── Nativity ──────────────────────────────────────────────────────────────────────────────

/** A stone feeding trough heaped with straw (Luke 2:7); `baby` lays the swaddled child in it, `glow` lights him softly.
 *  Person scale: rim at -56, default w = 120. */
export const Manger: React.FC<Base & { baby?: boolean; glow?: number; w?: number; seed?: string }> = ({ x, y, s = 1, flip = false, baby = true, glow = 0, w = 120, seed = "mg" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const stone = ink("#9A8C74");
  const straw = ink("#C8A65A");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.62} ry={6} fill="rgba(0,0,0,0.35)" />
      {glow > 0 ? <GlowS x={0} y={-60} r={w * 1.3} squash={0.75} color="255,226,170" opacity={0.6 * glow} /> : null}
      <path d={`M ${-w / 2} -56 L ${w / 2} -56 L ${w / 2 - 12} 0 L ${-w / 2 + 12} 0 Z`} fill={stone} stroke={rim(0.9)} strokeWidth={1.3} />
      <path d={`M ${-w / 2 + 8} -46 L ${w / 2 - 8} -46`} stroke={tone(stone, -0.25)} strokeWidth={1.4} />
      <path d={`M ${-w / 2 + 14} -14 L ${w / 2 - 14} -14`} stroke={tone(stone, -0.2)} strokeWidth={1.1} />
      {Array.from({ length: 18 }, (_, i) => {
        const sx = -w / 2 + 4 + (i / 17) * (w - 8);
        const a = range(`${seed}a${i}`, -0.9, 0.9);
        const l = range(`${seed}l${i}`, 10, 18);
        return <line key={i} x1={sx} y1={-55} x2={sx + Math.sin(a) * l} y2={-55 - Math.cos(a) * l * 0.6} stroke={i % 3 ? straw : tone(straw, 0.2)} strokeWidth={1.4} strokeLinecap="round" />;
      })}
      {baby ? (
        <g>
          <path d={`M -30 -60 Q -32 -74 -14 -76 L 18 -76 Q 30 -74 30 -64 Q 28 -56 14 -56 L -20 -56 Q -30 -56 -30 -60 Z`} fill={glow > 0 ? mixHex(ink("#E8DFCC"), "#FFF8EA", glow * 0.6) : ink("#E8DFCC")} stroke={glow > 0 ? "rgba(255,240,210,0.9)" : rim(0.8)} strokeWidth={1.1} />
          {[-16, -4, 8].map((o) => (
            <path key={o} d={`M ${o} -75 Q ${o + 4} -66 ${o} -57`} stroke={ink("#B8AE98")} strokeWidth={1} fill="none" />
          ))}
          <circle cx={30} cy={-68} r={8} fill={ink(glow > 0 ? "#B07A58" : "#8A5A40")} stroke={rim(0.6)} strokeWidth={0.8} />
          <path d="M 26 -76 Q 36 -78 37 -68" stroke={ink("#E8DFCC")} strokeWidth={3} fill="none" />
        </g>
      ) : null}
    </g>
  );
};

/** The star of Bethlehem at (x, y): a bright core, a long cross of rays and four short diagonals that breathe gently;
 *  `beam` lowers a faint ray toward the ground (length in units), `p` fades it in. Size via r (core radius, default 9). */
export const BethlehemStar: React.FC<{ x: number; y: number; r?: number; rays?: number; beam?: number; p?: number; seed?: string }> = ({ x, y, r = 9, rays = 1, beam = 0, p = 1, seed = "bs" }) => {
  const f = useCurrentFrame();
  const gid = useUid("bsg");
  const bid = useUid("bsb");
  if (p <= 0.001) return null;
  const tw = 0.92 + 0.08 * Math.sin(f * 0.11 + random(seed) * 6);
  const ray = (a: number, len: number, w: number, k: string) => {
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return <path key={k} d={`M ${x - sn * w} ${y + c * w} L ${x + c * len} ${y + sn * len} L ${x + sn * w} ${y - c * w} L ${x - c * len} ${y - sn * len} Z`} fill={`url(#${gid})`} opacity={rays * tw} />;
  };
  return (
    <SvgIfLoose>
      <g opacity={p}>
        <defs>
          <radialGradient id={gid} cx={x} cy={y} r={r * 16} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgb(255,252,240)" stopOpacity={1} />
            <stop offset="0.35" stopColor="rgb(255,236,190)" stopOpacity={0.5} />
            <stop offset="1" stopColor="rgb(255,226,170)" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={bid} gradientUnits="userSpaceOnUse" x1={0} y1={y} x2={0} y2={y + Math.max(1, beam)}>
            <stop offset="0" stopColor="rgb(255,244,214)" stopOpacity={0.26} />
            <stop offset="0.6" stopColor="rgb(255,240,206)" stopOpacity={0.1} />
            <stop offset="1" stopColor="rgb(255,240,206)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {beam > 0 ? <path d={`M ${x - r * 0.3} ${y} L ${x + r * 0.3} ${y} L ${x + r * 2.6} ${y + beam} L ${x - r * 2.6} ${y + beam} Z`} fill={`url(#${bid})`} /> : null}
        <GlowS x={x} y={y} r={r * 14 * tw} color="255,230,180" opacity={0.55} />
        <GlowS x={x} y={y} r={r * 4} color="255,248,230" opacity={0.85} />
        {ray(Math.PI / 2, r * 15, r * 0.34, "v")}
        {ray(0, r * 10, r * 0.3, "h")}
        {ray(Math.PI / 4, r * 5 * tw, r * 0.22, "d1")}
        {ray(-Math.PI / 4, r * 5 * tw, r * 0.22, "d2")}
        <circle cx={x} cy={y} r={r} fill="#FFFDF6" />
      </g>
    </SvgIfLoose>
  );
};

// ── Signs and miracles ────────────────────────────────────────────────────────────────────

/** The six stone water jars of Cana (John 2:6) in a row centred on x, each about waist high (96). `fill` 0..1 raises the
 *  water to the brim, `wine` 0..1 turns it to wine, `glow` sparkles the change. Person scale; spacing `gap` 64. */
export const WaterJars: React.FC<Base & { n?: number; gap?: number; fill?: number; wine?: number; glow?: number }> = ({ x, y, s = 1, n = 6, gap = 64, fill = 1, wine = 0, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const stone = ink("#B4A68A");
  const liquid = mixHex(ink("#5E86A0"), ink("#7A1E30"), wine);
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={(n * gap) / 2 + 30} ry={8} fill="rgba(0,0,0,0.3)" />
      {Array.from({ length: n }, (_, i) => {
        const jx = (i - (n - 1) / 2) * gap;
        const sh = i % 2 ? 0.04 : -0.04;
        return (
          <g key={i} transform={`translate(${jx} 0)`}>
            <path d="M -24 -84 L 24 -84 Q 28 -40 22 -8 Q 18 0 0 0 Q -18 0 -22 -8 Q -28 -40 -24 -84 Z" fill={tone(stone, sh)} stroke={rim(0.9)} strokeWidth={1.3} />
            {[-14, -5, 4, 13].map((o) => (
              <line key={o} x1={o} y1={-80} x2={o * 0.9} y2={-8} stroke={tone(stone, -0.18)} strokeWidth={1} />
            ))}
            <rect x={-28} y={-96} width={56} height={13} rx={4} fill={tone(stone, 0.06)} stroke={rim(0.9)} strokeWidth={1.2} />
            <ellipse cx={0} cy={-96} rx={24} ry={5} fill={tone(stone, -0.45)} />
            {fill > 0 ? <ellipse cx={0} cy={-96 + 3 * (1 - fill)} rx={21 * (0.6 + 0.4 * fill)} ry={3.6} fill={liquid} opacity={0.95} /> : null}
            {glow > 0 ? <circle cx={-6 + Math.sin(f * 0.2 + i) * 8} cy={-98} r={2} fill="#FFF0D0" opacity={glow * (0.5 + 0.5 * Math.sin(f * 0.3 + i * 2))} /> : null}
          </g>
        );
      })}
      {glow > 0 ? <GlowS x={0} y={-96} r={(n * gap) / 2 + 40} squash={0.3} color="255,214,170" opacity={0.4 * glow} /> : null}
    </g>
  );
};

/** Woven baskets of round loaves (and two fish with `fish`): the boy's five loaves, or the twelve baskets left over.
 *  `n` baskets in a row from x at spacing `gap` (default 52), each 46 wide and 30 tall; `full` 0..1 heaps the bread. */
export const LoafBaskets: React.FC<Base & { n?: number; gap?: number; full?: number; fish?: boolean; seed?: string }> = ({ x, y, s = 1, n = 1, gap = 52, full = 1, fish = false, seed = "lb" }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const k = s * band.k;
  const wk = ink("#8A6A3A");
  const bread = ink("#C8955A");
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const bx = x + (i - (n - 1) / 2) * gap * k + range(`${seed}j${i}`, -4, 4) * k;
        const by = y ?? band.gy(bx);
        const m = Math.round(2 + full * 4);
        return (
          <g key={i} transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(${k})`}>
            <ellipse cx={0} cy={0} rx={28} ry={4} fill="rgba(0,0,0,0.32)" />
            {Array.from({ length: m }, (_, j) => (
              <ellipse key={j} cx={-14 + (j % 4) * 9.5 + (j >= 4 ? 5 : 0)} cy={-28 - (j >= 4 ? 7 : 0) - full * 2} rx={7.5} ry={5} fill={tone(bread, j % 2 ? 0.06 : -0.06)} stroke={rim(0.5)} strokeWidth={0.6} />
            ))}
            {fish ? (
              <g>
                {[0, 1].map((j) => (
                  <path key={j} d={`M ${-6 + j * 10} -40 Q ${0 + j * 10} -34 ${-2 + j * 10} -24 L ${2 + j * 10} -20 L ${-6 + j * 10} -20 L ${-4 + j * 10} -24 Q ${-11 + j * 10} -34 ${-6 + j * 10} -40 Z`} fill={ink("#9AA6A2")} stroke={rim(0.5)} strokeWidth={0.6} />
                ))}
              </g>
            ) : null}
            <path d="M -23 -28 Q -22 -4 -14 0 L 14 0 Q 22 -4 23 -28 Z" fill={wk} stroke={rim(0.9)} strokeWidth={1.1} />
            <path d="M -23 -28 Q 0 -24 23 -28" stroke={tone(wk, 0.2)} strokeWidth={2.4} fill="none" />
            {[-14, -5, 4, 13].map((o) => (
              <line key={o} x1={o} y1={-25} x2={o * 0.75} y2={-2} stroke={tone(wk, -0.3)} strokeWidth={1} />
            ))}
            {[-17, -10].map((yy) => (
              <path key={yy} d={`M -21 ${yy} Q 0 ${yy + 3} 21 ${yy}`} stroke={tone(wk, -0.3)} strokeWidth={1} fill="none" />
            ))}
          </g>
        );
      })}
    </g>
  );
};

/** A fig tree in leaf (or a sycamore-fig with `sycamore`, broad low limbs that a short man can climb: Zacchaeus).
 *  `wither` 0..1 browns the leaves, drops them and leaves it bare (Mark 11:20); `inTree` is drawn among the branches at
 *  the main fork (fig: (6, -128); sycamore: (-14, -176)), between the back and front foliage. Person scale: fig 250
 *  tall, sycamore 330. */
export const FigTree: React.FC<Base & { wither?: number; sycamore?: boolean; seed?: string; inTree?: React.ReactNode; fruit?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  wither = 0,
  sycamore = false,
  seed = "ft",
  inTree,
  fruit = 0,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const H = sycamore ? 330 : 250;
  const bark = ink(sycamore ? "#6A6050" : "#7A6E5E");
  const leafC = mixHex(ink(sycamore ? "#3E5A2C" : "#4A6A2E"), ink("#6A5030"), clamp1(wither * 1.4));
  const fork: Pt = sycamore ? [-14, -176] : [6, -128];
  const keep = 1 - clamp1((wither - 0.25) / 0.75);
  const sway = Math.sin(f * 0.03 + random(seed) * 6) * 1.4 * keep;
  const limbs: [number, number, number, number, number][] = sycamore
    ? [[fork[0], fork[1], -150, -250, 9], [fork[0], fork[1], 140, -240, 9], [fork[0], fork[1], -40, -320, 8], [fork[0] - 4, fork[1] + 30, -190, -150, 8], [fork[0] + 4, fork[1] + 26, 190, -160, 8], [fork[0], fork[1], 60, -300, 7]]
    : [[fork[0], fork[1], -90, -200, 6], [fork[0], fork[1], 80, -210, 6], [fork[0], fork[1], 0, -240, 5], [fork[0] - 2, fork[1] + 20, -110, -140, 5], [fork[0] + 2, fork[1] + 20, 104, -150, 5]];
  const crown = useBlobs(seed, sycamore ? 16 : 13, sycamore ? 190 : 120, sycamore ? 70 : 64, -H * 0.82, sycamore ? 34 : 30);
  const leaf = (lx: number, ly: number, sc: number, a: number, key: string) => (
    <path
      key={key}
      transform={`translate(${lx.toFixed(1)} ${ly.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${sc.toFixed(2)})`}
      d="M 0 0 C -6 -4 -14 -2 -16 -10 C -10 -12 -8 -16 -10 -22 C -4 -20 -2 -24 0 -30 C 2 -24 4 -20 10 -22 C 8 -16 10 -12 16 -10 C 14 -2 6 -4 0 0 Z"
      fill={leafC}
      stroke={tone(leafC, -0.3)}
      strokeWidth={0.8}
    />
  );
  const fallen = clamp1(wither * 1.2);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={sycamore ? 110 : 70} ry={8} fill="rgba(0,0,0,0.3)" />
      {crown.slice(0, Math.ceil(crown.length * keep)).map((b, i) => (
        <circle key={`s${i}`} cx={b.x + 5 + sway} cy={b.y + 6} r={b.r * (0.7 + 0.3 * keep)} fill={tone(leafC, -0.4)} />
      ))}
      {limbs.map((l, i) => (
        <path key={`l${i}`} d={`M ${l[0]} ${l[1]} Q ${(l[0] + l[2]) / 2 + (i % 2 ? 14 : -14)} ${(l[1] + l[3]) / 2 + 10} ${l[2] + sway} ${l[3]}`} stroke={bark} strokeWidth={l[4]} fill="none" strokeLinecap="round" />
      ))}
      <path d={sycamore ? `M -34 0 Q -24 -90 ${fork[0] - 16} ${fork[1]} L ${fork[0] + 14} ${fork[1]} Q 26 -90 40 0 Z` : `M -14 0 Q -10 -70 ${fork[0] - 8} ${fork[1]} L ${fork[0] + 8} ${fork[1]} Q 12 -70 16 0 Z`} fill={bark} stroke={rim(0.8)} strokeWidth={1.2} />
      {inTree ? (
        <NoScale>
          <g transform={`translate(${fork[0]} ${fork[1]})`}>{inTree}</g>
        </NoScale>
      ) : null}
      {crown.slice(0, Math.ceil(crown.length * keep)).map((b, i) => (
        <circle key={`c${i}`} cx={b.x + sway} cy={b.y} r={b.r * (0.7 + 0.3 * keep)} fill={leafC} opacity={i % 3 === 0 ? 0.92 : 1} />
      ))}
      {keep > 0
        ? crown.slice(0, Math.ceil(crown.length * keep)).map((b, i) =>
            i % 2 === 0 ? leaf(b.x + b.r * 0.6 * Math.cos(i * 1.7) + sway, b.y + b.r * 0.5 * Math.sin(i * 1.7), 0.9 + 0.3 * keep, i * 47, `lf${i}`) : null,
          )
        : null}
      {crown.slice(0, Math.ceil(crown.length * keep)).map((b, i) =>
        b.y < -H * 0.86 ? <path key={`r${i}`} d={`M ${b.x - b.r * 0.8 + sway} ${b.y - b.r * 0.4} A ${b.r} ${b.r} 0 0 1 ${b.x + b.r * 0.7 + sway} ${b.y - b.r * 0.55}`} stroke={rim(0.7)} strokeWidth={1.3} fill="none" /> : null,
      )}
      {fruit > 0
        ? crown.map((b, i) => (i % 3 === 1 ? <circle key={`fr${i}`} cx={b.x + b.r * 0.3 + sway} cy={b.y + b.r * 0.5} r={3.6 * fruit} fill={ink("#6A3A5A")} /> : null))
        : null}
      {fallen > 0
        ? Array.from({ length: 12 }, (_, i) => leaf(range(`${seed}fx${i}`, -120, 120), range(`${seed}fy${i}`, -3, 6), 0.6, range(`${seed}fa${i}`, 60, 120), `fl${i}`)).slice(0, Math.round(12 * fallen))
        : null}
    </g>
  );
};

const useBlobs = (seed: string, n: number, rx: number, ry: number, cy: number, r: number) => {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = random(`${seed}ba${i}`) * Math.PI * 2;
    const rr = Math.sqrt(random(`${seed}br${i}`));
    out.push({ x: Math.cos(a) * rx * rr, y: cy + Math.sin(a) * ry * rr, r: range(`${seed}bs${i}`, r * 0.7, r * 1.15) });
  }
  return out.sort((a, b) => b.y - a.y);
};

// ── Passion and resurrection (restrained) ─────────────────────────────────────────────────

/** A tall plain wooden cross as a dark silhouette for distant views (never with a figure): base at y = 0 on a low mound
 *  of stones, upright `h` (300 ≈ 1.7 men), crossbar `w` 150 at 0.78h, a small blank `sign` board on top. `lit` adds a thin
 *  rim of light; `color` the wood (near black by default). */
export const Cross: React.FC<Base & { h?: number; w?: number; sign?: boolean; color?: string; lit?: number; mound?: boolean }> = ({ x, y, s = 1, h = 300, w = 150, sign = true, color = "#17120E", lit = 0.5, mound = true }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const bar = h * 0.78;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.4} ry={5} fill="rgba(0,0,0,0.4)" />
      <rect x={-7} y={-h} width={14} height={h} fill={c} stroke={rim(lit)} strokeWidth={1.2} />
      <rect x={-w / 2} y={-bar - 7} width={w} height={13} fill={c} stroke={rim(lit)} strokeWidth={1.2} />
      {sign ? <rect x={-20} y={-h - 4} width={40} height={18} fill={tone(c, 0.12)} stroke={rim(lit * 0.8)} strokeWidth={1} /> : null}
      {mound ? <path d={`M ${-w * 0.36} 2 Q ${-w * 0.2} -18 0 -20 Q ${w * 0.2} -18 ${w * 0.36} 2 Z`} fill={tone(c, 0.1)} stroke={rim(lit * 0.6)} strokeWidth={1} /> : null}
    </g>
  );
};

/** The title over the cross (John 19:19–20), close up and on its own: a weathered board with JESUS OF NAZARETH, THE KING
 *  OF THE JEWS in Hebrew, Latin and Greek. Plain SVG centred at (x, y), `w` wide (default 520 × 150); `p` fades it in. */
export const CrossSign: React.FC<{ x: number; y: number; w?: number; p?: number }> = ({ x, y, w = 520, p = 1 }) => {
  const h = w * 0.29;
  if (p <= 0.001) return null;
  const paint = "#2A1A10";
  const lines: { t: string; font: string; dir?: "rtl" }[] = [
    { t: "ישוע הנצרי מלך היהודים", font: "'David', 'Times New Roman', serif", dir: "rtl" },
    { t: "IESVS NAZARENVS REX IVDAEORVM", font: fonts.display },
    { t: "ΙΗΣΟΥΣ Ο ΝΑΖΩΡΑΙΟΣ Ο ΒΑΣΙΛΕΥΣ ΤΩΝ ΙΟΥΔΑΙΩΝ", font: "'Palatino Linotype', 'Times New Roman', serif" },
  ];
  return (
    <SvgIfLoose>
      <g opacity={p}>
        <rect x={x - w / 2 + 6} y={y - h / 2 + 8} width={w} height={h} fill="rgba(0,0,0,0.4)" />
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={3} fill="#B39468" stroke="#5A4028" strokeWidth={3} />
        {[0.18, 0.5, 0.82].map((t) => (
          <path key={t} d={`M ${x - w / 2 + 4} ${y - h / 2 + h * t} q ${w * 0.3} ${4} ${w * 0.6} 0 t ${w * 0.38} 2`} stroke="rgba(90,64,40,0.35)" strokeWidth={1.2} fill="none" />
        ))}
        {lines.map((l, i) => (
          <text
            key={i}
            x={x}
            y={y - h / 2 + h * (0.3 + i * 0.27)}
            textAnchor="middle"
            dominantBaseline="middle"
            direction={l.dir}
            fontFamily={l.font}
            fontSize={h * 0.17}
            fontWeight={600}
            fill={paint}
            textLength={w * (i === 0 ? 0.62 : 0.86)}
            lengthAdjust="spacingAndGlyphs"
          >
            {l.t}
          </text>
        ))}
        {[-1, 1].map((d) => (
          <circle key={d} cx={x + d * (w / 2 - 14)} cy={y} r={4} fill="#4A3420" />
        ))}
      </g>
    </SvgIfLoose>
  );
};

/** The crown of thorns lying on a folded cloth (`cloth` colour, or null for bare ground), drawn with restraint: a dark
 *  woven ring, no blood. Person scale (ring 70 wide); scale it up with s for a close-up. */
export const CrownOfThorns: React.FC<Base & { cloth?: string | null }> = ({ x, y, s = 1, cloth = "#4A2444" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const tc = ink("#3A2A1A");
  const ring = (ph: number) => {
    const pts: Pt[] = Array.from({ length: 25 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const o = 2.4 * Math.sin(a * 5 + ph);
      return [Math.cos(a) * (34 + o), -16 + Math.sin(a) * (10 + o * 0.4)];
    });
    return smooth(pts, true, 0.5);
  };
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {cloth ? (
        <g>
          <path d="M -66 0 L -54 -10 L 62 -10 L 70 0 Z" fill={ink(cloth)} stroke={rim(0.7)} strokeWidth={1} />
          <path d="M -54 -10 L -50 -14 L 58 -14 L 62 -10 Z" fill={tone(ink(cloth), 0.15)} />
          <path d="M -20 -10 L -16 -2 M 22 -12 L 26 -1" stroke={tone(ink(cloth), -0.3)} strokeWidth={1} />
        </g>
      ) : (
        <ellipse cx={0} cy={0} rx={44} ry={5} fill="rgba(0,0,0,0.3)" />
      )}
      <path d={ring(0)} fill="none" stroke={tc} strokeWidth={3.4} />
      <path d={ring(Math.PI)} fill="none" stroke={ink("#5A4630")} strokeWidth={2.2} />
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + 0.2;
        const bx = Math.cos(a) * 35;
        const by = -16 + Math.sin(a) * 11;
        return <line key={i} x1={bx} y1={by} x2={bx + Math.cos(a + (i % 2 ? 0.5 : -0.5)) * 7} y2={by + Math.sin(a + (i % 2 ? 0.5 : -0.5)) * 4 - 2} stroke={tc} strokeWidth={1.2} strokeLinecap="round" />;
      })}
    </g>
  );
};

/** Door and stone of a RockTomb at s = 1: door top, door width, stone radius, the stone's centre x when rolled away. */
export const TOMB = { door: 150, doorW: 104, stone: 82, openX: -196 };

/**
 * A new tomb cut in the rock of a garden (Matthew 27:60, John 11:38, John 20): a limestone outcrop (default w = 560,
 * h = 330) with a carved doorway and a great round stone in its channel. `open` 0..1 rolls the stone away to the left
 * (it turns as it rolls); `seal` 0..1 strings a cord with a seal across it; `glow` lights the empty chamber; `clothes`
 * shows the linen lying inside once open. `onStone` is anchored on top of the stone wherever it is (a Person at
 * x = 0, y = 0 with pose sit: 1 sits on it: the angel of Matthew 28:2). Person scale; coordinates in TOMB.
 */
export const RockTomb: React.FC<Base & { w?: number; h?: number; open?: number; seal?: number; glow?: number; clothes?: boolean; onStone?: React.ReactNode; seed?: string; color?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  w = 560,
  h = 330,
  open = 0,
  seal = 0,
  glow = 0,
  clothes = true,
  onStone,
  seed = "rt",
  color = "#9A8C72",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = Math.PI * t;
    pts.push([-(w / 2) * Math.cos(a) + range(`${seed}x${i}`, -14, 14), -h * Math.pow(Math.sin(a), 0.7) + range(`${seed}y${i}`, -16, 16)]);
  }
  const rock = `M ${-w / 2 - 20} 0 ${pts.map((q) => `L ${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ")} L ${w / 2 + 20} 0 Z`;
  const R = TOMB.stone;
  const dw = TOMB.doorW;
  const sx = lerp(0, TOMB.openX, clamp1(open));
  const spin = (sx / R) * (180 / Math.PI);
  const inside = glow > 0 ? mixHex("#0C0806", "#C8A070", glow * 0.6) : "#0C0806";
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={2} rx={w * 0.58} ry={10} fill="rgba(0,0,0,0.35)" />
      {glow > 0 ? <GlowS x={0} y={-80} r={w * 0.5} squash={0.8} color="255,226,180" opacity={0.4 * glow} /> : null}
      <path d={rock} fill={c} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M ${range(`${seed}a${i}`, -w * 0.42, w * 0.1)} ${-range(`${seed}b${i}`, 170, h * 0.9)} q ${range(`${seed}c${i}`, 40, 90)} ${range(`${seed}d${i}`, 8, 24)} ${range(`${seed}e${i}`, 90, 170)} 0`} stroke={tone(c, -0.22)} strokeWidth={2} fill="none" />
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const tx = range(`${seed}gx${i}`, -w * 0.4, w * 0.4);
        const ty = -h * Math.pow(Math.max(0, 1 - Math.pow((tx * 2) / w, 2)), 0.7 * 0.5) + 6;
        return <path key={`g${i}`} d={`M ${tx} ${ty} l -4 -14 M ${tx} ${ty} l 2 -16 M ${tx} ${ty} l 7 -12`} stroke={ink("#4A5A30")} strokeWidth={2} strokeLinecap="round" />;
      })}
      <path d={`M ${-dw / 2 - 14} 0 L ${-dw / 2 - 14} ${-TOMB.door - 10} Q 0 ${-TOMB.door - 22} ${dw / 2 + 14} ${-TOMB.door - 10} L ${dw / 2 + 14} 0 Z`} fill={tone(c, -0.18)} />
      <path d={`M ${-dw / 2} 0 L ${-dw / 2} ${-TOMB.door + 8} Q 0 ${-TOMB.door - 6} ${dw / 2} ${-TOMB.door + 8} L ${dw / 2} 0 Z`} fill={inside} />
      {clothes && open > 0.3 ? (
        <g opacity={clamp1((open - 0.3) / 0.4)}>
          <path d={`M ${-dw / 2 + 8} -36 L ${dw / 2 - 8} -36 L ${dw / 2 - 8} -28 L ${-dw / 2 + 8} -28 Z`} fill={tone(inside, 0.12)} />
          <path d={`M ${-dw / 2 + 12} -38 Q ${-dw / 2 + 30} -46 ${dw / 2 - 26} -42 L ${dw / 2 - 14} -38 Z`} fill={ink("#E6DECC")} opacity={0.85} />
          <rect x={dw / 2 - 28} y={-48} width={14} height={6} rx={2} fill={ink("#E6DECC")} opacity={0.85} />
        </g>
      ) : null}
      <path d={`M ${TOMB.openX - R - 20} 2 L ${dw / 2 + 30} 2 L ${dw / 2 + 30} -10 L ${TOMB.openX - R - 20} -10 Z`} fill={tone(c, -0.28)} />
      <g transform={`translate(${sx} ${-R}) rotate(${spin})`}>
        <circle cx={0} cy={0} r={R} fill={tone(c, -0.12)} stroke={rim(1)} strokeWidth={1.8} />
        <circle cx={0} cy={0} r={R * 0.74} fill="none" stroke={tone(c, -0.3)} strokeWidth={1.6} />
        <line x1={-R * 0.5} y1={-R * 0.2} x2={R * 0.4} y2={R * 0.46} stroke={tone(c, -0.36)} strokeWidth={1.4} />
        <circle cx={R * 0.2} cy={-R * 0.3} r={3} fill={tone(c, -0.3)} />
      </g>
      <path d={`M ${sx - R * 0.72} ${-R * 1.7} Q ${sx - R * 0.3} ${-R * 1.98} ${sx + R * 0.25} ${-R * 1.92}`} stroke="rgba(255,236,200,0.35)" strokeWidth={3} fill="none" />
      {seal > 0 && open < 0.05 ? (
        <g opacity={seal}>
          <path d={`M ${-R - 40} ${-R - 10} Q 0 ${-R + 20} ${R + 40} ${-R - 14}`} stroke={ink("#8A7A5A")} strokeWidth={1.6} fill="none" />
          <circle cx={-R - 40} cy={-R - 10} r={7} fill={ink("#8A2A1E")} stroke="rgba(255,220,180,0.5)" strokeWidth={0.8} />
          <circle cx={R + 40} cy={-R - 14} r={7} fill={ink("#8A2A1E")} stroke="rgba(255,220,180,0.5)" strokeWidth={0.8} />
        </g>
      ) : null}
      {onStone ? (
        <NoScale>
          <g transform={`translate(${sx} ${-2 * R + 40})`}>{onStone}</g>
        </NoScale>
      ) : null}
    </g>
  );
};

/** Linen grave clothes left in the tomb (John 20:6–7): "lying" the strips lying flat where the body lay (170 long), or
 *  "folded" the face cloth folded by itself. Person scale, base at y = 0. */
export const GraveClothes: React.FC<Base & { kind?: "lying" | "folded"; len?: number }> = ({ x, y, s = 1, flip = false, kind = "lying", len = 170 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const lin = ink("#E6DECC");
  if (kind === "folded")
    return (
      <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
        <ellipse cx={0} cy={0} rx={28} ry={3} fill="rgba(0,0,0,0.3)" />
        <path d="M -22 0 L -20 -10 L 22 -10 L 24 0 Z" fill={lin} stroke={rim(0.7)} strokeWidth={1} />
        <path d="M -20 -10 L -16 -15 L 18 -15 L 22 -10 Z" fill={tone(lin, -0.06)} stroke={rim(0.6)} strokeWidth={0.8} />
        <line x1={-20} y1={-5} x2={22} y2={-5} stroke={tone(lin, -0.2)} strokeWidth={0.9} />
      </g>
    );
  const L = len / 2;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={L + 10} ry={4} fill="rgba(0,0,0,0.3)" />
      <path d={`M ${-L} 0 Q ${-L - 4} -10 ${-L + 16} -12 Q 0 -9 ${L - 30} -12 Q ${L - 6} -14 ${L} -6 L ${L} 0 Z`} fill={lin} stroke={rim(0.7)} strokeWidth={1} />
      {Array.from({ length: 11 }, (_, i) => (
        <line key={i} x1={-L + 10 + i * (len / 11)} y1={-11} x2={-L + 4 + i * (len / 11)} y2={0} stroke={tone(lin, -0.2)} strokeWidth={1} />
      ))}
    </g>
  );
};

// ── Spirit ────────────────────────────────────────────────────────────────────────────────

/** The Spirit descending like a dove (Matthew 3:16): a white dove gliding down, wings spread at (x, y) facing right
 *  (flip for left), `flap` a phase for a slow wingbeat, `glow` 0..1 a soft light round it, `beam` a column of light above
 *  it reaching up `beam` units. Plain SVG; s = 1 is about 60 wide. */
export const Dove: React.FC<{ x: number; y: number; s?: number; flap?: number; glow?: number; flip?: boolean; beam?: number }> = ({ x, y, s = 1, flap = 0, glow = 0.7, flip = false, beam = 0 }) => {
  const id = useUid("dvb");
  const w = Math.sin(flap) * 0.5;
  const c = "#FBF8F0";
  return (
    <SvgIfLoose>
      {beam > 0 ? (
        <>
          <defs>
            <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={y - beam} x2={0} y2={y + 10 * s}>
              <stop offset="0" stopColor="rgb(255,244,214)" stopOpacity={0} />
              <stop offset="0.6" stopColor="rgb(255,244,214)" stopOpacity={0.12} />
              <stop offset="1" stopColor="rgb(255,244,214)" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <path d={`M ${x - 18 * s} ${y - beam} L ${x + 18 * s} ${y - beam} L ${x + 60 * s} ${y + 10 * s} L ${x - 60 * s} ${y + 10 * s} Z`} fill={`url(#${id})`} />
        </>
      ) : null}
      {glow > 0 ? <GlowS x={x} y={y} r={110 * s} color="255,240,210" opacity={0.7 * glow} /> : null}
      <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
        <path d={`M -4 -2 Q -18 ${-24 - 14 * w} -34 ${-30 - 18 * w} Q -24 ${-14 - 8 * w} -26 ${-6 - 4 * w} Q -14 -4 -4 2 Z`} fill={tone(c, -0.08)} stroke="rgba(255,226,170,0.8)" strokeWidth={0.8} />
        <path d="M -24 2 L -36 -2 L -38 6 L -24 6 Z" fill={c} stroke="rgba(255,226,170,0.7)" strokeWidth={0.7} />
        <ellipse cx={-6} cy={2} rx={20} ry={7} fill={c} stroke="rgba(255,226,170,0.8)" strokeWidth={0.8} />
        <circle cx={14} cy={-2} r={6} fill={c} stroke="rgba(255,226,170,0.8)" strokeWidth={0.8} />
        <path d="M 19 -2 L 25 0 L 19 1 Z" fill="#D8A060" />
        <circle cx={15.5} cy={-3.4} r={1} fill="#3A2A20" />
        <path d={`M 0 -2 Q 10 ${-28 - 16 * w} 30 ${-38 - 20 * w} Q 22 ${-18 - 8 * w} 22 ${-8 - 4 * w} Q 12 -4 4 2 Z`} fill={c} stroke="rgba(255,226,170,0.85)" strokeWidth={0.8} />
      </g>
    </SvgIfLoose>
  );
};

/** Tongues as of fire resting on each of them (Acts 2:3): a small flame over every point in `at` (head tops from rig()),
 *  `size` tall (default 30, scaled by the band's k), `p` 0..1 kindles them one after another. Points are in the units of
 *  the layer (put it inside the band of the people so a moving camera keeps it on their heads). */
export const TonguesOfFire: React.FC<{ at: Pt[]; size?: number; p?: number; seed?: string; gap?: number }> = ({ at, size: size0 = 30, p = 1, seed = "tf", gap: gap0 = 8 }) => {
  const f = useCurrentFrame();
  const k = useBand().k;
  const size = size0 * k;
  const gap = gap0 * k;
  return (
    <SvgIfLoose>
      {at.map(([px, py], i) => {
        const a = clamp1(p * (at.length + 2) - i * 1.0) * clamp1(p * 3);
        if (a <= 0.01) return null;
        const ph = random(`${seed}${i}`) * 6;
        const h = size * a * (0.9 + 0.1 * Math.sin(f * 0.4 + ph));
        const lean = Math.sin(f * 0.23 + ph) * size * 0.08;
        const w = size * 0.42;
        return (
          <g key={i} transform={`translate(${px.toFixed(1)} ${(py - gap).toFixed(1)})`}>
            <GlowS x={0} y={-h * 0.4} r={size * 1.6} color="255,170,80" opacity={0.6 * a} />
            <path d={flameD(0, w, h, lean)} fill="#FF7A22" opacity={0.92} />
            <path d={flameD(0, w * 0.6, h * 0.72, lean * 0.6)} fill="#FFB848" />
            <path d={flameD(0, w * 0.3, h * 0.44, lean * 0.3)} fill="#FFF4CC" />
          </g>
        );
      })}
    </SvgIfLoose>
  );
};

/** Peter's vision (Acts 10:11–12): a great linen sheet let down from heaven by its four corners, holding four-footed
 *  animals, reptiles and birds (dark silhouettes). Plain SVG; (x, y) is the bottom of the sheet's belly, `w` its width
 *  (default 520); `drop` 0..1 lowers it from far above; `glow` lights it from heaven. */
export const VisionSheet: React.FC<{ x: number; y: number; w?: number; drop?: number; glow?: number; seed?: string }> = ({ x, y, w = 520, drop = 1, glow = 0.7, seed = "vs" }) => {
  const f = useCurrentFrame();
  const yy = y - (1 - drop) * 1100;
  const sway = Math.sin(f * 0.04) * 6;
  const hw = w / 2;
  const top = yy - w * 0.32;
  const sil = "#2A2620";
  const sheet = `M ${x - hw + sway} ${top} Q ${x - hw * 0.6} ${yy + 6} ${x} ${yy} Q ${x + hw * 0.6} ${yy + 6} ${x + hw + sway} ${top} Q ${x} ${top + w * 0.1} ${x - hw + sway} ${top} Z`;
  return (
    <SvgIfLoose>
      {glow > 0 ? <GlowS x={x} y={top} r={w * 0.9} squash={0.8} color="255,240,214" opacity={0.6 * glow} /> : null}
      {[-1, 1].map((d) => (
        <g key={d}>
          <line x1={x + d * hw + sway} y1={top} x2={x + d * hw * 0.45} y2={top - 1400} stroke="rgba(255,244,220,0.55)" strokeWidth={1.4} />
          <line x1={x + d * hw * 0.82 + sway} y1={top - 18} x2={x + d * hw * 0.3} y2={top - 1400} stroke="rgba(255,244,220,0.35)" strokeWidth={1.2} />
        </g>
      ))}
      <path d={`M ${x - hw * 0.82 + sway} ${top - 18} Q ${x} ${top - 4} ${x + hw * 0.82 + sway} ${top - 18} L ${x + hw + sway} ${top} Q ${x} ${top + w * 0.1} ${x - hw + sway} ${top} Z`} fill="#D8D0C0" />
      <g transform={`translate(${x} ${top + w * 0.06})`}>
        <NoScale>
          {[
            ["camel", -hw * 0.5, 0.55, false],
            ["goat", -hw * 0.15, 0.7, true],
            ["sheep", hw * 0.12, 0.72, false],
            ["donkey", hw * 0.42, 0.62, true],
          ].map(([kind, ax, sc, fl], i) => (
            <Animal key={i} kind={kind as "camel"} x={ax as number} y={8} s={sc as number} flip={fl as boolean} tint={sil} />
          ))}
        </NoScale>
        <path d={`M ${-hw * 0.3} 6 q 12 -14 24 0 q 12 14 24 0 q 10 -10 18 -6`} stroke={sil} strokeWidth={5} fill="none" strokeLinecap="round" />
      </g>
      <path d={sheet} fill="#F2ECDF" stroke="rgba(255,236,200,0.9)" strokeWidth={1.4} />
      <path d={`M ${x - hw * 0.7 + sway} ${top + 14} Q ${x} ${yy - 10} ${x + hw * 0.7 + sway} ${top + 14}`} stroke="rgba(200,190,170,0.6)" strokeWidth={1.2} fill="none" />
      {Array.from({ length: 4 }, (_, i) => (
        <Bird key={i} x={x - hw * 0.4 + i * hw * 0.28 + Math.sin(f * 0.05 + i) * 10} y={top - 40 - (i % 2) * 30} s={0.8} color={sil} flap={f * 0.3 + i * 1.7} flip={i % 2 === 1} />
      ))}
    </SvgIfLoose>
  );
};

// ── Prison ────────────────────────────────────────────────────────────────────────────────

/** Wooden stocks on a prison floor (Acts 16:24): two beams between posts with leg holes, `w` wide (220), top beam at
 *  -40; `open` 0..1 lifts the top beam away (the earthquake). Put it just in front of the feet of seated prisoners. */
export const Stocks: React.FC<Base & { w?: number; open?: number; holes?: number }> = ({ x, y, s = 1, flip = false, w = 220, open = 0, holes = 4 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const wood = ink("#5A4430");
  const lift = clamp1(open);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.58} ry={5} fill="rgba(0,0,0,0.35)" />
      <rect x={-w / 2} y={-22} width={w} height={22} fill={wood} stroke={rim(0.8)} strokeWidth={1.2} />
      {Array.from({ length: holes }, (_, i) => (
        <path key={i} d={`M ${-w / 2 + (i + 0.5) * (w / holes) - 8} -22 A 8 8 0 0 0 ${-w / 2 + (i + 0.5) * (w / holes) + 8} -22 Z`} fill="#0C0806" />
      ))}
      {[-1, 1].map((d) => (
        <rect key={d} x={d * (w / 2 + 6) - 6} y={-54} width={12} height={54} fill={tone(wood, -0.15)} stroke={rim(0.8)} strokeWidth={1} />
      ))}
      <g transform={`translate(${-w / 2 - 6} -22) rotate(${-lift * 38}) translate(${w / 2 + 6} ${-lift * 6})`}>
        <rect x={-w / 2} y={-18} width={w} height={18} fill={tone(wood, 0.06)} stroke={rim(0.8)} strokeWidth={1.2} />
        {Array.from({ length: holes }, (_, i) => (
          <path key={i} d={`M ${-w / 2 + (i + 0.5) * (w / holes) - 8} 0 A 8 8 0 0 1 ${-w / 2 + (i + 0.5) * (w / holes) + 8} 0 Z`} fill="#0C0806" />
        ))}
        <circle cx={w / 2 - 8} cy={-9} r={3} fill={ink("#3A3A40")} />
      </g>
    </g>
  );
};

/** Iron chains hanging from a ring at (x, y) on a wall, `len` long (120) to a pair of shackles; `loose` 0..1 springs the
 *  shackles open and lets them swing (Acts 12:7, 16:26). Band units (scaled by the band's k). */
export const PrisonChains: React.FC<{ x: number; y: number; len?: number; loose?: number; s?: number; seed?: string }> = ({ x, y, len = 120, loose = 0, s = 1, seed = "pc" }) => {
  const k = s * useBand().k;
  const ink = useInk();
  const f = useCurrentFrame();
  const iron = ink("#6A6A72");
  const swing = loose > 0 ? Math.sin(f * 0.12 + random(seed) * 6) * 10 * loose : 0;
  const n = Math.max(4, Math.round(len / 9));
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle cx={0} cy={0} r={8} fill="none" stroke={iron} strokeWidth={3} />
      <rect x={-4} y={-14} width={8} height={8} fill={ink("#3A3A40")} />
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 1) / n;
        return <ellipse key={i} cx={swing * t * t} cy={8 + t * len} rx={i % 2 ? 1.8 : 3.4} ry={4.4} fill="none" stroke={iron} strokeWidth={1.6} />;
      })}
      {[-1, 1].map((d) => (
        <g key={d} transform={`translate(${swing + d * 9} ${len + 18}) rotate(${d * loose * 40})`}>
          <path d={`M -7 0 A 7 7 0 1 0 7 0`} fill="none" stroke={iron} strokeWidth={3} transform={loose > 0.3 ? `rotate(${d * 30})` : undefined} />
          <path d={`M -7 0 A 7 7 0 0 1 7 0`} fill="none" stroke={iron} strokeWidth={3} />
        </g>
      ))}
    </g>
  );
};

// ── Ephesus and Athens ────────────────────────────────────────────────────────────────────

/** Demetrius's workbench (Acts 19:24): a table (top at -64, 230 wide) with `n` small silver shrines of Artemis (34 tall)
 *  catching the light, a hammer and a little anvil. Person scale. */
export const SilverShrines: React.FC<Base & { n?: number; table?: boolean; glint?: number }> = ({ x, y, s = 1, flip = false, n = 5, table = true, glint = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const wood = ink("#5E4630");
  const silver = ink("#C8CCD4");
  const T = table ? -64 : 0;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={130} ry={6} fill="rgba(0,0,0,0.35)" />
      {table ? (
        <g>
          {[-96, 88].map((lx) => (
            <rect key={lx} x={lx} y={-60} width={9} height={60} fill={tone(wood, -0.25)} />
          ))}
          <rect x={-115} y={-66} width={230} height={9} rx={2} fill={wood} stroke={rim(0.8)} strokeWidth={1.1} />
        </g>
      ) : null}
      {Array.from({ length: n }, (_, i) => {
        const sx = -86 + (i / Math.max(1, n - 1)) * 150;
        const g = 0.5 + 0.5 * Math.sin(f * 0.15 + i * 1.7);
        return (
          <g key={i} transform={`translate(${sx} ${T})`}>
            <rect x={-12} y={-4} width={24} height={4} fill={tone(silver, -0.2)} />
            <rect x={-10} y={-24} width={3} height={20} fill={silver} />
            <rect x={7} y={-24} width={3} height={20} fill={silver} />
            <rect x={-7} y={-22} width={14} height={18} fill={tone(silver, -0.45)} />
            <path d="M -2 -6 L -1 -18 Q 0 -21 1 -18 L 2 -6 Z" fill={silver} />
            <path d="M -13 -24 L 0 -34 L 13 -24 Z" fill={silver} stroke={rim(0.6)} strokeWidth={0.7} />
            <circle cx={-4} cy={-28} r={1.6} fill="#FFFFFF" opacity={glint * g} />
          </g>
        );
      })}
      <g transform={`translate(96 ${T})`}>
        <rect x={-8} y={-10} width={16} height={10} fill={ink("#4A4A50")} />
        <line x1={-16} y1={-4} x2={-34} y2={-14} stroke={tone(wood, 0.1)} strokeWidth={2.4} />
        <rect x={-40} y={-20} width={10} height={7} rx={1} fill={ink("#5A5A60")} transform="rotate(-28 -35 -16)" />
      </g>
    </g>
  );
};

/** The cult image of Artemis of the Ephesians, kept abstract and dignified: a tall dark sheathed figure with gold bands,
 *  rows of ovoid ornaments, forearms held out, a tall cylindrical crown, on a plinth. Person scale: figure h = 240 above a
 *  60-high plinth (`plinth`); `glow` warms the gold. */
export const ArtemisStatue: React.FC<Base & { h?: number; plinth?: boolean; glow?: number }> = ({ x, y, s = 1, flip = false, h = 240, plinth = true, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const body = ink("#3A2C24");
  const gold = glow > 0 ? mixHex(ink("#C89A40"), "#FFE6A0", glow * 0.4) : ink("#C89A40");
  const P = plinth ? 60 : 0;
  const u = h / 240;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={60} ry={6} fill="rgba(0,0,0,0.35)" />
      {glow > 0 ? <GlowS x={0} y={-P - h * 0.6} r={h * 0.7} color="255,210,140" opacity={0.35 * glow} /> : null}
      {plinth ? (
        <g>
          <rect x={-50} y={-P} width={100} height={P} fill={ink("#B8AC96")} stroke={rim(0.9)} strokeWidth={1.2} />
          <rect x={-56} y={-P - 8} width={112} height={10} fill={ink("#C8BCA6")} stroke={rim(0.8)} strokeWidth={1} />
          <rect x={-56} y={-8} width={112} height={8} fill={ink("#A89C86")} />
        </g>
      ) : null}
      <g transform={`translate(0 ${-P - 8}) scale(${u})`}>
        <path d="M -22 0 L -20 -150 Q -26 -170 -16 -186 L 16 -186 Q 26 -170 20 -150 L 22 0 Z" fill={body} stroke={rim(0.9)} strokeWidth={1.3} />
        {[-30, -60, -90, -120].map((yy) => (
          <rect key={yy} x={-21} y={yy} width={42} height={4} fill={gold} />
        ))}
        {[0, 1, 2].map((r) =>
          [-10, 0, 10].map((cx) => <ellipse key={`${r}${cx}`} cx={cx} cy={-160 + r * 9} rx={4} ry={5} fill={gold} opacity={0.85} />),
        )}
        {[-1, 1].map((d) => (
          <path key={d} d={`M ${d * 16} -150 L ${d * 30} -128 L ${d * 44} -132`} stroke={body} strokeWidth={8} fill="none" strokeLinecap="round" />
        ))}
        <circle cx={0} cy={-198} r={13} fill={body} stroke={rim(0.8)} strokeWidth={1} />
        <path d="M -14 -206 L -16 -244 L 16 -244 L 14 -206 Z" fill={body} stroke={rim(0.8)} strokeWidth={1} />
        {[-214, -226, -238].map((yy) => (
          <rect key={yy} x={-15} y={yy} width={30} height={3} fill={gold} />
        ))}
      </g>
    </g>
  );
};

/** The Athenian altar Paul saw (Acts 17:23): a marble altar (130 wide, 118 tall) with a garland and the carved
 *  inscription ΑΓΝΩΣΤΩ ΘΕΩ ("to an unknown god"); `glow` 0..1 gilds the letters. Person scale. */
export const UnknownAltar: React.FC<Base & { glow?: number; text?: string }> = ({ x, y, s = 1, glow = 0, text = "ΑΓΝΩΣΤΩ ΘΕΩ" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const m = ink("#D2C8B4");
  const letter = glow > 0 ? mixHex(ink("#5A4A3A"), "#F4C978", glow) : ink("#5A4A3A");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={78} ry={6} fill="rgba(0,0,0,0.35)" />
      {glow > 0 ? <GlowS x={0} y={-62} r={110} squash={0.6} color="255,214,140" opacity={0.4 * glow} /> : null}
      <rect x={-66} y={-16} width={132} height={16} fill={tone(m, -0.08)} stroke={rim(0.8)} strokeWidth={1.1} />
      <rect x={-55} y={-96} width={110} height={80} fill={m} stroke={rim(0.9)} strokeWidth={1.3} />
      <rect x={-64} y={-108} width={128} height={13} fill={tone(m, 0.05)} stroke={rim(0.9)} strokeWidth={1.1} />
      {[-1, 1].map((d) => (
        <g key={d}>
          <ellipse cx={d * 52} cy={-114} rx={13} ry={7} fill={tone(m, 0.04)} stroke={rim(0.7)} strokeWidth={1} />
          <circle cx={d * 52} cy={-114} r={3} fill={tone(m, -0.2)} />
        </g>
      ))}
      <path d="M -50 -90 Q -25 -70 0 -90 Q 25 -70 50 -90" stroke={ink("#6A7A4A")} strokeWidth={4} fill="none" />
      <text x={0} y={-48} textAnchor="middle" fontFamily="'Palatino Linotype', 'Times New Roman', serif" fontSize={15} fontWeight={700} fill={letter} textLength={96} lengthAdjust="spacingAndGlyphs">
        {text}
      </text>
      <line x1={-46} y1={-36} x2={46} y2={-36} stroke={tone(m, -0.15)} strokeWidth={1} />
    </g>
  );
};

// ── Ships ─────────────────────────────────────────────────────────────────────────────────

/** Heights of a MerchantShip at s = 1 above its waterline: deck, top of the bulwark rail, mainmast truck. */
export const SHIP_H = { deck: 120, rail: 150, mast: 560 };

/**
 * An Alexandrian grain ship of the kind Paul sailed in (Acts 27): a deep hull about `len` 900 long, the stern on the left
 * with a curving swan-neck post and two steering oars, a deckhouse aft, a great square mainsail with a slanting foresail
 * (artemon) over the bow. Waterline at y = 0 (set y on the water). `sail` 0..1 furled to full; `storm` reefs and frays
 * the sail; `roll` tilts (degrees), `bob` lifts; `aground` 0..1 drives the bow up onto a reef; `broken` 0..1 breaks the
 * stern away (Acts 27:41); `lit` lights the stern lanterns. `deck` is anchored on the deck amidships (a Person at y = 0,
 * x within ±300 stands on it, the rail at knee height). Person scale.
 */
export const MerchantShip: React.FC<
  Base & { len?: number; sail?: number; storm?: number; roll?: number; bob?: number; deck?: React.ReactNode; broken?: number; aground?: number; water?: string | null; lit?: number; seed?: string }
> = ({ x, y, s = 1, flip = false, len = 900, sail = 1, storm = 0, roll = 0, bob = 0, deck, broken = 0, aground = 0, water = "#2A4050", lit = 0, seed = "ms" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const wood = ink("#4E3624");
  const dark = tone(wood, -0.35);
  const sailC = ink(storm > 0.5 ? "#B8AC92" : "#DCCFB2");
  const L = len / 2;
  const D = SHIP_H.deck;
  const tilt = roll - aground * 7;
  const lift = -aground * 40;
  const br = clamp1(broken);
  const cut = -L * 0.32;
  const hullFore = `M ${cut} ${-D - 8} L ${L - 40} ${-D - 14} Q ${L + 40} ${-D - 30} ${L + 70} ${-D - 60} Q ${L + 30} ${-D + 10} ${L - 20} -10 Q ${L * 0.4} 30 ${cut} 34 Z`;
  const hullAft = `M ${-L + 30} ${-D - 30} Q ${-L * 0.6} ${-D - 6} ${cut} ${-D - 8} L ${cut} 34 Q ${-L * 0.6} 30 ${-L + 40} 0 Q ${-L - 20} ${-D * 0.5} ${-L + 30} ${-D - 30} Z`;
  const mast = L * 0.08;
  const full = clamp1(sail) * (1 - 0.35 * clamp1(storm));
  const billow = full * (1 + 0.04 * Math.sin(f * 0.06));
  const yardY = -SHIP_H.mast + 40;
  const sw = 260;
  const sailBottom = lerp(yardY + 20, -D - 70, full);
  const tear = storm > 0.6 && sail > 0.3;
  return (
    <g transform={`translate(${x} ${gy + bob}) scale(${flip ? -s : s} ${s})`}>
      {water === null ? <ellipse cx={0} cy={6} rx={L + 60} ry={12} fill="rgba(0,0,0,0.35)" /> : null}
      <g transform={`translate(0 ${lift}) rotate(${tilt})`}>
        <path d={`M ${-L + 40} ${-D - 26} Q 0 ${-D - 2} ${L - 30} ${-D - 18}`} stroke={dark} strokeWidth={8} fill="none" />
        <line x1={mast} y1={-D} x2={mast} y2={-SHIP_H.mast} stroke={tone(wood, -0.15)} strokeWidth={9} strokeLinecap="round" />
        <line x1={mast - sw} y1={yardY + 10} x2={mast + sw} y2={yardY - 6} stroke={tone(wood, -0.05)} strokeWidth={6} strokeLinecap="round" />
        {[-1, 1].map((d) => (
          <line key={d} x1={mast} y1={-SHIP_H.mast + 6} x2={mast + d * sw * 0.95} y2={yardY + 2 - d * 6} stroke={ink("#8A7A5A")} strokeWidth={1.2} />
        ))}
        <line x1={mast} y1={-SHIP_H.mast} x2={L + 60} y2={-D - 54} stroke={ink("#8A7A5A")} strokeWidth={1.4} />
        <line x1={mast} y1={-SHIP_H.mast} x2={-L + 40} y2={-D - 40} stroke={ink("#8A7A5A")} strokeWidth={1.4} />
        {full > 0.04 ? (
          <g>
            <path
              d={`M ${mast - sw + 6} ${yardY + 12} L ${mast + sw - 6} ${yardY - 4} Q ${mast + sw + 60 * billow} ${(yardY + sailBottom) / 2} ${mast + sw - 20 + 26 * billow} ${sailBottom} L ${mast - sw + 30} ${sailBottom + 10} Q ${mast - sw + 50 * billow} ${(yardY + sailBottom) / 2} ${mast - sw + 6} ${yardY + 12} Z`}
              fill={sailC}
              stroke={rim(0.9)}
              strokeWidth={1.6}
            />
            <path d={`M ${mast - sw + 20} ${lerp(yardY + 12, sailBottom, 0.45)} Q ${mast + 30 * billow} ${lerp(yardY, sailBottom, 0.45) + 10} ${mast + sw - 10 + 50 * billow} ${lerp(yardY - 4, sailBottom, 0.45)}`} stroke={ink("#8A3A2A")} strokeWidth={10} fill="none" opacity={0.75} />
            {[0.2, 0.7].map((t) => (
              <path key={t} d={`M ${mast - sw + 12} ${lerp(yardY + 12, sailBottom, t)} Q ${mast + 30 * billow} ${lerp(yardY, sailBottom, t) + 10} ${mast + sw - 10 + 50 * billow * (1 - t * 0.5)} ${lerp(yardY - 4, sailBottom, t)}`} stroke={tone(sailC, -0.16)} strokeWidth={1.4} fill="none" />
            ))}
            {tear ? <path d={`M ${mast + 40} ${yardY + 30} l 10 40 l -14 26 l 12 34`} stroke={tone(sailC, -0.55)} strokeWidth={3} fill="none" /> : null}
          </g>
        ) : (
          <path d={`M ${mast - sw} ${yardY + 12} Q ${mast} ${yardY + 34} ${mast + sw} ${yardY - 4} Q ${mast} ${yardY + 16} ${mast - sw} ${yardY + 12} Z`} fill={sailC} stroke={rim(0.7)} strokeWidth={1.2} />
        )}
        <line x1={L - 30} y1={-D - 20} x2={L + 120} y2={-D - 160} stroke={tone(wood, -0.1)} strokeWidth={6} strokeLinecap="round" />
        {sail > 0.05 ? <path d={`M ${L + 108} ${-D - 152} L ${L + 20} ${-D - 60} L ${L + 120} ${-D - 40} Q ${L + 130} ${-D - 96} ${L + 108} ${-D - 152} Z`} fill={sailC} stroke={rim(0.8)} strokeWidth={1.2} /> : null}
        {deck ? (
          <NoScale>
            <g transform={`translate(0 ${-D})`}>{deck}</g>
          </NoScale>
        ) : null}
        <g transform={br > 0 ? `translate(${-br * 70} ${br * 60}) rotate(${-br * 18} ${cut} 0)` : undefined}>
          <path d={hullAft} fill={wood} stroke={rim(1)} strokeWidth={1.6} />
          <path d={`M ${-L + 30} ${-D - 30} Q ${-L - 50} ${-D - 120} ${-L + 10} ${-D - 230} Q ${-L + 40} ${-D - 250} ${-L + 50} ${-D - 220}`} stroke={wood} strokeWidth={16} fill="none" strokeLinecap="round" />
          <path d={`M ${-L + 30} ${-D - 30} Q ${-L - 50} ${-D - 120} ${-L + 10} ${-D - 230}`} stroke={rim(0.8)} strokeWidth={1.4} fill="none" />
          <rect x={-L + 70} y={-D - 70} width={130} height={56} fill={tone(wood, 0.15)} stroke={rim(0.9)} strokeWidth={1.3} />
          <path d={`M ${-L + 62} ${-D - 70} L ${-L + 208} ${-D - 70} L ${-L + 200} ${-D - 82} L ${-L + 70} ${-D - 82} Z`} fill={tone(wood, -0.1)} />
          {[0, 1].map((i) => (
            <rect key={i} x={-L + 96 + i * 50} y={-D - 56} width={18} height={18} fill={lit > 0 ? `rgba(255,190,100,${0.4 + 0.5 * lit})` : dark} />
          ))}
          <line x1={-L + 60} y1={-D - 20} x2={-L - 30} y2={40} stroke={tone(wood, 0.1)} strokeWidth={7} strokeLinecap="round" />
          <path d={`M ${-L - 30} 40 l -14 -50 l 20 4 Z`} fill={tone(wood, 0.1)} />
          {lit > 0 ? <GlowS x={-L + 20} y={-D - 120} r={120} color="255,180,90" opacity={0.55 * lit} /> : null}
          {br > 0.05 ? <path d={`M ${cut} ${-D - 8} l -14 30 l 12 26 l -16 30 l 14 26 l -10 30`} stroke={ink("#E8DCC0")} strokeWidth={2} fill="none" opacity={0.7} /> : null}
        </g>
        <path d={hullFore} fill={wood} stroke={rim(1)} strokeWidth={1.6} />
        {[22, 46, 70].map((o) => (
          <path key={o} d={`M ${-L + 40 + o * 0.3} ${-D - 26 + o} Q 0 ${-D + o} ${L - 20 - o * 0.3} ${-D - 16 + o}`} stroke={tone(wood, 0.12)} strokeWidth={o === 22 ? 6 : 2} fill="none" />
        ))}
        <path d={`M ${-L + 40} ${-D - 26} Q 0 ${-D - 2} ${L - 30} ${-D - 18}`} stroke={tone(wood, 0.25)} strokeWidth={5} fill="none" />
        {Array.from({ length: 16 }, (_, i) => {
          const xx = -L + 70 + i * ((len - 120) / 15);
          const yy = -D - 22 + Math.pow((xx / L) * 1.0, 2) * 16;
          return <line key={i} x1={xx} y1={yy} x2={xx} y2={yy - 30} stroke={tone(wood, 0.1)} strokeWidth={3} />;
        })}
        <path d={`M ${-L + 70} ${-D - 52} Q 0 ${-D - 30} ${L - 40} ${-D - 46}`} stroke={tone(wood, 0.2)} strokeWidth={3} fill="none" />
        <path d={`M ${L + 70} ${-D - 60} q 16 -10 20 -28`} stroke={wood} strokeWidth={10} strokeLinecap="round" fill="none" />
      </g>
      {water !== null ? <WaterLip x0={-L - 100} x1={L + 120} color={ink(water)} f={f} rough={storm} depth={70} /> : null}
      {storm > 0
        ? Array.from({ length: 14 }, (_, i) => {
            const age = mod(f * 1.2 + i * 7 + random(`${seed}s${i}`) * 30, 44) / 44;
            const sx = range(`${seed}x${i}`, -L, L + 80);
            return <ellipse key={i} cx={sx + age * 40} cy={-10 - age * 90 + age * age * 80} rx={8 + age * 14} ry={4 + age * 8} fill={`rgba(226,236,244,${(0.45 * storm * (1 - age)).toFixed(3)})`} />;
          })
        : null}
    </g>
  );
};

/** A small viper (Acts 28:3), kept restrained: a dark-brown snake about 60 long at (x, y) in band units, head to the
 *  right; `coil` 0..1 bends it tighter, `rot` turns it (fasten it to a hand from rig(), or let it drop into the fire). */
export const Viper: React.FC<{ x: number; y: number; s?: number; rot?: number; coil?: number; flip?: boolean }> = ({ x, y, s = 1, rot = 0, coil = 0.4, flip = false }) => {
  const k = s * useBand().k;
  const ink = useInk();
  const f = useCurrentFrame();
  const pts: Pt[] = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    return [-30 + t * 60, Math.sin(t * Math.PI * (1.4 + coil * 1.6) + f * 0.12) * (5 + coil * 7) * (0.4 + 0.6 * t)];
  });
  const c = ink("#4A3624");
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -k : k} ${k})`}>
      <path d={smooth(pts, false)} stroke={c} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d={smooth(pts, false)} stroke={ink("#8A7050")} strokeWidth={1.2} strokeDasharray="3 4" fill="none" />
      <ellipse cx={pts[11][0] + 3} cy={pts[11][1]} rx={5} ry={3.4} fill={c} />
    </g>
  );
};

// ── Jerusalem ─────────────────────────────────────────────────────────────────────────────

/**
 * A colt, the foal of a donkey, with cloaks thrown over it (Matthew 21:7). The donkey is drawn at `s` (default 1.7, so
 * it suits a man; back at 50 × s units); `cloaks` are the colours laid on its back; `rider` (a Look) sits on it sideways
 * with `pose` (sit: 1 is added), at rider scale `rs` (default 1). `walk` is the walk phase. Base at the band ground.
 */
export const Colt: React.FC<{ x: number; y?: number; s?: number; flip?: boolean; walk?: number; cloaks?: string[]; rider?: Look | null; pose?: Pose; rs?: number; graze?: number }> = ({
  x,
  y,
  s = 1.7,
  flip = false,
  walk,
  cloaks = ["#7A2E28", "#34465E"],
  rider = null,
  pose,
  rs = 1,
  graze = 0,
}) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = y ?? band.gy(x);
  const k = band.k;
  const d = flip ? -1 : 1;
  const bob = walk !== undefined ? -Math.abs(Math.sin(walk)) * 1.4 * s * k : 0;
  const back = gy - 50 * s * k + bob;
  return (
    <g>
      <Animal kind="donkey" x={x} y={gy} s={s} flip={flip} walk={walk} graze={graze} />
      <g transform={`translate(${x} ${gy + bob}) scale(${d * s * k} ${s * k})`}>
        {cloaks.map((c, i) => (
          <path key={i} d={`M ${-20 + i * 4} ${-51 - i * 1.5} Q ${-2 + i * 2} ${-56 - i * 2} ${18 - i * 2} ${-51 - i * 1.5} L ${21 - i * 3} ${-30 + i * 2} Q ${0} ${-26 + i * 2} ${-22 + i * 3} ${-30 + i * 2} Z`} fill={ink(c)} stroke={rim(0.8)} strokeWidth={0.8 / Math.max(0.3, s * k)} />
        ))}
        <path d="M -18 -32 L 20 -32" stroke={ink("#C8A050")} strokeWidth={0.8} opacity={0.7} />
      </g>
      {rider ? <Person x={x - d * 2 * s * k} y={back + 42 * rs * k} s={rs} look={rider} flip={flip} pose={{ sit: 1, ...pose }} shadow={false} /> : null}
    </g>
  );
};

/** Palm branches and cloaks spread on the road (Matthew 21:8), lying on the band's ground between x0 and x1, `n` items,
 *  `cloaks` the share that are cloaks (0.35); `p` 0..1 lays them left to right; `dy` their depth below the ground line. */
export const PalmBranches: React.FC<{ x0: number; x1: number; n?: number; cloaks?: number; p?: number; seed?: string; dy?: [number, number] }> = ({ x0, x1, n = 18, cloaks = 0.35, p = 1, seed = "pb", dy = [4, 40] }) => {
  const band = useBand();
  const ink = useInk();
  const k = band.k;
  const robes = ["#7A2E28", "#34465E", "#8C7656", "#4E5634", "#5A2234", "#2E5050"];
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        if (i / n >= p) return null;
        const xx = lerp(x0, x1, (i + random(`${seed}x${i}`) * 0.8) / n);
        const yy = band.gy(xx) + range(`${seed}y${i}`, dy[0], dy[1]) * k;
        const a = range(`${seed}a${i}`, -18, 18);
        if (random(`${seed}c${i}`) < cloaks) {
          const c = ink(robes[i % robes.length]);
          return (
            <g key={i} transform={`translate(${xx.toFixed(1)} ${yy.toFixed(1)}) rotate(${(a * 0.4).toFixed(1)}) scale(${k} ${k * 0.42})`}>
              <path d="M -40 -14 L 36 -18 L 44 14 L -36 16 Z" fill={c} stroke="rgba(255,226,180,0.3)" strokeWidth={1} />
              <path d="M -20 -15 L -16 15 M 10 -16 L 14 15" stroke={tone(c, -0.25)} strokeWidth={2} />
            </g>
          );
        }
        const leafC = ink(i % 3 ? "#4E6A2E" : "#5E7A36");
        return (
          <g key={i} transform={`translate(${xx.toFixed(1)} ${yy.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${k} ${k * 0.4})`}>
            <line x1={-44} y1={0} x2={44} y2={0} stroke={ink("#6A7A3A")} strokeWidth={2} />
            {Array.from({ length: 12 }, (_, j) => {
              const lx = -36 + j * 7;
              const l = 16 - Math.abs(j - 5) * 1.2;
              return <path key={j} d={`M ${lx} 0 L ${lx + 6} ${-l} M ${lx} 0 L ${lx + 6} ${l}`} stroke={leafC} strokeWidth={2.2} strokeLinecap="round" />;
            })}
          </g>
        );
      })}
    </g>
  );
};

/** A money changer's table in the temple court (Mark 11:15): coin stacks, a balance, a strongbox and a wicker cage of
 *  doves (`cage`). Person scale: top at -62, `w` 170. `tip` 0..1 overturns it about its far foot, coins fly and scatter,
 *  the cage falls open and the doves fly up and away. */
export const MoneyTable: React.FC<Base & { tip?: number; cage?: boolean; seed?: string; w?: number }> = ({ x, y, s = 1, flip = false, tip = 0, cage = true, seed = "mt", w = 170 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const wood = ink("#5E4630");
  const gold = ink("#D8B050");
  const silver = ink("#C8CCD4");
  const t = clamp1(tip);
  const fall = t * t * (3 - 2 * t);
  const W2 = w / 2;
  const coins = Array.from({ length: 16 }, (_, i) => {
    const sx = range(`${seed}cx${i}`, -W2 + 12, W2 - 40);
    const ex = sx + range(`${seed}ex${i}`, 30, 170);
    const ey = range(`${seed}ey${i}`, -4, 10);
    const h = range(`${seed}h${i}`, 40, 110);
    const cx = lerp(sx, ex, fall);
    const cy = lerp(-66, ey, fall) - Math.sin(Math.PI * fall) * h;
    return { cx, cy, c: i % 3 ? gold : silver };
  });
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={fall * 30} cy={0} rx={W2 + 20 + fall * 30} ry={6} fill="rgba(0,0,0,0.35)" />
      <g transform={`rotate(${fall * 96} ${W2 + 4} 0)`}>
        {[-W2 + 14, W2 - 22].map((lx) => (
          <path key={lx} d={`M ${lx} -58 L ${lx - 8} 0 M ${lx + 8} -58 L ${lx + 16} 0`} stroke={tone(wood, -0.2)} strokeWidth={5} />
        ))}
        <rect x={-W2} y={-66} width={w} height={9} rx={2} fill={wood} stroke={rim(0.8)} strokeWidth={1.1} />
        {t < 0.2 ? (
          <g>
            <rect x={W2 - 52} y={-86} width={36} height={20} rx={2} fill={ink("#6A3A24")} stroke={rim(0.7)} strokeWidth={1} />
            <rect x={W2 - 52} y={-80} width={36} height={3} fill={gold} />
            <line x1={-6} y1={-66} x2={-6} y2={-104} stroke={ink("#8A7A5A")} strokeWidth={1.6} />
            <line x1={-26} y1={-104} x2={14} y2={-104} stroke={ink("#8A7A5A")} strokeWidth={1.6} />
            {[-26, 14].map((px) => (
              <path key={px} d={`M ${px - 8} -84 L ${px + 8} -84 L ${px} -104 Z M ${px - 9} -84 Q ${px} -79 ${px + 9} -84`} stroke={ink("#9A8A6A")} strokeWidth={0.9} fill={tone(gold, -0.2)} opacity={0.9} />
            ))}
          </g>
        ) : null}
      </g>
      {coins.map((c, i) => (
        <g key={i}>{t < 0.02 && i > 6 ? null : <ellipse cx={c.cx} cy={c.cy} rx={4.2} ry={t > 0.02 ? 4 : 1.8} fill={c.c} stroke="rgba(255,250,230,0.6)" strokeWidth={0.6} />}</g>
      ))}
      {t < 0.02 ? [-W2 + 16, -W2 + 30, -W2 + 44].map((cx, i) => <rect key={i} x={cx - 5} y={-66 - (6 + i * 3)} width={10} height={6 + i * 3} rx={2} fill={i % 2 ? silver : gold} />) : null}
      {cage ? (
        <g transform={`translate(${lerp(-W2 - 40, -W2 - 10, fall)} 0) rotate(${fall * -70} 0 0)`}>
          <path d="M -24 0 L -24 -36 Q 0 -66 24 -36 L 24 0 Z" fill="rgba(60,40,24,0.45)" stroke={ink("#8A6A3A")} strokeWidth={1.6} />
          {[-16, -8, 0, 8, 16].map((bx) => (
            <line key={bx} x1={bx} y1={0} x2={bx * 0.9} y2={-44 + Math.abs(bx) * 0.6} stroke={ink("#8A6A3A")} strokeWidth={1.2} />
          ))}
          {t < 0.4 ? [-8, 8].map((dx) => <ellipse key={dx} cx={dx} cy={-14} rx={7} ry={5} fill={ink("#E6E0D4")} />) : null}
        </g>
      ) : null}
      {cage && t >= 0.4
        ? [0, 1, 2].map((i) => {
            const u = clamp1((t - 0.4) / 0.6);
            return <Bird key={i} x={-W2 - 20 + u * (140 + i * 60)} y={-30 - u * (220 + i * 70)} s={1.1} color={ink("#ECE6DA")} flap={f * 0.5 + i * 2} />;
          })
        : null}
    </g>
  );
};

// ── Buildings at Person scale ─────────────────────────────────────────────────────────────

/** The cave stable at Bethlehem: a rock outcrop (default w 760, h 380) with a broad low cave mouth (440 × 270) warm with
 *  lamplight, a rough timber lintel and posts, straw on the floor. `inside` is clipped to the mouth and anchored on its
 *  floor at the centre (Manger at x = 0, people at s ≈ 0.9–1); figures standing in front go in the set's near band.
 *  `lamp` 0..1. Person scale. */
export const Stable: React.FC<Base & { w?: number; h?: number; lamp?: number; inside?: React.ReactNode; seed?: string; color?: string }> = ({ x, y, s = 1, flip = false, w = 760, h = 380, lamp = 1, inside, seed = "sb", color = "#7E705C" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const clip = useUid("sbc");
  const grad = useUid("sbg");
  const rg = useUid("sbr");
  const c = ink(color);
  const flick = 0.88 + 0.12 * Math.sin(f * 0.33) * Math.sin(f * 0.11 + 1);
  const mw = 440;
  const mh = 270;
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = Math.PI * t;
    pts.push([-(w / 2) * Math.cos(a) + range(`${seed}x${i}`, -16, 16), -h * Math.pow(Math.sin(a), 0.6) + range(`${seed}y${i}`, -18, 18)]);
  }
  const rock = `M ${-w / 2 - 30} 0 ${pts.map((q) => `L ${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ")} L ${w / 2 + 30} 0 Z`;
  const mouth = `M ${-mw / 2} 0 L ${-mw / 2 + 10} ${-mh * 0.7} Q ${-mw * 0.3} ${-mh} 0 ${-mh} Q ${mw * 0.3} ${-mh} ${mw / 2 - 10} ${-mh * 0.7} L ${mw / 2} 0 Z`;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={2} rx={w * 0.6} ry={10} fill="rgba(0,0,0,0.35)" />
      <defs>
        <linearGradient id={rg} gradientUnits="userSpaceOnUse" x1={0} y1={-h} x2={0} y2={0}>
          <stop offset="0" stopColor={tone(c, 0.1)} />
          <stop offset="1" stopColor={tone(c, -0.32)} />
        </linearGradient>
      </defs>
      <path d={rock} fill={`url(#${rg})`} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M ${range(`${seed}a${i}`, -w * 0.45, w * 0.2)} ${-range(`${seed}b${i}`, mh + 20, h * 0.92)} q ${range(`${seed}c${i}`, 40, 90)} ${range(`${seed}d${i}`, 8, 22)} ${range(`${seed}e${i}`, 90, 180)} 0`} stroke={tone(c, -0.22)} strokeWidth={2} fill="none" />
      ))}
      {[-1, 1].map((d) =>
        [0, 1].map((j) => {
          const bx = d * (w * 0.36 + j * 70);
          const bw = 70 - j * 18;
          const bh = 46 - j * 12;
          return <path key={`${d}${j}`} d={`M ${bx - bw / 2} 2 Q ${bx - bw / 2} ${-bh} ${bx} ${-bh} Q ${bx + bw / 2} ${-bh} ${bx + bw / 2} 2 Z`} fill={tone(c, -0.18 - j * 0.06)} stroke={rim(0.7)} strokeWidth={1.1} />;
        }),
      )}
      <defs>
        <clipPath id={clip}>
          <path d={mouth} />
        </clipPath>
        <radialGradient id={grad} cx="0.5" cy="0.62" r="0.65">
          <stop offset="0" stopColor={mixHex("#2A1A10", "#E8A860", 0.75 * lamp * flick)} />
          <stop offset="0.6" stopColor={mixHex("#1A100A", "#9A5A2A", 0.6 * lamp)} />
          <stop offset="1" stopColor="#0E0806" />
        </radialGradient>
      </defs>
      <path d={mouth} fill={`url(#${grad})`} />
      <g clipPath={`url(#${clip})`}>
        <path d={`M ${-mw / 2} -12 Q 0 -26 ${mw / 2} -12 L ${mw / 2} 4 L ${-mw / 2} 4 Z`} fill={ink("#8A7040")} opacity={0.75} />
        {Array.from({ length: 30 }, (_, i) => {
          const sx = range(`${seed}sx${i}`, -mw / 2, mw / 2);
          return <line key={i} x1={sx} y1={-4} x2={sx + range(`${seed}sl${i}`, -10, 10)} y2={-4 - range(`${seed}sh${i}`, 4, 12)} stroke={ink("#C8A65A")} strokeWidth={1.2} opacity={0.8} />;
        })}
        {lamp > 0 ? (
          <g>
            <line x1={mw * 0.28} y1={-mh} x2={mw * 0.28} y2={-mh + 70} stroke={ink("#4A3A2A")} strokeWidth={1.4} />
            <path d={`M ${mw * 0.28 - 9} ${-mh + 70} Q ${mw * 0.28} ${-mh + 80} ${mw * 0.28 + 9} ${-mh + 70} Z`} fill={ink("#7A5434")} />
            <ellipse cx={mw * 0.28 + 4} cy={-mh + 63} rx={2.6} ry={6 * flick} fill="#FFB050" opacity={lamp} />
            <GlowS x={mw * 0.28} y={-mh + 64} r={140} color="255,170,80" opacity={0.5 * lamp * flick} />
          </g>
        ) : null}
        <NoScale>
          <g>{inside}</g>
        </NoScale>
      </g>
      <path d={mouth} fill="none" stroke={tone(c, -0.35)} strokeWidth={6} />
      {[-1, 1].map((d) => (
        <rect key={d} x={d * (mw / 2 + 4) - 7} y={-mh * 0.82} width={14} height={mh * 0.82} fill={ink("#4E3A26")} stroke={rim(0.8)} strokeWidth={1} />
      ))}
      <path d={`M ${-mw / 2 - 40} ${-mh * 0.82} L ${mw / 2 + 40} ${-mh * 0.86} L ${mw / 2 + 36} ${-mh * 0.82 + 12} L ${-mw / 2 - 36} ${-mh * 0.78 + 10} Z`} fill={ink("#5A4430")} stroke={rim(0.9)} strokeWidth={1.2} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`th${i}`} x1={-mw / 2 - 30 + i * ((mw + 60) / 11)} y1={-mh * 0.84} x2={-mw / 2 - 34 + i * ((mw + 60) / 11)} y2={-mh * 0.84 - 16} stroke={ink("#8A7040")} strokeWidth={2} />
      ))}
    </g>
  );
};

/**
 * A Roman street front (Paul's rented house, a house in Philippi or Corinth): two storeys of plastered brick, ochre below
 * and cream above, a tall arched doorway (110 × 230), a shop opening with a counter, shuttered windows, a timber balcony
 * and a red-tiled eave. Person scale: default w = 520, h = 380 (eave at -h). `door` 0..1 opens the door onto a lamplit
 * room (`lit`); `inDoor` is clipped to the doorway and anchored on its threshold (a Person at y = 0 stands in it).
 */
export const RomanHouse: React.FC<Base & { w?: number; h?: number; lit?: number; door?: number; inDoor?: React.ReactNode; color?: string }> = ({ x, y, s = 1, flip = false, w = 520, h = 380, lit = 0, door = 0, inDoor, color = "#B07A4A" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const clip = useUid("rhc");
  const lower = ink(color);
  const upper = ink("#D8C8A8");
  const roof = ink("#8A3A24");
  const W2 = w / 2;
  const dx = -W2 * 0.35;
  const doorPath = `M ${dx - 55} 0 L ${dx - 55} -175 A 55 55 0 0 1 ${dx + 55} -175 L ${dx + 55} 0 Z`;
  const room = lit > 0 ? mixHex("#140C08", "#C88A48", lit * 0.7) : "#120C08";
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={2} rx={W2 + 30} ry={9} fill="rgba(0,0,0,0.35)" />
      <rect x={-W2} y={-h * 0.56} width={w} height={h * 0.56} fill={lower} stroke={rim(0.9)} strokeWidth={1.4} />
      <rect x={-W2} y={-h} width={w} height={h * 0.44} fill={upper} stroke={rim(0.9)} strokeWidth={1.4} />
      <rect x={-W2} y={-h * 0.56 - 6} width={w} height={8} fill={tone(lower, -0.2)} />
      <defs>
        <clipPath id={clip}>
          <path d={doorPath} />
        </clipPath>
      </defs>
      <path d={doorPath} fill={room} />
      <g clipPath={`url(#${clip})`}>
        {lit > 0 ? <GlowS x={dx} y={-120} r={120} color="255,180,100" opacity={0.6 * lit} /> : null}
        <NoScale>
          <g transform={`translate(${dx} 0)`}>{inDoor}</g>
        </NoScale>
        <g transform={`translate(${dx - 55} 0) scale(${lerp(1, 0.12, clamp1(door))} 1) translate(${-(dx - 55)} 0)`}>
          <path d={doorPath} fill={ink("#5A3A22")} stroke={rim(0.6)} strokeWidth={1} />
          {[-0.5, 0, 0.5].map((u) => (
            <line key={u} x1={dx + u * 55} y1={-210} x2={dx + u * 55} y2={-2} stroke="rgba(10,6,4,0.4)" strokeWidth={2} />
          ))}
          <circle cx={dx + 36} cy={-100} r={3.4} fill={ink("#C8A050")} />
        </g>
      </g>
      <path d={doorPath} fill="none" stroke={tone(lower, -0.35)} strokeWidth={8} />
      <rect x={W2 * 0.1} y={-150} width={W2 * 0.75} height={150} fill={room} />
      <rect x={W2 * 0.06} y={-58} width={W2 * 0.83} height={58} fill={tone(lower, 0.1)} stroke={rim(0.8)} strokeWidth={1.1} />
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={W2 * 0.2 + i * W2 * 0.25} cy={-64} rx={13} ry={6} fill={ink("#8A5A36")} />
      ))}
      {[-0.62, -0.1, 0.42].map((u) => (
        <g key={u}>
          <rect x={u * W2 - 26} y={-h * 0.92} width={52} height={70} fill={lit > 0 ? `rgba(255,190,110,${0.35 + 0.5 * lit})` : "#1A120C"} />
          <rect x={u * W2 - 26} y={-h * 0.92} width={52} height={70} fill="none" stroke={tone(upper, -0.35)} strokeWidth={4} />
          <rect x={u * W2 - 42} y={-h * 0.92} width={14} height={70} fill={ink("#5A6A4A")} />
        </g>
      ))}
      <rect x={-W2 - 6} y={-h * 0.6} width={w * 0.5} height={8} fill={ink("#5A3A22")} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={-W2 + i * (w * 0.5 / 8)} y1={-h * 0.6} x2={-W2 + i * (w * 0.5 / 8)} y2={-h * 0.6 - 34} stroke={ink("#5A3A22")} strokeWidth={2.4} />
      ))}
      <line x1={-W2 - 6} y1={-h * 0.6 - 34} x2={-6} y2={-h * 0.6 - 34} stroke={ink("#5A3A22")} strokeWidth={3} />
      <path d={`M ${-W2 - 30} ${-h} L ${W2 + 30} ${-h} L ${W2 + 10} ${-h - 34} L ${-W2 - 10} ${-h - 34} Z`} fill={roof} stroke={rim(0.9)} strokeWidth={1.2} />
      {Array.from({ length: Math.floor(w / 22) }, (_, i) => (
        <path key={i} d={`M ${-W2 - 22 + i * 22} ${-h} q 11 -6 22 0`} stroke={tone(roof, 0.2)} strokeWidth={2} fill="none" />
      ))}
    </g>
  );
};

/**
 * A travelling chariot at Person scale (the Ethiopian official reading Isaiah, Acts 8:28): two tall wheels (r 50) under
 * a carriage box (floor at -64, 170 long), a cushioned bench at the back with an optional fringed `canopy`, a pole to the
 * horse (Animal s = 1.8 × s) in front. `rider` sits on the bench (a Person at x = 0, y = 0 with pose sit: 1); `driver`
 * stands at the front of the floor (anchor (58, -64)). Faces right (flip for left); `walk` turns the wheels and the horse.
 */
export const Carriage: React.FC<Base & { walk?: number; rider?: React.ReactNode; driver?: React.ReactNode; canopy?: boolean; horse?: boolean; color?: string; tint?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  walk,
  rider,
  driver,
  canopy = true,
  horse = true,
  color = "#6A4A2E",
  tint = "#E8E0D0",
}) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const gy = y ?? band.gy(x);
  const k = s * band.k;
  const d = flip ? -1 : 1;
  const body = ink(color);
  const gold = ink("#C8A050");
  const turn = walk !== undefined ? f * 0.07 : 0;
  return (
    <>
      {horse ? <Animal kind="horse" x={x + d * 200 * k} y={gy} s={1.8 * s} flip={flip} walk={walk} tint={tint} /> : null}
      <g transform={`translate(${x} ${gy}) scale(${d * k} ${k})`}>
        <ellipse cx={0} cy={0} rx={110} ry={6} fill="rgba(0,0,0,0.3)" />
        {horse ? <path d="M 80 -70 Q 120 -84 170 -112" stroke={ink("#4A3020")} strokeWidth={5} fill="none" strokeLinecap="round" /> : null}
        {canopy ? (
          <g>
            {[-70, -10].map((px) => (
              <line key={px} x1={px} y1={-80} x2={px} y2={-290} stroke={gold} strokeWidth={3} />
            ))}
            <path d="M -86 -296 L 6 -296 L 6 -272 Q -40 -262 -86 -272 Z" fill={ink("#7A2A3A")} stroke={rim(0.8)} strokeWidth={1.1} />
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1={-82 + i * 12} y1={-272 + Math.sin((i / 7) * Math.PI) * 6} x2={-82 + i * 12} y2={-262 + Math.sin((i / 7) * Math.PI) * 6} stroke={gold} strokeWidth={2} />
            ))}
          </g>
        ) : null}
        <rect x={-74} y={-110} width={58} height={10} rx={4} fill={ink("#8A3A4A")} />
        <path d="M -78 -100 L -78 -150 Q -74 -158 -66 -150 L -66 -100 Z" fill={body} stroke={rim(0.8)} strokeWidth={1} />
        {rider ? (
          <NoScale>
            <g transform="translate(-44 -100)">{rider}</g>
          </NoScale>
        ) : null}
        {driver ? (
          <NoScale>
            <g transform="translate(58 -64)">{driver}</g>
          </NoScale>
        ) : null}
        <path d="M -90 -64 L 80 -64 Q 92 -84 78 -110 L 60 -110 Q 70 -86 64 -76 L -80 -76 L -90 -100 Z" fill={body} stroke={rim(1)} strokeWidth={1.4} />
        <path d="M -84 -70 L 74 -70" stroke={gold} strokeWidth={2} />
        <circle cx={-10} cy={-50} r={50} fill="none" stroke={ink("#3A2618")} strokeWidth={6} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + turn;
          return <line key={i} x1={-10} y1={-50} x2={-10 + Math.cos(a) * 48} y2={-50 + Math.sin(a) * 48} stroke={ink("#3A2618")} strokeWidth={2.4} />;
        })}
        <circle cx={-10} cy={-50} r={7} fill={gold} />
      </g>
    </>
  );
};

/** A Roman judgment seat (the bema; John 19:13 "the Stone Pavement"): a stone platform (`w` 380, top at -h, h 74) with
 *  steps at the left, a red cloth hung on its face, a folding curule chair at x = +70 on top. `seat` is anchored on the
 *  chair (a Person at x = 0, y = 0 with pose sit: 1); `standing` on the platform top at its centre (a Person at y = 0). */
export const JudgmentSeat: React.FC<Base & { w?: number; h?: number; seat?: React.ReactNode; standing?: React.ReactNode; chair?: boolean; color?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  w = 380,
  h = 74,
  seat,
  standing,
  chair = true,
  color = "#C8BCA4",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const st = ink(color);
  const W2 = w / 2;
  const ivory = ink("#E8DCC0");
  const gold = ink("#C8A050");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={2} rx={W2 + 50} ry={9} fill="rgba(0,0,0,0.35)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={-W2 - 60 + i * 20} y={-((i + 1) * h) / 3} width={60} height={(h * (i + 1)) / 3} fill={tone(st, -0.06 * i)} stroke={rim(0.7)} strokeWidth={1} />
      ))}
      <rect x={-W2} y={-h} width={w} height={h} fill={st} stroke={rim(0.9)} strokeWidth={1.4} />
      {[-0.33, 0.33].map((u) => (
        <line key={u} x1={u * w} y1={-h} x2={u * w} y2={0} stroke={tone(st, -0.2)} strokeWidth={1.2} />
      ))}
      <rect x={-W2 - 6} y={-h - 8} width={w + 12} height={10} fill={tone(st, 0.08)} stroke={rim(0.8)} strokeWidth={1.1} />
      <path d={`M ${-W2 * 0.3} ${-h + 2} L ${W2 * 0.3} ${-h + 2} L ${W2 * 0.26} ${-h * 0.25} L ${-W2 * 0.26} ${-h * 0.25} Z`} fill={ink("#8A2A22")} />
      <path d={`M ${-W2 * 0.26} ${-h * 0.25} L ${W2 * 0.26} ${-h * 0.25}`} stroke={gold} strokeWidth={2} />
      {standing ? (
        <NoScale>
          <g transform={`translate(0 ${-h - 4})`}>{standing}</g>
        </NoScale>
      ) : null}
      {chair ? (
        <g transform={`translate(70 ${-h - 4})`}>
          <path d="M -22 0 L 22 -42 M 22 0 L -22 -42" stroke={ivory} strokeWidth={5} strokeLinecap="round" />
          <rect x={-26} y={-48} width={52} height={8} rx={3} fill={ink("#7A2A3A")} />
          <circle cx={0} cy={-21} r={3} fill={gold} />
        </g>
      ) : null}
      {seat ? (
        <NoScale>
          <g transform={`translate(70 ${-h - 4})`}>{seat}</g>
        </NoScale>
      ) : null}
    </g>
  );
};

/** A low supper table laid with a cloth, round loaves, a cup, dishes and small oil lamps (the Last Supper, Emmaus, a
 *  feast in Cornelius's house). Person scale: top at -h (default 58: people seated behind it on low stools show from the
 *  waist up; use h ≈ 34 with reclining guests), `len` 520. `bread` loaves (one broken when `broken`), `cup`, `lamps`
 *  count, `lit` 0..1. The cloth hangs to the floor (`long`), hiding the legs of guests seated behind; long={false}
 *  shows a short cloth and the table legs. */
export const SupperTable: React.FC<Base & { len?: number; h?: number; bread?: number; broken?: boolean; cup?: boolean; lamps?: number; dishes?: boolean; cloth?: string; lit?: number; seed?: string; long?: boolean }> = ({
  x,
  y,
  s = 1,
  len = 520,
  h = 58,
  bread = 3,
  broken = false,
  cup = true,
  lamps = 2,
  dishes = true,
  cloth = "#E2D8C4",
  lit = 1,
  seed = "st",
  long = true,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const L = len / 2;
  const wood = ink("#4E3624");
  const cl = ink(cloth);
  const flick = 0.86 + 0.14 * Math.sin(f * 0.37 + random(seed) * 6);
  const items: React.ReactNode[] = [];
  for (let i = 0; i < bread; i++) {
    const bx = -L * 0.7 + (i / Math.max(1, bread - 1)) * L * 1.1;
    if (broken && i === Math.floor(bread / 2))
      items.push(
        <g key={`b${i}`}>
          <path d={`M ${bx - 14} ${-h - 2} Q ${bx - 12} ${-h - 12} ${bx - 2} ${-h - 11} L ${bx - 3} ${-h - 2} Z`} fill={ink("#C8955A")} stroke={rim(0.5)} strokeWidth={0.6} />
          <path d={`M ${bx + 3} ${-h - 2} L ${bx + 4} ${-h - 11} Q ${bx + 14} ${-h - 12} ${bx + 16} ${-h - 2} Z`} fill={ink("#C8955A")} stroke={rim(0.5)} strokeWidth={0.6} />
        </g>,
      );
    else items.push(<ellipse key={`b${i}`} cx={bx} cy={-h - 6} rx={14} ry={7} fill={ink("#C8955A")} stroke={rim(0.5)} strokeWidth={0.6} />);
  }
  if (dishes)
    [-0.42, 0.12, 0.62].forEach((u, i) =>
      items.push(
        <g key={`d${i}`}>
          <path d={`M ${u * L - 16} ${-h - 2} Q ${u * L} ${-h + 8} ${u * L + 16} ${-h - 2} Z`} fill={ink("#8A5A3A")} />
          <circle cx={u * L - 4} cy={-h - 4} r={3.4} fill={ink("#5A6A3A")} />
          <circle cx={u * L + 5} cy={-h - 5} r={3} fill={ink("#7A3A4A")} />
        </g>,
      ),
    );
  if (cup)
    items.push(
      <path key="cup" d={`M ${-9} ${-h - 26} L ${9} ${-h - 26} Q ${8} ${-h - 14} ${2} ${-h - 12} L ${2} ${-h - 5} L ${7} ${-h - 2} L ${-7} ${-h - 2} L ${-2} ${-h - 5} L ${-2} ${-h - 12} Q ${-8} ${-h - 14} ${-9} ${-h - 26} Z`} fill={ink("#C8A860")} stroke="rgba(255,240,200,0.8)" strokeWidth={0.8} />,
    );
  for (let i = 0; i < lamps; i++) {
    const lx = lamps === 1 ? L * 0.35 : -L * 0.86 + (i / Math.max(1, lamps - 1)) * L * 1.72;
    items.push(
      <g key={`l${i}`}>
        <path d={`M ${lx - 9} ${-h - 1} Q ${lx - 10} ${-h - 9} ${lx} ${-h - 9} Q ${lx + 9} ${-h - 9} ${lx + 12} ${-h - 5} L ${lx + 17} ${-h - 8} L ${lx + 15} ${-h - 1} Z`} fill={ink("#9A6A40")} />
        {lit > 0 ? (
          <>
            <GlowS x={lx + 16} y={-h - 14} r={70} color="255,180,90" opacity={0.55 * lit * flick} />
            <ellipse cx={lx + 16} cy={-h - 14} rx={2.6} ry={6 * flick} fill="#FFB050" opacity={lit} />
            <ellipse cx={lx + 16} cy={-h - 12.5} rx={1.3} ry={3} fill="#FFF0C0" opacity={lit} />
          </>
        ) : null}
      </g>,
    );
  }
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={L + 26} ry={7} fill="rgba(0,0,0,0.35)" />
      {[-L + 20, L - 28].map((lx) => (
        <rect key={lx} x={lx} y={-h + 6} width={8} height={h - 6} fill={tone(wood, -0.25)} />
      ))}
      <rect x={-L} y={-h} width={len} height={8} rx={2} fill={wood} stroke={rim(0.8)} strokeWidth={1.1} />
      {long ? (
        <g>
          <path d={`M ${-L - 4} ${-h} L ${L + 4} ${-h} L ${L + 12} -3 Q ${L / 2} 3 0 -3 Q ${-L / 2} 3 ${-L - 12} -3 Z`} fill={tone(cl, -0.06)} stroke={rim(0.5)} strokeWidth={0.8} />
          {Array.from({ length: Math.max(2, Math.floor(len / 70)) }, (_, i) => {
            const fx = -L + 30 + i * 70;
            return <path key={i} d={`M ${fx} ${-h + 14} Q ${fx + 4} ${-h * 0.5} ${fx + (fx / L) * 8} -4`} stroke={tone(cl, -0.2)} strokeWidth={1} fill="none" />;
          })}
          <path d={`M ${-L - 4} ${-h + 12} Q 0 ${-h + 18} ${L + 4} ${-h + 12}`} stroke={tone(cl, -0.16)} strokeWidth={1} fill="none" />
        </g>
      ) : (
        <path d={`M ${-L - 4} ${-h} L ${L + 4} ${-h} L ${L + 4} ${-h + 16} Q ${L / 2} ${-h + 22} 0 ${-h + 16} Q ${-L / 2} ${-h + 22} ${-L - 4} ${-h + 16} Z`} fill={cl} stroke={rim(0.5)} strokeWidth={0.8} />
      )}
      {items}
    </g>
  );
};

// ── Monumental (a man ≈ 40 units) ─────────────────────────────────────────────────────────

/** Heights of a HerodTemple at s = 1: steps, top of the great porch opening, inner doorway, wings, central tower. */
export const HEROD_H = { steps: 44, porch: 340, door: 220, wings: 420, top: 480 };

/**
 * Herod's temple seen from the court (Luke 1, Mark 11, Acts 3): a white-marble sanctuary on a flight of steps, the
 * central block rising above its wings (the "shoulders"), gold cornices with gold spikes along the roof, four engaged
 * columns flanking the tall open porch; inside the porch a gold wall with the golden vine over the inner door and the
 * great curtain in blue, scarlet and purple. Monumental scale (a man ≈ 40 units); default w = 480. Heights in HEROD_H.
 *  glow 0..1 warms the porch and windows; torn 0..1 tears the curtain in two from top to bottom (Mark 15:38).
 */
export const HerodTemple: React.FC<Base & { w?: number; glow?: number; torn?: number; seed?: string }> = ({ x, y, s = 1, w = 480, glow = 0, torn = 0, seed = "ht" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const marble = ink("#E6DDCB");
  const shade = tone(marble, -0.14);
  const gold = ink(glow > 0 ? mixHex("#D6AE52", "#FFE6A0", glow * 0.3) : "#D6AE52");
  const H = HEROD_H;
  const W2 = w / 2;
  const tw = w * 0.3;
  const ow = w * 0.13;
  const iw = w * 0.065;
  const porch = glow > 0 ? mixHex("#5A4420", "#E8B860", glow * 0.6) : ink("#6A5226");
  const tr = clamp1(torn);
  const curtainTop = -H.door;
  const ch = H.door - H.steps;
  const spikes = (x0: number, x1: number, yy: number, key: string) =>
    Array.from({ length: Math.floor((x1 - x0) / 9) }, (_, i) => <line key={`${key}${i}`} x1={x0 + 4 + i * 9} y1={yy} x2={x0 + 4 + i * 9} y2={yy - 9} stroke={gold} strokeWidth={1.4} />);
  const stripes = ["#2A3A7A", "#8A1E2A", "#5A2A6A", "#2A3A7A", "#8A1E2A", "#5A2A6A"];
  const half = (side: -1 | 1) => {
    const gap = (u: number) => (u < tr ? (1 - u / Math.max(0.001, tr)) * iw * 0.9 * tr : 0);
    const pts: Pt[] = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push([side * (gap(u) + (u < tr ? Math.sin(u * 30) * 2 * tr : 0)), curtainTop + u * ch]);
    }
    const outer: Pt[] = [[side * iw, curtainTop + ch], [side * iw, curtainTop]];
    return [...pts, ...outer];
  };
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={-W2 * 1.18 + i * 6} y={-((i + 1) * H.steps) / 6} width={w * 1.18 - i * 12} height={H.steps / 6} fill={tone(marble, -0.06 - (i % 2) * 0.05)} stroke={rim(0.5)} strokeWidth={0.8} />
      ))}
      <rect x={-W2} y={-H.wings} width={w} height={H.wings - H.steps} fill={marble} stroke={rim(0.9)} strokeWidth={1.4} />
      <rect x={-tw} y={-H.top} width={tw * 2} height={H.top - H.wings + 2} fill={marble} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={-W2} y1={-H.steps - (i + 1) * 40} x2={W2} y2={-H.steps - (i + 1) * 40} stroke={tone(marble, -0.08)} strokeWidth={1} />
      ))}
      <rect x={-W2 - 6} y={-H.wings - 10} width={w + 12} height={12} fill={gold} />
      <rect x={-tw - 6} y={-H.top - 10} width={tw * 2 + 12} height={12} fill={gold} />
      {spikes(-W2 - 4, -tw, -H.wings - 10, "sl")}
      {spikes(tw, W2 + 4, -H.wings - 10, "sr")}
      {spikes(-tw - 4, tw + 4, -H.top - 10, "st")}
      <rect x={-W2} y={-H.porch - 16} width={w} height={8} fill={gold} opacity={0.9} />
      {[-0.62, 0.62].map((u) =>
        [0, 1].map((r) => <rect key={`${u}${r}`} x={u * W2 - 12} y={-H.wings + 40 + r * 120} width={24} height={50} fill={glow > 0 ? mixHex("#2A2018", "#E8B060", glow * 0.7) : "#2A2018"} />),
      )}
      {[-1, 1].map((d) => (
        <rect key={`tw${d}`} x={d * tw * 0.6 - 10} y={-H.top + 26} width={20} height={34} fill={glow > 0 ? mixHex("#2A2018", "#E8B060", glow * 0.7) : "#2A2018"} />
      ))}
      <rect x={-ow} y={-H.porch} width={ow * 2} height={H.porch - H.steps} fill={porch} />
      <rect x={-ow} y={-H.porch} width={ow * 2} height={H.porch - H.steps} fill="rgba(0,0,0,0.25)" />
      <path d={`M ${-iw - 8} ${-H.steps} L ${-iw - 8} ${-H.door - 8} L ${iw + 8} ${-H.door - 8} L ${iw + 8} ${-H.steps} Z`} fill={gold} opacity={0.7} />
      {tr > 0 ? <rect x={-iw} y={curtainTop} width={iw * 2} height={ch} fill={glow > 0 ? "#3A2A14" : "#0C0806"} /> : null}
      {([-1, 1] as const).map((side) => (
        <g key={side}>
          <path d={poly(half(side))} fill={ink(stripes[side < 0 ? 0 : 1])} />
          {[0.33, 0.66].map((u) => (
            <line key={u} x1={side * iw * u} y1={curtainTop} x2={side * iw * u} y2={curtainTop + ch} stroke={ink(stripes[side < 0 ? 2 : 3])} strokeWidth={iw * 0.22} opacity={tr > 0.02 ? 0.7 : 0.85} />
          ))}
        </g>
      ))}
      <path d={`M ${-ow + 6} ${-H.door - 30} Q ${-ow * 0.5} ${-H.door - 44} 0 ${-H.door - 34} Q ${ow * 0.5} ${-H.door - 24} ${ow - 6} ${-H.door - 36}`} stroke={gold} strokeWidth={3} fill="none" />
      {Array.from({ length: 9 }, (_, i) => {
        const vx = -ow + 12 + i * ((ow * 2 - 24) / 8);
        return <circle key={i} cx={vx} cy={-H.door - 28 + (i % 2) * 6} r={4.5} fill={gold} />;
      })}
      {[-1, 1].map((d) =>
        [0.17, 0.25].map((u) => (
          <g key={`${d}${u}`}>
            <rect x={d * u * w - 9} y={-H.porch} width={18} height={H.porch - H.steps} fill={shade} stroke={rim(0.7)} strokeWidth={1} />
            <rect x={d * u * w - 13} y={-H.porch - 8} width={26} height={9} fill={gold} />
            <rect x={d * u * w - 12} y={-H.steps - 6} width={24} height={6} fill={tone(marble, -0.2)} />
          </g>
        )),
      )}
      <rect x={-ow - 4} y={-H.porch - 4} width={ow * 2 + 8} height={6} fill={tone(marble, -0.25)} />
      {glow > 0 ? <GlowS x={0} y={-H.door * 0.7} r={w * 0.4} squash={1.2} color="255,214,140" opacity={0.45 * glow * (0.92 + 0.08 * Math.sin(f * 0.07 + random(seed)))} /> : null}
    </g>
  );
};

/**
 * A colonnade (stoa) running along the band's ground from x0 to x1: Solomon's Colonnade in the temple court, a stoa in
 * the Athenian agora, the portico of a governor's palace. Columns `h` tall (in band units before k: ≈ 280 for a temple
 * colonnade in the mid band, 230 at Person scale behind people) every `gap` (h × 0.36), with capitals, an entablature, a
 * shadowed back wall and (`double`) a second row, plus a tiled roof (`roof`). `color` marble, `lit` 0..1 warm lamplight
 * between the columns at night. The colonnade stands on one level line (the lowest ground point under it, or `y`), so
 * its roof stays straight on rolling ground; `flat={false}` lets it follow the ground instead.
 */
export const Colonnade: React.FC<{ x0: number; x1: number; h?: number; gap?: number; double?: boolean; roof?: boolean; color?: string; lit?: number; doric?: boolean; wall?: string; y?: number; flat?: boolean }> = ({
  x0,
  x1,
  h = 230,
  gap,
  double = true,
  roof = true,
  color = "#D8CDB8",
  lit = 0,
  doric = false,
  wall = "#3A3026",
  y,
  flat = true,
}) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const k = band.k;
  const H = h * k;
  const G = (gap ?? h * 0.36) * k;
  const cw = h * 0.085 * k;
  const m = ink(color);
  const n = Math.max(2, Math.floor((x1 - x0) / G) + 1);
  const xs = Array.from({ length: n }, (_, i) => x0 + i * G);
  const level = y ?? Math.max(...Array.from({ length: 24 }, (_, i) => band.gy(lerp(x0, xs[n - 1] + G / 2, i / 23))));
  const ground = (xx: number) => (flat ? level : band.gy(xx));
  const top = (xx: number) => ground(xx) - H;
  const along = (off: number) => xs.map((xx, i) => `${i ? "L" : "M"} ${xx.toFixed(1)} ${(top(xx) - off).toFixed(1)}`).join(" ");
  const back = `${along(0)} L ${xs[n - 1]} ${ground(xs[n - 1])} ${xs
    .slice()
    .reverse()
    .map((xx) => `L ${xx.toFixed(1)} ${ground(xx).toFixed(1)}`)
    .join(" ")} Z`;
  const column = (xx: number, base: number, c: string, sc: number, key: string) => {
    const w = cw * sc;
    const t = base - H * sc;
    return (
      <g key={key}>
        <rect x={xx - w / 2} y={t + H * 0.06} width={w} height={H * sc - H * 0.06} fill={c} stroke={rim(0.6 * sc)} strokeWidth={1} />
        <rect x={xx - w / 2 + w * 0.15} y={t + H * 0.06} width={w * 0.18} height={H * sc - H * 0.06} fill="rgba(255,240,214,0.18)" />
        {doric ? (
          <rect x={xx - w * 0.75} y={t} width={w * 1.5} height={H * 0.06} fill={tone(c, 0.05)} />
        ) : (
          <path d={`M ${xx - w * 0.9} ${t} L ${xx + w * 0.9} ${t} L ${xx + w * 0.55} ${t + H * 0.07} L ${xx - w * 0.55} ${t + H * 0.07} Z`} fill={tone(c, 0.06)} />
        )}
        <rect x={xx - w * 0.7} y={base - H * 0.025} width={w * 1.4} height={H * 0.025} fill={tone(c, -0.1)} />
      </g>
    );
  };
  return (
    <g>
      <path d={back} fill={ink(wall)} />
      {lit > 0
        ? xs.slice(0, -1).map((xx, i) => <rect key={`l${i}`} x={xx + G * 0.3} y={top(xx) + H * 0.5} width={G * 0.4} height={H * 0.25} fill={`rgba(255,180,100,${(0.25 * lit).toFixed(3)})`} />)
        : null}
      {double ? xs.slice(0, -1).map((xx, i) => column(xx + G / 2, ground(xx + G / 2) - H * 0.05, tone(m, -0.3), 0.92, `b${i}`)) : null}
      {xs.map((xx, i) => column(xx, ground(xx), m, 1, `f${i}`))}
      <path d={`${along(0)} ${xs
        .slice()
        .reverse()
        .map((xx) => `L ${xx.toFixed(1)} ${(top(xx) - H * 0.13).toFixed(1)}`)
        .join(" ")} Z`} fill={tone(m, 0.04)} stroke={rim(0.8)} strokeWidth={1.2} />
      <path d={along(H * 0.065)} stroke={tone(m, -0.2)} strokeWidth={1.2} fill="none" />
      {roof ? (
        <path d={`${along(H * 0.13)} ${xs
          .slice()
          .reverse()
          .map((xx) => `L ${(xx - H * 0.08).toFixed(1)} ${(top(xx) - H * 0.3).toFixed(1)}`)
          .join(" ")} Z`} fill={ink("#8A4A30")} stroke={rim(0.7)} strokeWidth={1} />
      ) : null}
    </g>
  );
};

/**
 * A Greek or Roman temple: stepped base (or a high `podium` with front stairs), `cols` columns across `w` (default 8 ×
 * 420), columns `h` tall (200), an entablature with triglyphs ("doric") or a plain frieze ("ionic", "corinthian"), a
 * triangular pediment with acroteria, a dark cella wall and door between the columns, `double` a second row (the
 * Artemision). Monumental scale (a man ≈ 40 units): the Parthenon is about w 420, h 200. `lit` warms the door.
 */
export const ClassicTemple: React.FC<Base & { w?: number; h?: number; cols?: number; order?: "doric" | "ionic" | "corinthian"; podium?: number; color?: string; lit?: number; double?: boolean; roof?: boolean }> = ({
  x,
  y,
  s = 1,
  w = 420,
  h = 200,
  cols = 8,
  order = "doric",
  podium = 0,
  color = "#E2D8C4",
  lit = 0,
  double = false,
  roof = true,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const m = ink(color);
  const W2 = w / 2;
  const base = podium > 0 ? podium : 18;
  const cw = (w / cols) * (order === "doric" ? 0.46 : 0.36);
  const ent = h * 0.22;
  const top = -base - h;
  const pedH = w * 0.13;
  const cx = (i: number) => -W2 + cw * 0.8 + (i * (w - cw * 1.6)) / (cols - 1);
  const col = (xx: number, c: string, key: string, dy = 0) => (
    <g key={key}>
      <rect x={xx - cw / 2} y={top + dy + 8} width={cw} height={h - 8} fill={c} stroke={rim(0.6)} strokeWidth={0.9} />
      <line x1={xx - cw * 0.15} y1={top + dy + 10} x2={xx - cw * 0.15} y2={-base + dy} stroke={tone(c, -0.15)} strokeWidth={0.8} />
      <line x1={xx + cw * 0.18} y1={top + dy + 10} x2={xx + cw * 0.18} y2={-base + dy} stroke={tone(c, -0.15)} strokeWidth={0.8} />
      {order === "ionic" ? (
        <g>
          <rect x={xx - cw * 0.8} y={top + dy + 2} width={cw * 1.6} height={6} fill={tone(c, 0.05)} />
          <circle cx={xx - cw * 0.7} cy={top + dy + 8} r={cw * 0.24} fill="none" stroke={tone(c, -0.2)} strokeWidth={1} />
          <circle cx={xx + cw * 0.7} cy={top + dy + 8} r={cw * 0.24} fill="none" stroke={tone(c, -0.2)} strokeWidth={1} />
        </g>
      ) : order === "corinthian" ? (
        <path d={`M ${xx - cw * 0.8} ${top + dy} L ${xx + cw * 0.8} ${top + dy} L ${xx + cw * 0.5} ${top + dy + 12} L ${xx - cw * 0.5} ${top + dy + 12} Z`} fill={tone(c, 0.06)} />
      ) : (
        <rect x={xx - cw * 0.7} y={top + dy} width={cw * 1.4} height={8} fill={tone(c, 0.05)} />
      )}
    </g>
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {podium > 0 ? (
        <g>
          <rect x={-W2 - 10} y={-podium} width={w + 20} height={podium} fill={tone(m, -0.08)} stroke={rim(0.8)} strokeWidth={1.2} />
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={-W2 * 0.5 + i * 4} y={-((i + 1) * podium) / 8} width={w * 0.5 - i * 8} height={podium / 8} fill={tone(m, -0.02 - (i % 2) * 0.05)} />
          ))}
        </g>
      ) : (
        [0, 1, 2].map((i) => <rect key={i} x={-W2 - 14 + i * 6} y={-((i + 1) * base) / 3} width={w + 28 - i * 12} height={base / 3} fill={tone(m, -0.05 * i)} stroke={rim(0.6)} strokeWidth={0.8} />)
      )}
      <rect x={-W2 + cw * 0.6} y={top + 8} width={w - cw * 1.2} height={h - 8} fill={tone(m, -0.48)} />
      <rect x={-cw * 0.9} y={-base - h * 0.55} width={cw * 1.8} height={h * 0.55} fill={lit > 0 ? mixHex("#1A120C", "#E8A858", lit * 0.8) : "#0E0A08"} />
      {double ? Array.from({ length: cols - 1 }, (_, i) => col((cx(i) + cx(i + 1)) / 2, tone(m, -0.3), `d${i}`, -2)) : null}
      {Array.from({ length: cols }, (_, i) => col(cx(i), m, `c${i}`))}
      <rect x={-W2 - 4} y={top - ent} width={w + 8} height={ent} fill={tone(m, 0.04)} stroke={rim(0.8)} strokeWidth={1.1} />
      <line x1={-W2 - 4} y1={top - ent * 0.45} x2={W2 + 4} y2={top - ent * 0.45} stroke={tone(m, -0.18)} strokeWidth={1} />
      {order === "doric"
        ? Array.from({ length: cols * 2 - 1 }, (_, i) => <rect key={`t${i}`} x={-W2 + 6 + (i * (w - 16)) / (cols * 2 - 2) - 3} y={top - ent * 0.9} width={6} height={ent * 0.42} fill={tone(m, -0.22)} />)
        : null}
      {roof ? (
        <g>
          <path d={`M ${-W2 - 10} ${top - ent} L 0 ${top - ent - pedH} L ${W2 + 10} ${top - ent} Z`} fill={tone(m, 0.02)} stroke={rim(0.9)} strokeWidth={1.3} />
          <path d={`M ${-W2 + 14} ${top - ent - 5} L 0 ${top - ent - pedH + 10} L ${W2 - 14} ${top - ent - 5} Z`} fill={tone(m, -0.12)} />
          {[-W2 - 10, 0, W2 + 10].map((ax, i) => (
            <path key={i} d={`M ${ax - 6} ${i === 1 ? top - ent - pedH : top - ent} l 6 -12 l 6 12 Z`} fill={tone(m, 0.06)} />
          ))}
        </g>
      ) : null}
    </g>
  );
};

/**
 * The Acropolis of Athens across the city (Acts 17): a flat-topped limestone rock (default w = 1000, h = 170) with cliffs,
 * a wall along its brow, the Parthenon on the summit, the Erechtheion beside it and the Propylaea gate at the west end.
 * Monumental scale (a man ≈ 40 units). `lit` warms the temples at dusk.
 */
export const Acropolis: React.FC<Base & { w?: number; h?: number; seed?: string; lit?: number }> = ({ x, y, s = 1, w = 1000, h = 170, seed = "ac", lit = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const rockC = ink("#9A8E78");
  const W2 = w / 2;
  const pts: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const xx = lerp(-W2, W2, t);
    const edge = Math.min(1, Math.min(t, 1 - t) * 7);
    pts.push([xx + range(`${seed}x${i}`, -10, 10), -h * Math.pow(edge, 0.5) + range(`${seed}y${i}`, -8, 8) * edge]);
  }
  const rock = `M ${-W2 - 40} 0 ${pts.map((q) => `L ${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ")} L ${W2 + 40} 0 Z`;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <path d={rock} fill={rockC} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M ${range(`${seed}a${i}`, -W2 * 0.9, W2 * 0.6)} ${-range(`${seed}b${i}`, 20, h * 0.9)} l ${range(`${seed}c${i}`, 40, 140)} ${range(`${seed}d${i}`, -6, 6)}`} stroke={tone(rockC, -0.22)} strokeWidth={1.6} fill="none" />
      ))}
      <rect x={-W2 * 0.86} y={-h - 26} width={w * 0.86} height={28} fill={ink("#A89C84")} stroke={rim(0.7)} strokeWidth={1} />
      <NoScale>
        <ClassicTemple x={W2 * 0.18} y={-h - 18} s={0.85} w={360} h={150} cols={8} order="doric" lit={lit} />
        <ClassicTemple x={-W2 * 0.22} y={-h - 18} s={0.55} w={200} h={130} cols={6} order="ionic" lit={lit} />
        <ClassicTemple x={-W2 * 0.68} y={-h - 18} s={0.6} w={240} h={110} cols={6} order="doric" roof={false} lit={lit} />
      </NoScale>
    </g>
  );
};

/**
 * The great theatre of Ephesus on its hillside (Acts 19:29): a half-bowl of stone tiers climbing the slope (default
 * w = 1000, h = 330) cut by radial stairways, a colonnaded gallery round the top, the two-storey stage building across
 * the front. `crowd` 0..1 fills the tiers with people (dots); `uproar` 0..1 sets them heaving with raised arms.
 * Monumental scale (a man ≈ 40 units; seen from far off the heads are specks).
 */
export const Theatre: React.FC<Base & { w?: number; h?: number; crowd?: number; uproar?: number; seed?: string }> = ({ x, y, s = 1, w = 1000, h = 330, crowd = 0, uproar = 0, seed = "th" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const stone = ink("#B8AC94");
  const W2 = w / 2;
  const tiers = 14;
  const ry0 = h * 0.18;
  const cyB = -h * 0.22;
  const arc = (rx: number, ry: number) => `M ${-rx} ${cyB} A ${rx} ${ry} 0 0 1 ${rx} ${cyB}`;
  const people: React.ReactNode[] = [];
  if (crowd > 0)
    for (let t = 1; t < tiers; t++) {
      const u = t / tiers;
      const rx = lerp(W2 * 0.3, W2 * 0.98, u);
      const ry = lerp(ry0, h * 0.78, u);
      const m = Math.round(lerp(18, 60, u) * crowd);
      for (let j = 0; j < m; j++) {
        const a = Math.PI * (0.03 + 0.94 * random(`${seed}${t}a${j}`));
        const px = -Math.cos(a) * rx;
        const jump = uproar > 0 ? Math.max(0, Math.sin(f * 0.35 + j * 1.3 + t)) * 3 * uproar : 0;
        const py = cyB - Math.sin(a) * ry - 3 - jump;
        const col = ["#7A2E28", "#34465E", "#8C7656", "#E2DACA", "#4E5634", "#5A2234"][(j + t) % 6];
        people.push(<circle key={`${t}-${j}`} cx={px} cy={py} r={2.6} fill={ink(col)} />);
        if (uproar > 0.3 && (j + t) % 4 === 0) people.push(<line key={`${t}-${j}a`} x1={px + 1} y1={py - 2} x2={px + 2} y2={py - 8 - jump} stroke={ink("#6A4632")} strokeWidth={1.2} />);
      }
    }
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <path
        d={`M ${-W2 - 320} 0 Q ${-W2 - 120} ${cyB - h * 0.3} ${-W2 * 0.86} ${cyB - h * 0.86} Q ${-W2 * 0.4} ${cyB - h * 1.12} 0 ${cyB - h * 1.1} Q ${W2 * 0.45} ${cyB - h * 1.1} ${W2 * 0.88} ${cyB - h * 0.84} Q ${W2 + 120} ${cyB - h * 0.3} ${W2 + 320} 0 Z`}
        fill={ink("#76704E")}
        stroke={rim(0.6)}
        strokeWidth={1.2}
      />
      <path d={`${arc(W2 * 0.98, h * 0.8)} L ${W2 * 0.3} ${cyB} A ${W2 * 0.3} ${ry0} 0 0 0 ${-W2 * 0.3} ${cyB} Z`} fill={stone} stroke={rim(0.8)} strokeWidth={1.2} />
      {Array.from({ length: tiers }, (_, t) => {
        const u = t / tiers;
        return <path key={t} d={arc(lerp(W2 * 0.3, W2 * 0.98, u), lerp(ry0, h * 0.8, u))} stroke={tone(stone, t % 2 ? -0.18 : -0.08)} strokeWidth={1.4} fill="none" />;
      })}
      {Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI * (0.06 + (i * 0.88) / 10);
        return <line key={`r${i}`} x1={-Math.cos(a) * W2 * 0.3} y1={cyB - Math.sin(a) * ry0} x2={-Math.cos(a) * W2 * 0.98} y2={cyB - Math.sin(a) * h * 0.8} stroke={tone(stone, -0.28)} strokeWidth={2} />;
      })}
      {people}
      {Array.from({ length: 24 }, (_, i) => {
        const a = Math.PI * (0.02 + (i * 0.96) / 23);
        const px = -Math.cos(a) * W2;
        const py = cyB - Math.sin(a) * h * 0.82;
        return <rect key={`g${i}`} x={px - 3} y={py - 22} width={6} height={22} fill={tone(stone, 0.06)} />;
      })}
      <path d={arc(W2, h * 0.84)} stroke={tone(stone, 0.05)} strokeWidth={6} fill="none" />
      <rect x={-W2 * 0.62} y={-h * 0.3} width={w * 0.62} height={h * 0.3} fill={tone(stone, -0.05)} stroke={rim(0.9)} strokeWidth={1.3} />
      {Array.from({ length: 13 }, (_, i) => (
        <g key={`c${i}`}>
          <rect x={-W2 * 0.6 + i * (w * 0.6 / 12) - 4} y={-h * 0.28} width={8} height={h * 0.13} fill={tone(stone, 0.12)} />
          <rect x={-W2 * 0.6 + i * (w * 0.6 / 12) - 4} y={-h * 0.13} width={8} height={h * 0.13} fill={tone(stone, 0.12)} />
        </g>
      ))}
      {[-0.3, 0, 0.3].map((u) => (
        <path key={u} d={`M ${u * W2 - 16} 0 L ${u * W2 - 16} -26 A 16 16 0 0 1 ${u * W2 + 16} -26 L ${u * W2 + 16} 0 Z`} fill="#1A140E" />
      ))}
      <rect x={-W2 * 0.64} y={-h * 0.31} width={w * 0.64} height={6} fill={tone(stone, 0.1)} />
    </g>
  );
};

/**
 * Rome seen from across the Tiber (Acts 28:16): the Capitoline hill crowned by the temple of Jupiter, palace blocks on the
 * Palatine, tall insulae with tiled roofs, an aqueduct striding across, umbrella pines and cypresses (default w = 1600).
 * Monumental scale (a man ≈ 40 units). `lit` lights windows at dusk or night.
 */
export const RomeSkyline: React.FC<Base & { w?: number; lit?: number; seed?: string }> = ({ x, y, s = 1, w = 1600, lit = 0, seed = "rm" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const W2 = w / 2;
  const plaster = ink("#C8A880");
  const roofC = ink("#8A4A30");
  const win = (a: number) => (lit > 0 ? `rgba(255,196,110,${(0.3 + 0.6 * lit * a).toFixed(3)})` : tone(plaster, -0.55));
  const hill = (cx: number, hw: number, hh: number, c: string) => <path d={`M ${cx - hw} 0 Q ${cx - hw * 0.4} ${-hh} ${cx} ${-hh} Q ${cx + hw * 0.4} ${-hh} ${cx + hw} 0 Z`} fill={ink(c)} />;
  const blocks = (x0: number, x1: number, base: number, n: number, key: string) =>
    Array.from({ length: n }, (_, i) => {
      const bx = lerp(x0, x1, (i + random(`${seed}${key}x${i}`) * 0.6) / n);
      const bw = range(`${seed}${key}w${i}`, 36, 70);
      const bh = range(`${seed}${key}h${i}`, 40, 90);
      const c = mixHex(plaster, tone(plaster, -0.25), random(`${seed}${key}c${i}`));
      return (
        <g key={`${key}${i}`}>
          <rect x={bx - bw / 2} y={base - bh} width={bw} height={bh - base + 20} fill={c} stroke={rim(0.5)} strokeWidth={0.8} />
          <path d={`M ${bx - bw / 2 - 4} ${base - bh} L ${bx} ${base - bh - 10} L ${bx + bw / 2 + 4} ${base - bh} Z`} fill={roofC} />
          {[0, 1].map((r) => (
            <rect key={r} x={bx - bw * 0.3} y={base - bh + 10 + r * 22} width={6} height={8} fill={win(random(`${seed}${key}l${i}${r}`))} />
          ))}
          {[0, 1].map((r) => (
            <rect key={`b${r}`} x={bx + bw * 0.12} y={base - bh + 10 + r * 22} width={6} height={8} fill={win(random(`${seed}${key}m${i}${r}`))} />
          ))}
        </g>
      );
    });
  const pine = (px: number, base: number, sc: number, key: string) => (
    <g key={key} transform={`translate(${px} ${base}) scale(${sc})`}>
      <path d="M -2 0 Q -4 -40 0 -70 L 3 -70 Q 4 -40 3 0 Z" fill={ink("#4A3A2A")} />
      <ellipse cx={0} cy={-78} rx={34} ry={12} fill={ink("#34482A")} />
      <ellipse cx={-6} cy={-82} rx={22} ry={7} fill={ink("#425A32")} />
    </g>
  );
  const cypress = (px: number, base: number, sc: number, key: string) => (
    <path key={key} d={`M ${px} ${base} q -9 -30 -6 -60 q 2 -24 6 -40 q 4 16 6 40 q 3 30 -6 60 Z`} transform={`translate(${px} ${base}) scale(${sc}) translate(${-px} ${-base})`} fill={ink("#22321E")} />
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {hill(-W2 * 0.45, W2 * 0.4, 120, "#6A6A4A")}
      {hill(W2 * 0.2, W2 * 0.45, 90, "#5E6244")}
      {hill(W2 * 0.75, W2 * 0.3, 70, "#646648")}
      {blocks(-W2 * 0.95, -W2 * 0.6, -40, 7, "a")}
      {blocks(-W2 * 0.25, W2 * 0.55, -60, 14, "b")}
      {blocks(W2 * 0.55, W2 * 0.98, -30, 8, "c")}
      <NoScale>
        <ClassicTemple x={-W2 * 0.45} y={-120} s={0.7} w={300} h={130} cols={6} order="corinthian" podium={40} lit={lit} />
        <ClassicTemple x={W2 * 0.12} y={-96} s={0.45} w={260} h={120} cols={6} order="corinthian" podium={30} lit={lit} />
      </NoScale>
      <rect x={W2 * 0.18} y={-150} width={220} height={70} fill={tone(plaster, 0.06)} stroke={rim(0.7)} strokeWidth={1} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={`pa${i}`} d={`M ${W2 * 0.18 + 8 + i * 24} -80 L ${W2 * 0.18 + 8 + i * 24} -120 A 8 8 0 0 1 ${W2 * 0.18 + 24 + i * 24} -120 L ${W2 * 0.18 + 24 + i * 24} -80 Z`} fill={win(0.6)} />
      ))}
      <g>
        <rect x={-W2} y={-112} width={w * 0.6} height={12} fill={tone(plaster, 0.1)} stroke={rim(0.6)} strokeWidth={0.8} />
        {Array.from({ length: 30 }, (_, i) => (
          <path key={`aq${i}`} d={`M ${-W2 + i * (w * 0.6 / 30)} -100 L ${-W2 + i * (w * 0.6 / 30)} -20 L ${-W2 + 6 + i * (w * 0.6 / 30)} -20 A ${w * 0.3 / 30 - 6} 18 0 0 1 ${-W2 + (i + 1) * (w * 0.6 / 30) - 6} -20 L ${-W2 + (i + 1) * (w * 0.6 / 30)} -20 L ${-W2 + (i + 1) * (w * 0.6 / 30)} -100 Z`} fill={tone(plaster, 0.04)} />
        ))}
      </g>
      {[-0.8, -0.1, 0.42, 0.9].map((u, i) => pine(u * W2, -10, range(`${seed}ps${i}`, 0.8, 1.1), `p${i}`))}
      {[-0.65, -0.62, 0.05, 0.62, 0.66].map((u, i) => cypress(u * W2, -6, range(`${seed}cs${i}`, 0.8, 1.2), `c${i}`))}
    </g>
  );
};

/**
 * Jerusalem across the Kidron (Luke 19:41): the city climbing its hill behind a crenellated wall with towers and a gate,
 * the Temple Mount's great retaining walls on the right carrying the Royal Stoa and Herod's temple (HerodTemple at s 0.42
 * on the platform), the Antonia fortress at the platform's corner and Herod's palace towers on the far left. Default
 * w = 1400; platform top at -140, temple top about -340. Monumental scale (a man ≈ 40 units). `lit` lights windows,
 * `glow` the temple.
 */
export const JerusalemCity: React.FC<Base & { w?: number; lit?: number; glow?: number; seed?: string; torn?: number }> = ({ x, y, s = 1, w = 1400, lit = 0, glow = 0, seed = "jc", torn = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const W2 = w / 2;
  const stone = ink("#B8A684");
  const house = ink("#A8946E");
  const win = (a: number) => (lit > 0 ? `rgba(255,196,110,${(0.35 + 0.6 * lit * a).toFixed(3)})` : tone(house, -0.5));
  const pl0 = w * 0.02;
  const pl1 = w * 0.47;
  const PH = 140;
  const houses = Array.from({ length: 34 }, (_, i) => ({
    x: range(`${seed}x${i}`, -W2 * 0.95, pl0 - 20),
    b: -range(`${seed}b${i}`, 30, 150) * (1 - Math.abs(range(`${seed}x${i}`, -W2 * 0.95, pl0 - 20) + W2 * 0.4) / (W2 * 1.4)),
    w: range(`${seed}w${i}`, 30, 62),
    h: range(`${seed}h${i}`, 24, 50),
  })).sort((a, b) => a.b - b.b);
  const crenel = (x0: number, x1: number, top: number, c: string, key: string) =>
    Array.from({ length: Math.floor((x1 - x0) / 14) }, (_, i) => <rect key={`${key}${i}`} x={x0 + 3 + i * 14} y={top - 7} width={8} height={7} fill={c} />);
  const tower = (tx: number, th: number, tw: number, key: string) => (
    <g key={key}>
      <rect x={tx - tw / 2} y={-th} width={tw} height={th} fill={tone(stone, 0.04)} stroke={rim(0.8)} strokeWidth={1.1} />
      {crenel(tx - tw / 2, tx + tw / 2, -th, tone(stone, 0.04), `${key}c`)}
      <rect x={tx - 3} y={-th + 14} width={6} height={10} fill={win(random(`${seed}${key}`))} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <path d={`M ${-W2 - 60} 0 Q ${-W2 * 0.4} -150 ${pl0} -120 L ${pl1 + 40} -110 Q ${W2 + 20} -60 ${W2 + 80} 0 Z`} fill={ink("#8A7A5C")} />
      {houses.map((hs, i) => (
        <g key={i}>
          <rect x={hs.x - hs.w / 2} y={hs.b - hs.h} width={hs.w} height={hs.h + 60} fill={mixHex(house, tone(house, -0.25), random(`${seed}c${i}`))} stroke={rim(0.45)} strokeWidth={0.8} />
          <rect x={hs.x - hs.w / 2 - 2} y={hs.b - hs.h - 3} width={hs.w + 4} height={4} fill={tone(house, -0.3)} />
          <rect x={hs.x - 3} y={hs.b - hs.h + 9} width={6} height={7} fill={win(random(`${seed}l${i}`))} />
        </g>
      ))}
      {[-0.86, -0.78, -0.7].map((u, i) => tower(u * W2, 170 + (i === 1 ? 40 : 0), 40, `hp${i}`))}
      <rect x={pl0} y={-PH} width={pl1 - pl0} height={PH} fill={stone} stroke={rim(0.9)} strokeWidth={1.3} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`co${i}`} x1={pl0} y1={-PH + (i + 1) * 15} x2={pl1} y2={-PH + (i + 1) * 15} stroke={tone(stone, -0.14)} strokeWidth={1} />
      ))}
      {Array.from({ length: Math.floor((pl1 - pl0) / 12) }, (_, i) => (
        <rect key={`rs${i}`} x={pl0 + 4 + i * 12} y={-PH - 34} width={5} height={34} fill={tone(stone, 0.12)} />
      ))}
      <rect x={pl0} y={-PH - 42} width={pl1 - pl0} height={9} fill={tone(stone, 0.06)} />
      <path d={`M ${pl0} ${-PH - 42} L ${pl1} ${-PH - 42} L ${pl1 - 10} ${-PH - 56} L ${pl0 + 10} ${-PH - 56} Z`} fill={ink("#8A6A4A")} />
      <NoScale>
        <HerodTemple x={(pl0 + pl1) / 2 + 20} y={-PH} s={0.42} glow={glow + lit * 0.4} torn={torn} />
      </NoScale>
      <rect x={pl0 - 10} y={-PH - 110} width={90} height={110} fill={tone(stone, -0.04)} stroke={rim(0.8)} strokeWidth={1.1} />
      {[pl0 - 4, pl0 + 74].map((tx, i) => tower(tx, PH + 150 + (i ? 0 : 30), 26, `an${i}`))}
      <rect x={-W2 - 20} y={-52} width={pl0 + W2 + 20} height={52} fill={tone(stone, -0.08)} stroke={rim(0.8)} strokeWidth={1.2} />
      {crenel(-W2 - 20, pl0, -52, tone(stone, -0.08), "wl")}
      {[-0.9, -0.62, -0.34, -0.08].map((u, i) => tower(u * W2, 76, 34, `wt${i}`))}
      <path d={`M ${-W2 * 0.48 - 18} 0 L ${-W2 * 0.48 - 18} -26 A 18 18 0 0 1 ${-W2 * 0.48 + 18} -26 L ${-W2 * 0.48 + 18} 0 Z`} fill={lit > 0 ? `rgba(255,190,110,${0.3 + 0.5 * lit})` : "#1A120C"} />
    </g>
  );
};

/** A city gate seen close (Jerusalem, Damascus, Philippi): two towers 430 tall round an arched gateway 150 wide and 270
 *  high (taller than a man), walls 320 high running `wl` to the left and `wr` to the right. `lit` warms the passage.
 *  Person scale. A watchman on a tower stands at y = base - 430 × s × K at x ± 160 × s × K. */
export const CityGate: React.FC<Base & { wl?: number; wr?: number; lit?: number; color?: string }> = ({ x, y, s = 1, wl = 900, wr = 900, lit = 0, color = "#9A8668" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const gw = 150;
  const gh = 270;
  const tw = 170;
  const th = 430;
  const wh = 320;
  const arch = `M ${-gw / 2} 0 L ${-gw / 2} ${-gh + gw / 2} A ${gw / 2} ${gw / 2} 0 0 1 ${gw / 2} ${-gh + gw / 2} L ${gw / 2} 0 Z`;
  const merlons = (x0: number, x1: number, yy: number, key: string) =>
    Array.from({ length: Math.floor((x1 - x0) / 36) }, (_, i) => <rect key={`${key}${i}`} x={x0 + i * 36 + 6} y={yy - 18} width={22} height={18} fill={c} stroke={rim(0.5)} strokeWidth={1} />);
  const L0 = -gw / 2 - tw;
  const R0 = gw / 2 + tw;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={R0 + 60} ry={10} fill="rgba(0,0,0,0.35)" />
      <rect x={L0 - wl} y={-wh} width={wl} height={wh} fill={tone(c, -0.08)} stroke={rim(0.7)} strokeWidth={1.2} />
      <rect x={R0} y={-wh} width={wr} height={wh} fill={tone(c, -0.08)} stroke={rim(0.7)} strokeWidth={1.2} />
      {merlons(L0 - wl, L0, -wh, "ml")}
      {merlons(R0, R0 + wr, -wh, "mr")}
      {[1, 2, 3, 4, 5, 6].map((r) => (
        <g key={r} stroke="rgba(30,22,14,0.3)" strokeWidth={1}>
          <line x1={L0 - wl} y1={-r * 46} x2={L0} y2={-r * 46} />
          <line x1={R0} y1={-r * 46} x2={R0 + wr} y2={-r * 46} />
        </g>
      ))}
      <rect x={-gw / 2} y={-th + 60} width={gw} height={th - 60} fill={tone(c, 0.02)} stroke={rim(0.8)} strokeWidth={1.2} />
      {[L0, gw / 2].map((tx) => (
        <g key={tx}>
          <rect x={tx} y={-th} width={tw} height={th} fill={c} stroke={rim(0.9)} strokeWidth={1.4} />
          {merlons(tx - 4, tx + tw + 4, -th, `t${tx}`)}
          <rect x={tx + tw / 2 - 5} y={-th + 70} width={10} height={34} fill={lit > 0 ? `rgba(255,190,110,${0.3 + 0.5 * lit})` : "#140C08"} />
          <rect x={tx + tw / 2 - 5} y={-th + 190} width={10} height={34} fill="#140C08" />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
            <line key={r} x1={tx} y1={-r * 50} x2={tx + tw} y2={-r * 50} stroke="rgba(30,22,14,0.28)" strokeWidth={1} />
          ))}
        </g>
      ))}
      <path d={arch} fill={lit > 0 ? mixHex("#0A0806", "#B87A40", lit * 0.6) : "#0A0806"} />
      <path d={arch} fill="none" stroke={tone(c, -0.3)} strokeWidth={8} />
    </g>
  );
};

/** The Beautiful Gate of the temple (Acts 3:2): a gatehouse of white stone (640 wide, 560 tall) with pilasters and a
 *  gold cornice, three steps, and an arched opening 220 × 380 closed by double doors of gleaming Corinthian bronze.
 *  `open` 0..1 swings the doors back onto a bright court. Person scale. */
export const TempleGate: React.FC<Base & { open?: number; glow?: number }> = ({ x, y, s = 1, open = 0, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const clip = useUid("tgc");
  const m = ink("#E2D8C4");
  const gold = ink("#D6AE52");
  const bronze = ink(glow > 0 ? mixHex("#B8863A", "#FFD890", glow * 0.4) : "#B8863A");
  const gw = 220;
  const gh = 380;
  const arch = `M ${-gw / 2} -30 L ${-gw / 2} ${-gh + gw / 2} A ${gw / 2} ${gw / 2} 0 0 1 ${gw / 2} ${-gh + gw / 2} L ${gw / 2} -30 Z`;
  const o = clamp1(open);
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={360} ry={10} fill="rgba(0,0,0,0.35)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={-300 + i * 14} y={-(i + 1) * 10} width={600 - i * 28} height={10} fill={tone(m, -0.06 - (i % 2) * 0.05)} stroke={rim(0.5)} strokeWidth={0.8} />
      ))}
      <rect x={-320} y={-560} width={640} height={530} fill={m} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={-320} y1={-30 - (i + 1) * 50} x2={320} y2={-30 - (i + 1) * 50} stroke={tone(m, -0.08)} strokeWidth={1} />
      ))}
      {[-260, -170, 170, 260].map((px) => (
        <g key={px}>
          <rect x={px - 16} y={-520} width={32} height={490} fill={tone(m, -0.1)} stroke={rim(0.6)} strokeWidth={1} />
          <rect x={px - 22} y={-532} width={44} height={14} fill={gold} />
        </g>
      ))}
      <rect x={-330} y={-572} width={660} height={16} fill={gold} />
      {Array.from({ length: 36 }, (_, i) => (
        <line key={`s${i}`} x1={-326 + i * 18.6} y1={-572} x2={-326 + i * 18.6} y2={-584} stroke={gold} strokeWidth={1.6} />
      ))}
      <defs>
        <clipPath id={clip}>
          <path d={arch} />
        </clipPath>
      </defs>
      <path d={arch} fill={mixHex("#2A2016", "#F4E6C4", 0.3 + 0.6 * o)} />
      <g clipPath={`url(#${clip})`}>
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${(d * gw) / 2} 0) scale(${lerp(1, 0.14, o)} 1) translate(${(-d * gw) / 2} 0)`}>
            <rect x={d < 0 ? -gw / 2 : 0} y={-gh} width={gw / 2} height={gh - 30} fill={bronze} stroke={tone(bronze, -0.3)} strokeWidth={1.4} />
            {[0, 1, 2, 3].map((r) => (
              <rect key={r} x={(d < 0 ? -gw / 2 : 0) + 14} y={-gh + 150 + r * 52} width={gw / 2 - 28} height={40} fill="none" stroke={tone(bronze, 0.25)} strokeWidth={2} />
            ))}
            <circle cx={d * 18} cy={-170} r={6} fill={gold} />
          </g>
        ))}
      </g>
      <path d={arch} fill="none" stroke={gold} strokeWidth={6} />
      {glow > 0 ? <GlowS x={0} y={-220} r={260} color="255,214,150" opacity={0.35 * glow} /> : null}
    </g>
  );
};

/**
 * A Galilean or Judean stone house front (Nazareth, Capernaum, Bethany, Joppa): flat roof with a low parapet and beam
 * ends, outside stairs up the right side (`stairs`), a doorway 100 × 200 (a man walks in upright) at x = -0.2 w and a
 * small high window. Person scale: default w = 440, h = 300 (roof at -h). `door` 0..1 opens the door onto a lamplit room
 * (`lit`); `inDoor` is clipped to the doorway, anchored on its threshold; `roof` is anchored on the roof at its centre
 * (Peter praying on the housetop at Joppa; the friends lowering the paralysed man, Mark 2:4).
 */
export const HouseFront: React.FC<Base & { w?: number; h?: number; lit?: number; door?: number; inDoor?: React.ReactNode; roof?: React.ReactNode; stairs?: boolean; color?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  w = 440,
  h = 300,
  lit = 0,
  door = 0,
  inDoor,
  roof,
  stairs = true,
  color = "#A8946E",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const clip = useUid("hfc");
  const c = ink(color);
  const W2 = w / 2;
  const dx = -w * 0.2;
  const room = lit > 0 ? mixHex("#140C08", "#C88A48", lit * 0.7) : "#100A07";
  const doorP = `M ${dx - 50} 0 L ${dx - 50} -200 L ${dx + 50} -200 L ${dx + 50} 0 Z`;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={2} rx={W2 + 40} ry={9} fill="rgba(0,0,0,0.35)" />
      <rect x={-W2} y={-h} width={w} height={h} fill={c} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: 7 }, (_, r) =>
        Array.from({ length: 9 }, (_, i) => (
          <rect key={`${r}-${i}`} x={-W2 + (r % 2 ? 24 : 0) + i * 52} y={-h + 10 + r * 40} width={48} height={36} fill="none" stroke={tone(c, -0.12)} strokeWidth={1} opacity={0.6} />
        )),
      )}
      <rect x={-W2 - 6} y={-h - 20} width={w + 12} height={22} fill={tone(c, 0.05)} stroke={rim(0.9)} strokeWidth={1.2} />
      {Array.from({ length: Math.floor(w / 40) }, (_, i) => (
        <circle key={i} cx={-W2 + 20 + i * 40} cy={-h + 6} r={5} fill={ink("#5A3A22")} />
      ))}
      <defs>
        <clipPath id={clip}>
          <path d={doorP} />
        </clipPath>
      </defs>
      <path d={doorP} fill={room} />
      <g clipPath={`url(#${clip})`}>
        {lit > 0 ? <GlowS x={dx} y={-110} r={110} color="255,180,100" opacity={0.6 * lit} /> : null}
        <NoScale>
          <g transform={`translate(${dx} 0)`}>{inDoor}</g>
        </NoScale>
        <g transform={`translate(${dx - 50} 0) scale(${lerp(1, 0.12, clamp1(door))} 1) translate(${-(dx - 50)} 0)`}>
          <path d={doorP} fill={ink("#5A3E26")} stroke={rim(0.6)} strokeWidth={1} />
          {[-25, 0, 25].map((u) => (
            <line key={u} x1={dx + u} y1={-198} x2={dx + u} y2={-2} stroke="rgba(10,6,4,0.4)" strokeWidth={2} />
          ))}
        </g>
      </g>
      <rect x={dx - 60} y={-214} width={120} height={16} fill={ink("#6A4A2E")} stroke={rim(0.8)} strokeWidth={1} />
      <rect x={dx - 58} y={-200} width={8} height={200} fill={tone(c, -0.2)} />
      <rect x={dx + 50} y={-200} width={8} height={200} fill={tone(c, -0.2)} />
      <rect x={w * 0.12} y={-h * 0.72} width={44} height={36} fill={lit > 0 ? `rgba(255,190,110,${0.35 + 0.5 * lit})` : "#140C08"} />
      <rect x={w * 0.12 - 4} y={-h * 0.72 + 34} width={52} height={6} fill={tone(c, -0.2)} />
      {stairs
        ? (() => {
            const n = 9;
            const sw = 17;
            const sh = h / n;
            const pts: Pt[] = [[W2, 0], [W2 + n * sw, 0]];
            for (let i = 0; i < n; i++) {
              pts.push([W2 + (n - i) * sw, -(i + 1) * sh]);
              pts.push([W2 + (n - i - 1) * sw, -(i + 1) * sh]);
            }
            return <path d={poly(pts)} fill={tone(c, -0.1)} stroke={rim(0.7)} strokeWidth={1} />;
          })()
        : null}
      {roof ? (
        <NoScale>
          <g transform={`translate(0 ${-h})`}>{roof}</g>
        </NoScale>
      ) : null}
    </g>
  );
};
