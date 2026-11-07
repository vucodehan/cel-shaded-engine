import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Pt, add, lerp, mixPt, mod, polyline, range, rot, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { GlowS, useUid } from "./Atmos";
import { GoldLine } from "./Fx";
import { Look, Person, Pose } from "./Person";
import { NoScale, useBand, useInk, useRim } from "./Stage";
import { fonts } from "./theme";

/**
 * Props for Revelation (films 90–100): symbolic, luminous, heraldic. Same conventions as Props.tsx: band props have their
 * feet/base at y = 0 (on the band's ground at x unless y is given), the band scale k is applied automatically, up is
 * negative, and a man is 174 units tall at s = 1 (Person scale). Heights quoted are local units at s = 1; multiply by
 * s * K.<band> for pixels. "Plain" props take an explicit (x, y) anchor in the units of whatever group they are drawn in
 * (a Band, an <Svg>, or a figure's own group) and are also multiplied by the band k when inside a Band (wrap them in
 * <NoScale> inside a scaled group). Children passed into a slot (`rider`, `seat`) are drawn with NoScale at the named
 * anchor, so give them x = 0, y = 0. Nothing here is gory: beasts are emblems, judgment is light and books.
 */

type Base = { x: number; y?: number; s?: number; flip?: boolean };
const useBase = (x: number, y?: number) => {
  const band = useBand();
  return y ?? band.gy(x);
};

const D2R = Math.PI / 180;
const GOLD = "#E2B850";
const GOLD_L = "#FFE8A8";
const GOLD_D = "#9A7428";
const LINE = "#F8D488";
const clamp1 = (t: number) => Math.min(1, Math.max(0, t));
const f1 = (n: number) => n.toFixed(1);
const P = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`;
const dirv = (deg: number): Pt => [Math.sin(deg * D2R), Math.cos(deg * D2R)];
const mul = (p: Pt, k: number): Pt => [p[0] * k, p[1] * k];

/** The twelve foundation stones of Revelation 21:19–20, lowest first: jasper, sapphire, chalcedony, emerald, sardonyx,
 *  carnelian, chrysolite, beryl, topaz, chrysoprase, jacinth, amethyst (the same colours as the Nicene Creed film). */
export const FOUNDATION_STONES = ["#C24A3A", "#2149A8", "#8FA9C4", "#1F7A55", "#B5654A", "#9B1B30", "#C9C24A", "#5FA8A0", "#E0A030", "#7ABF6A", "#C2502A", "#7A4A9C"];
/** Twelve kinds of fruit on the tree of life (Revelation 22:2), one colour per month. */
export const LIFE_FRUIT = ["#E8483A", "#F2B840", "#8A3AA8", "#F28A3A", "#FFF0D0", "#E05A8A", "#7ACF6A", "#4A7AD8", "#C8302A", "#F2D860", "#B860E0", "#5AC8B0"];

/** Cubic Bézier point. */
const bez3 = (a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};

/** A tapered tube along a cubic spine (necks, tails, bodies): outline path, centre points and the end tangent. */
const tube = (a: Pt, b: Pt, c: Pt, d: Pt, w: (t: number) => number, n = 26) => {
  const L: Pt[] = [];
  const R: Pt[] = [];
  const C: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p0 = bez3(a, b, c, d, Math.max(0, t - 0.01));
    const p1 = bez3(a, b, c, d, Math.min(1, t + 0.01));
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const hw = w(t) / 2;
    const q = bez3(a, b, c, d, t);
    C.push(q);
    L.push([q[0] + nx * hw, q[1] + ny * hw]);
    R.push([q[0] - nx * hw, q[1] - ny * hw]);
  }
  const e0 = C[n - 1];
  const e1 = C[n];
  return { d: polyline([...L, ...R.reverse()], true), C, ang: Math.atan2(e1[1] - e0[1], e1[0] - e0[0]) / D2R };
};

/** Metallic gold gradient across a shape's bounding box. */
const GoldGrad: React.FC<{ id: string; c?: string; vertical?: boolean }> = ({ id, c = GOLD, vertical = false }) => (
  <linearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2={vertical ? "1" : "0"}>
    <stop offset="0" stopColor={tone(c, -0.42)} />
    <stop offset="0.32" stopColor={tone(c, 0.42)} />
    <stop offset="0.55" stopColor={c} />
    <stop offset="0.8" stopColor={tone(c, -0.2)} />
    <stop offset="1" stopColor={tone(c, -0.5)} />
  </linearGradient>
);

/** A four-pointed sparkle star at (cx, cy) with radius r and strength a. */
const sparkle = (cx: number, cy: number, r: number, a: number, key: string | number, color = "255,248,226") =>
  a <= 0.01 ? null : (
    <g key={key}>
      <circle cx={cx} cy={cy} r={r * 3.4} fill={`rgba(255,226,170,${(0.16 * a).toFixed(3)})`} />
      <path
        d={`M ${f1(cx)} ${f1(cy - r * 2.7)} L ${f1(cx + r * 0.36)} ${f1(cy - r * 0.36)} L ${f1(cx + r * 2.7)} ${f1(cy)} L ${f1(cx + r * 0.36)} ${f1(cy + r * 0.36)} L ${f1(cx)} ${f1(cy + r * 2.7)} L ${f1(cx - r * 0.36)} ${f1(cy + r * 0.36)} L ${f1(cx - r * 2.7)} ${f1(cy)} L ${f1(cx - r * 0.36)} ${f1(cy - r * 0.36)} Z`}
        fill={`rgba(${color},${a.toFixed(3)})`}
      />
      <circle cx={cx} cy={cy} r={r * 0.6} fill="#FFFFFF" opacity={a} />
    </g>
  );

/** Soft smoke or incense rising from (x, y): radial-gradient puffs that grow, drift and fade (`h` tall, puff radius `w`). */
const Puffs: React.FC<{ x: number; y: number; n?: number; h?: number; w?: number; a?: number; color?: string; seed: string; speed?: number; spread?: number; wisps?: boolean }> = ({
  x,
  y,
  n = 12,
  h = 220,
  w = 22,
  a = 0.6,
  color = "238,232,224",
  seed,
  speed = 0.006,
  spread = 14,
  wisps = true,
}) => {
  const f = useCurrentFrame();
  const id = useUid("pf");
  if (a <= 0.01) return null;
  return (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={0.9} />
          <stop offset="0.5" stopColor={`rgb(${color})`} stopOpacity={0.35} />
          <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      {wisps
        ? [0, 1].map((j) => {
            const ph = f * 0.03 + j * 2.4;
            const pts: Pt[] = Array.from({ length: 7 }, (_, i) => [x + Math.sin(ph + i * 0.9) * spread * (i / 6) * 1.4 + (j ? 3 : -3), y - (i / 6) * h * 0.75]);
            return <path key={j} d={smooth(pts, false)} stroke={`rgba(${color},${(0.35 * a).toFixed(3)})`} strokeWidth={1.6 - j * 0.4} fill="none" strokeLinecap="round" />;
          })
        : null}
      {Array.from({ length: n }, (_, i) => {
        const t = mod(f * speed + i / n + random(`${seed}${i}`) * 0.07, 1);
        const wob = Math.sin(t * 7 + i * 1.3) * spread * t;
        const r = w * (0.4 + 1.2 * t);
        return <ellipse key={i} cx={x + wob} cy={y - t * h} rx={r} ry={r * 0.82} fill={`url(#${id})`} opacity={a * Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.75} />;
      })}
    </g>
  );
};

/** Small five-pointed star polygon (crowns of stars, banners). */
const star5 = (cx: number, cy: number, r: number) =>
  polyline(
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt;
    }),
    true,
  );

/** A small royal crown (diadem) with `n` points, base centred at (cx, cy), `w` wide. */
export const crownPath = (cx: number, cy: number, w: number, n = 3, h?: number) => {
  const hh = h ?? w * 0.55;
  const pts: Pt[] = [[cx - w / 2, cy]];
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2);
    pts.push([cx - w / 2 + w * t, cy - (i % 2 === 0 ? hh : hh * 0.45)]);
  }
  pts.push([cx + w / 2, cy]);
  return polyline(pts, true);
};

// ── Person rig (mirrors Person.tsx so overlays land on hands and heads) ────────────────────

export type PoseRig = { hip: Pt; S: Pt; Hc: Pt; hr: number; tilt: number; lean: number; sh: Pt; elbow: Pt; hand: Pt; sh2: Pt; elbow2: Pt; hand2: Pt; eye: Pt; mouth: Pt; top: Pt; chest: Pt; feet: [Pt, Pt] };

/** Where a Person's joints are, in the Person's own units (feet at 0, facing right, before scale and flip). Mirrors the
 *  skeleton in Person.tsx (stand, kneel, sit, recline, walk); Person's own rig() gives the same points in band space. */
export const poseRig = (pose: Pose = {}, child = 0): PoseRig => {
  const k = pose.kneel ?? 0;
  const st = pose.sit ?? 0;
  const rc = (pose as { recline?: number }).recline ?? 0;
  const lean = (pose.lean ?? 0) + 50 * rc;
  const walking = pose.walk !== undefined;
  const ph = pose.walk ?? 0;
  const sw = walking ? Math.sin(ph) : 0;
  const bob = walking ? -Math.abs(Math.sin(ph)) * 1.8 : 0;
  const stride = (pose.stride ?? 1) * (1 - k) * (1 - st) * (1 - rc);
  const hip0 = mixPt(mixPt(mixPt([0, -84], [-6, -46], k), [-6, -42], st), [-4, -20], rc);
  const hip: Pt = [hip0[0], hip0[1] + bob];
  const torso = 58 * (1 - 0.06 * child);
  const S = add(hip, [Math.sin(lean * D2R) * torso, -Math.cos(lean * D2R) * torso]);
  const hr = 12.5 * (1 + 0.32 * child);
  const tilt = lean + (pose.head ?? 0) - 38 * rc;
  const Hc = add(S, rot([0, -(hr + 6.5)], tilt));
  const swing = walking ? sw * 16 : 0;
  const a1 = pose.arm ?? [lerp(8 + swing, 62, rc), lerp(14, 24, rc)];
  const a2 = pose.arm2 ?? [lerp(-6 - swing, -50, rc), lerp(10, 92, rc)];
  const arm = (a: [number, number], off: Pt) => {
    const sh = add(S, rot(off, lean));
    const el = add(sh, mul(dirv(a[0] + lean), 29));
    const hd = add(el, mul(dirv(a[0] + a[1] + lean), 26));
    return { sh, el, hd };
  };
  const fr = arm(a1, [3, 3]);
  const bk = arm(a2, [-3, 3]);
  const H = (p: Pt) => add(Hc, rot(p, tilt));
  return {
    hip,
    S,
    Hc,
    hr,
    tilt,
    lean,
    sh: fr.sh,
    elbow: fr.el,
    hand: fr.hd,
    sh2: bk.sh,
    elbow2: bk.el,
    hand2: bk.hd,
    eye: H([hr * 0.5, -hr * 0.14]),
    mouth: H([hr * 0.95, hr * 0.42]),
    top: H([0, -hr]),
    chest: add(S, rot([1, 14], lean)),
    feet: [[4 + (walking ? 10 * sw * stride : 0), -2.5], [-4 - (walking ? 10 * sw * stride : 0), -2.5]],
  };
};

/** Arm angles [shoulder, elbow] that put a Person's front (or back) hand at `target` (Person units, facing right). */
export const aimArm = (pose: Pose, target: Pt, back = false, elbowUp = false): [number, number] => {
  const r = poseRig(pose);
  const sh = back ? r.sh2 : r.sh;
  const L1 = 29;
  const L2 = 26;
  const v: Pt = [target[0] - sh[0], target[1] - sh[1]];
  const d = Math.min(L1 + L2 - 0.01, Math.max(4, Math.hypot(v[0], v[1])));
  const th = Math.atan2(v[0], v[1]) / D2R;
  const al = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))) / D2R;
  const a0 = elbowUp ? th + al : th - al;
  const el = add(sh, mul(dirv(a0), L1));
  const tf = Math.atan2(target[0] - el[0], target[1] - el[1]) / D2R;
  return [a0 - r.lean, tf - a0];
};

// ── Wings ────────────────────────────────────────────────────────────────────────────────

const wingGeo = (kind: "angel" | "eagle") => {
  const e = kind === "eagle";
  const T: Pt = e ? [-104, -142] : [-82, -156];
  const E: Pt = e ? [-34, 14] : [-22, 28];
  const Cc: Pt = e ? [-124, -34] : [-92, -30];
  const n = e ? 8 : 7;
  const B = (t: number): Pt => {
    const u = 1 - t;
    return [u * u * T[0] + 2 * u * t * Cc[0] + t * t * E[0], u * u * T[1] + 2 * u * t * Cc[1] + t * t * E[1]];
  };
  let d = `M 0 0 C -4 -48 ${e ? -34 : -26} -110 ${P(T)}`;
  let fe = "";
  for (let i = 0; i < n; i++) {
    const a = B(i / n);
    const b = B((i + 1) / n);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const o = e && i < 4 ? 22 - i * 3 : 11;
    const m: Pt = [(a[0] + b[0]) / 2 + (-dy / l) * o, (a[1] + b[1]) / 2 + (dx / l) * o];
    d += ` Q ${P(m)} ${P(b)}`;
    if (i < n - 1) {
      const q = mixPt(b, [-8, -26], e && i < 4 ? 0.42 : 0.55);
      fe += ` M ${P(b)} Q ${P(mixPt(b, q, 0.5))} ${P(q)}`;
    }
  }
  d += " Q -4 24 0 0 Z";
  fe += ` M -4 -12 C -10 -58 ${e ? -40 : -30} -104 ${e ? -76 : -64} -134`;
  return { outline: d, feathers: fe };
};
const WING_A = wingGeo("angel");
const WING_E = wingGeo("eagle");

/**
 * Gold line-art wings (angels, the living creatures, the woman's eagle wings). Plain: the anchor (x, y) is the wing root
 * at the shoulder of a right-facing figure; the wing rises up and back (flip for a left-facing figure). For a Person at
 * (px, gy) with total scale k (s × band k) the root is at (px - 2k·dir, gy - 136k); RevAngel in Cast6 places them for you.
 * Span about 110 wide and 185 tall at s = 1. `p` draws the line art on, `fill` shades them, `open` 0..1 raises them from
 * folded down the back to spread, `rot` adds degrees, `pair` adds the far wing, `kind` "eagle" has fingered primaries.
 */
export const GoldWings: React.FC<{ x: number; y: number; s?: number; flip?: boolean; p?: number; fill?: number; open?: number; rot?: number; pair?: boolean; kind?: "angel" | "eagle"; w?: number; color?: string; glow?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  p = 1,
  fill = 0.18,
  open = 1,
  rot: r0 = 0,
  pair = true,
  kind = "angel",
  w = 1.8,
  color = LINE,
  glow = 0.6,
}) => {
  const k = s * useBand().k;
  if (p <= 0) return null;
  const g = kind === "eagle" ? WING_E : WING_A;
  const fc = fill > 0 ? `rgba(255,236,190,${(fill * Math.min(1, p * 1.5)).toFixed(3)})` : undefined;
  const fold = lerp(62, 0, open) + r0;
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${flip ? -k : k} ${k})`}>
      {pair ? (
        <g transform={`translate(10 -4) rotate(${f1(fold - 9)}) scale(0.9)`} opacity={0.8}>
          <GoldLine d={g.outline} p={p} w={w * 0.8} glow={glow * 0.8} fill={fc} color={color} />
        </g>
      ) : null}
      <g transform={`rotate(${f1(fold)})`}>
        <GoldLine d={g.outline} p={p} w={w} glow={glow} fill={fc} color={color} />
        <GoldLine d={g.feathers} p={p} w={w * 0.55} glow={glow * 0.5} color={color} />
      </g>
    </g>
  );
};

// ── Light and stars ──────────────────────────────────────────────────────────────────────

/**
 * Seven stars (Revelation 1:16, 20). Plain, centred at (x, y). `mode` "ring": a circle of radius r (in His right hand:
 * r ≈ 22 around the hand); "arc": an upper arc of radius r; "sky": scattered over a w × h box. `p` reveals them one by
 * one, `size` is a star's radius.
 */
export const SevenStars: React.FC<{ x: number; y: number; r?: number; s?: number; p?: number; rot?: number; mode?: "ring" | "arc" | "sky"; w?: number; h?: number; size?: number; seed?: string }> = ({
  x,
  y,
  r = 24,
  s = 1,
  p = 1,
  rot: r0 = 0,
  mode = "ring",
  w = 600,
  h = 300,
  size = 3.4,
  seed = "7s",
}) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  if (p <= 0) return null;
  const pts: Pt[] = Array.from({ length: 7 }, (_, i) => {
    if (mode === "sky") return [range(`${seed}x${i}`, -w / 2, w / 2), range(`${seed}y${i}`, -h / 2, h / 2)];
    const a = (mode === "arc" ? -160 + (i * 140) / 6 : -90 + (i * 360) / 7 + r0 + f * 0.15) * D2R;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${k})`}>
      <GlowS x={0} y={0} r={(mode === "sky" ? Math.max(w, h) * 0.4 : r * 2.4)} color="255,236,190" opacity={0.35 * p} />
      {pts.map((q, i) => sparkle(q[0], q[1], size * (0.9 + 0.15 * Math.sin(f * 0.11 + i * 1.7)), clamp1(p * 7 - i) * (0.85 + 0.15 * Math.sin(f * 0.09 + i)), i))}
    </g>
  );
};

/** Seven lamps of fire burning before the throne (Revelation 4:5): flames on short gold stands in a row. Plain: (x, y) is
 *  the base of the middle stand, `w` the spread; stands 46 tall, flames to about -80 at s = 1. `lit` 0..1 lights them in
 *  turn; `arc` bows the row (positive: ends higher, as if curving round the throne). */
export const SevenTorches: React.FC<{ x: number; y: number; w?: number; s?: number; lit?: number; arc?: number; seed?: string }> = ({ x, y, w = 560, s = 1, lit = 1, arc = 0, seed = "st7" }) => {
  const f = useCurrentFrame();
  const k = useBand().k;
  return (
    <g>
      {Array.from({ length: 7 }, (_, i) => {
        const u = i / 6 - 0.5;
        const tx = x + u * w;
        const ty = y - arc * 4 * u * u;
        const sc = s * k;
        const a = clamp1(lit * 7 - i);
        const ph = random(`${seed}${i}`) * 6;
        const fl = 0.86 + 0.14 * Math.sin(f * 0.5 + ph) + 0.06 * Math.sin(f * 1.3 + ph);
        return (
          <g key={i} transform={`translate(${f1(tx)} ${f1(ty)}) scale(${sc})`}>
            <ellipse cx={0} cy={0} rx={14} ry={3} fill="rgba(0,0,0,0.3)" />
            <path d="M -10 0 L -3 -8 L -2.5 -38 L 2.5 -38 L 3 -8 L 10 0 Z" fill={GOLD_D} />
            <path d="M -1 -38 L -1 -8 L 1 -8 L 1 -38 Z" fill={GOLD_L} opacity={0.7} />
            <path d="M -12 -38 Q 0 -32 12 -38 L 10 -46 L -10 -46 Z" fill={GOLD} stroke={GOLD_L} strokeWidth={0.8} />
            {a > 0 ? (
              <>
                <GlowS x={0} y={-58} r={60} color="255,170,80" opacity={0.55 * a} />
                <path d={`M -9 -46 Q -10 ${-62 * fl} 0 ${-46 - 34 * a * fl} Q 10 ${-62 * fl} 9 -46 Z`} fill="#FF7A22" opacity={0.92 * a} />
                <path d={`M -5 -46 Q -6 ${-56 * fl} 0 ${-46 - 22 * a * fl} Q 6 ${-56 * fl} 5 -46 Z`} fill="#FFC24A" opacity={a} />
                <path d={`M -2.5 -46 Q -3 -52 0 ${-46 - 11 * a} Q 3 -52 2.5 -46 Z`} fill="#FFF4D0" opacity={a} />
              </>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

// ── Lampstands, thrones, glass ───────────────────────────────────────────────────────────

/**
 * One of the seven golden lampstands (Revelation 1:12): a domed tripod foot, a stem with three knops, a flared calyx and a
 * lamp bowl with one flame. Person scale: h = 150 (bowl rim, about shoulder height); flame tip at -h - 30. `lit` 0..1.
 */
export const GoldenLampstand: React.FC<Base & { lit?: number; h?: number; glow?: number; seed?: string }> = ({ x, y, s = 1, lit = 1, h = 150, glow = 1, seed = "gls" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const id = useUid("gls");
  const ph = random(seed) * 6.28;
  const fl = 0.88 + 0.12 * Math.sin(f * 0.37 + ph) * Math.sin(f * 0.13 + ph * 2);
  const g = ink(GOLD);
  const top = -h;
  const st0 = -16;
  const st1 = top + 20;
  const knops = [0.22, 0.5, 0.78].map((t) => lerp(st0, st1, t));
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`}>
      <defs>
        <GoldGrad id={id} c={g} />
      </defs>
      {lit > 0 ? <GlowS x={0} y={top - 16} r={230} squash={0.9} color="255,190,110" opacity={0.2 * lit * glow * fl} /> : null}
      <ellipse cx={0} cy={0} rx={32} ry={4.5} fill="rgba(0,0,0,0.35)" />
      <path d="M -28 0 Q -27 -10 -10 -15 L 10 -15 Q 27 -10 28 0 Z" fill={`url(#${id})`} stroke={rim(0.8)} strokeWidth={1} />
      <path d="M -24 -4 Q 0 -8 24 -4" stroke={tone(g, 0.45)} strokeWidth={1.2} fill="none" />
      <rect x={-3.6} y={st1} width={7.2} height={st0 - st1} fill={`url(#${id})`} stroke={rim(0.6)} strokeWidth={0.7} />
      {knops.map((ky, i) => (
        <g key={i}>
          <path d={`M -9 ${ky} Q -9 ${ky - 6} 0 ${ky - 7} Q 9 ${ky - 6} 9 ${ky} Q 9 ${ky + 6} 0 ${ky + 7} Q -9 ${ky + 6} -9 ${ky} Z`} fill={`url(#${id})`} stroke={rim(0.6)} strokeWidth={0.7} />
          <path d={`M -6 ${ky - 7} Q 0 ${ky - 14} 6 ${ky - 7}`} stroke={tone(g, 0.3)} strokeWidth={1.2} fill="none" />
        </g>
      ))}
      <path d={`M -3.6 ${top + 22} Q -6 ${top + 12} -17 ${top + 6} L 17 ${top + 6} Q 6 ${top + 12} 3.6 ${top + 22} Z`} fill={`url(#${id})`} />
      <path d={`M -23 ${top + 6} Q 0 ${top + 15} 23 ${top + 6} L 20 ${top} L -20 ${top} Z`} fill={`url(#${id})`} stroke={rim(0.8)} strokeWidth={0.9} />
      <ellipse cx={0} cy={top} rx={20} ry={3.6} fill={tone(g, 0.35)} />
      <ellipse cx={0} cy={top + 0.5} rx={15} ry={2.2} fill="#5A3A14" />
      {lit > 0 ? (
        <>
          <GlowS x={0} y={top - 14} r={80} color="255,200,120" opacity={0.6 * lit * glow * fl} />
          <path d={`M -6 ${top} Q -8 ${top - 12} 0 ${top - 30 * lit * fl} Q 8 ${top - 12} 6 ${top} Z`} fill="#FFA43A" opacity={0.95 * lit} />
          <path d={`M -3 ${top} Q -4 ${top - 8} 0 ${top - 18 * lit * fl} Q 4 ${top - 8} 3 ${top} Z`} fill="#FFF2C8" opacity={lit} />
        </>
      ) : null}
    </g>
  );
};

/**
 * The throne in heaven (Revelation 4): a stepped dais of white crystal, a tall arched throne of white and gold, and on it
 * the One seated shown only as light — clear jasper at the core, gold, and a carnelian (red-gold) aura (`presence`).
 * Person scale: dais top -56, seat (the `seat` anchor: the Lamb stands there, "in the center of the throne") -120, arms
 * -160, back top -362. `glow` 0..1 adds slow rays behind it.
 */
export const HeavenThrone: React.FC<Base & { glow?: number; presence?: number; seat?: React.ReactNode; white?: boolean }> = ({ x, y, s = 1, glow = 1, presence = 1, seat, white = false }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const f = useCurrentFrame();
  const id = useUid("ht");
  const g = white ? "#E8E4DA" : GOLD;
  const body = white ? "#F6F4EE" : "#F2EAD8";
  const pulse = 0.94 + 0.06 * Math.sin(f * 0.05);
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`}>
      <defs>
        <GoldGrad id={`${id}g`} c={g} />
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
          <stop offset="0.5" stopColor="#DCEBFA" stopOpacity={0.8} />
          <stop offset="1" stopColor="#B8D0E8" stopOpacity={0.7} />
        </linearGradient>
        <radialGradient id={`${id}r`} gradientUnits="userSpaceOnUse" cx={0} cy={-220} r={640}>
          <stop offset="0" stopColor="rgb(255,244,214)" stopOpacity={0.5} />
          <stop offset="0.35" stopColor="rgb(255,236,190)" stopOpacity={0.18} />
          <stop offset="1" stopColor="rgb(255,226,170)" stopOpacity={0} />
        </radialGradient>
      </defs>
      {glow > 0 ? (
        <g opacity={glow * 0.8} style={{ mixBlendMode: "screen" }}>
          {Array.from({ length: 40 }, (_, i) => {
            const a = (i / 40) * 360 + f * 0.08 + random(`hta${i}`) * 4;
            const L = 420 + 220 * random(`htr${i}`);
            const wd = 3 + 8 * random(`htw${i}`);
            const e: Pt = add([0, -220], [Math.cos(a * D2R) * L, Math.sin(a * D2R) * L * 0.85]);
            const nx = -Math.sin(a * D2R) * wd;
            const ny = Math.cos(a * D2R) * wd;
            return <path key={i} d={`M 0 -220 L ${f1(e[0] + nx)} ${f1(e[1] + ny)} L ${f1(e[0] - nx)} ${f1(e[1] - ny)} Z`} fill={`url(#${id}r)`} opacity={0.5 + 0.5 * Math.sin(f * 0.04 + i)} />;
          })}
        </g>
      ) : null}
      <ellipse cx={0} cy={0} rx={200} ry={9} fill="rgba(0,0,0,0.3)" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={-190 + i * 22} y={-14 - i * 14} width={380 - i * 44} height={14} fill={i % 2 ? tone(body, -0.06) : body} stroke="rgba(255,236,190,0.7)" strokeWidth={1} />
          <rect x={-190 + i * 22} y={-14 - i * 14} width={380 - i * 44} height={2.2} fill={g} opacity={0.9} />
        </g>
      ))}
      <path d="M -76 -120 L -76 -292 Q -76 -352 0 -364 Q 76 -352 76 -292 L 76 -120 Z" fill={`url(#${id}g)`} stroke={GOLD_L} strokeWidth={1.4} />
      <path d="M -62 -122 L -62 -288 Q -62 -338 0 -348 Q 62 -338 62 -288 L 62 -122 Z" fill={`url(#${id}c)`} />
      {[-40, -20, 0, 20, 40].map((xx) => (
        <line key={xx} x1={xx} y1={-130} x2={xx} y2={-300 - (40 - Math.abs(xx)) * 0.9} stroke={g} strokeWidth={1} opacity={0.55} />
      ))}
      <path d="M -62 -250 Q 0 -280 62 -250" stroke={g} strokeWidth={1.4} fill="none" opacity={0.7} />
      {[-76, 0, 76].map((xx, i) => (
        <circle key={i} cx={xx} cy={i === 1 ? -372 : -296} r={i === 1 ? 9 : 7} fill={`url(#${id}g)`} stroke={GOLD_L} strokeWidth={0.8} />
      ))}
      {presence > 0 ? (
        <g opacity={presence}>
          <GlowS x={0} y={-212} r={260 * pulse} squash={1.1} color="230,110,60" opacity={0.42} />
          <GlowS x={0} y={-212} r={170 * pulse} squash={1.15} color="255,214,140" opacity={0.75} />
          <GlowS x={0} y={-206} r={95} squash={1.4} color="255,252,240" opacity={1} />
          <path d="M 0 -330 C 34 -300 44 -220 30 -128 L -30 -128 C -44 -220 -34 -300 0 -330 Z" fill="rgba(255,253,246,0.82)" />
          <path d="M 0 -318 C 22 -292 28 -220 18 -132 L -18 -132 C -28 -220 -22 -292 0 -318 Z" fill="#FFFFFF" />
        </g>
      ) : null}
      <path d="M -96 -120 L 96 -120 L 90 -60 L -90 -60 Z" fill={body} stroke={GOLD_L} strokeWidth={1.2} />
      <rect x={-98} y={-126} width={196} height={9} rx={3} fill={`url(#${id}g)`} />
      <path d="M -90 -72 L 90 -72" stroke={g} strokeWidth={1.4} opacity={0.8} />
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={`M ${d * 96} -60 L ${d * 96} -156 L ${d * 110} -162 L ${d * 112} -60 Z`} fill={`url(#${id}g)`} stroke={GOLD_L} strokeWidth={0.9} />
          <circle cx={d * 104} cy={-166} r={8} fill={`url(#${id}g)`} stroke={GOLD_L} strokeWidth={0.8} />
        </g>
      ))}
      <NoScale>
        <g transform="translate(0 -126)">{seat}</g>
      </NoScale>
    </g>
  );
};

/**
 * An emerald rainbow encircling the throne (Revelation 4:3): a glowing ring, mostly emerald with faint gold and violet
 * edges. Plain: centre (x, y), radii rx, ry (ry defaults to rx); `p` draws it round from the top, `width` is the band.
 */
export const RainbowHalo: React.FC<{ x: number; y: number; rx: number; ry?: number; p?: number; opacity?: number; width?: number }> = ({ x, y, rx, ry, p = 1, opacity = 1, width = 26 }) => {
  const f = useCurrentFrame();
  if (p <= 0 || opacity <= 0) return null;
  const R = ry ?? rx;
  const bands = [
    { c: "#F2C860", o: 0.3, w: 0.16, off: 0.5 },
    { c: "#7AE8A8", o: 0.5, w: 0.2, off: 0.3 },
    { c: "#2FD08A", o: 0.95, w: 0.34, off: 0.04 },
    { c: "#159A6E", o: 0.85, w: 0.24, off: -0.26 },
    { c: "#2E9AB0", o: 0.35, w: 0.14, off: -0.46 },
    { c: "#7A6AD0", o: 0.2, w: 0.1, off: -0.58 },
  ];
  const ring = (dr: number, sw: number, c: string, o: number, key: string) => (
    <ellipse key={key} cx={0} cy={0} rx={rx + dr} ry={R + dr} fill="none" stroke={c} strokeWidth={sw} opacity={o} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} transform="rotate(-90)" />
  );
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`} opacity={opacity} style={{ mixBlendMode: "screen" }}>
      {ring(0, width * 3.4, "#2FD08A", 0.1, "g1")}
      {ring(0, width * 1.8, "#3AE098", 0.16, "g2")}
      {bands.map((b, i) => ring(b.off * width, b.w * width, b.c, b.o, `b${i}`))}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + f * 0.006;
        const vis = clamp1(p * 10 - i);
        return sparkle(Math.sin(a) * rx, -Math.cos(a) * R, 2.4, 0.8 * vis * (0.6 + 0.4 * Math.sin(f * 0.1 + i)), i, "220,255,236");
      })}
    </g>
  );
};

/**
 * The sea of glass, clear as crystal, before the throne (Revelation 4:6; 15:2 "mixed with fire"). Plain: an ellipse centred
 * at (x, y) with radii rx, ry: crystal gradient, rings, facets and slow glints. `fire` 0..1 swirls warm light through it.
 */
export const SeaOfGlass: React.FC<{ x: number; y: number; rx: number; ry: number; fire?: number; p?: number; seed?: string }> = ({ x, y, rx, ry, fire = 0, p = 1, seed = "sg" }) => {
  const f = useCurrentFrame();
  const id = useUid("sg");
  if (p <= 0) return null;
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${lerp(0.85, 1, p)})`} opacity={p}>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.42" r="0.6">
          <stop offset="0" stopColor="rgb(246,252,255)" stopOpacity={0.9} />
          <stop offset="0.45" stopColor="rgb(190,222,242)" stopOpacity={0.72} />
          <stop offset="1" stopColor="rgb(96,146,186)" stopOpacity={0.55} />
        </radialGradient>
        <radialGradient id={`${id}f`}>
          <stop offset="0" stopColor="rgb(255,170,80)" stopOpacity={0.6} />
          <stop offset="1" stopColor="rgb(255,90,40)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={ry * 0.18} rx={rx * 1.04} ry={ry * 1.1} fill="rgba(0,0,0,0.25)" />
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={`url(#${id})`} />
      {[0.28, 0.52, 0.76].map((k) => (
        <ellipse key={k} cx={0} cy={0} rx={rx * k} ry={ry * k} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.2} />
      ))}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return <line key={i} x1={Math.cos(a) * rx * 0.12} y1={Math.sin(a) * ry * 0.12} x2={Math.cos(a) * rx * 0.97} y2={Math.sin(a) * ry * 0.97} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />;
      })}
      <path d={`M ${-rx * 0.82} ${-ry * 0.3} Q 0 ${-ry * 1.02} ${rx * 0.82} ${-ry * 0.3}`} stroke="rgba(255,255,255,0.55)" strokeWidth={2.2} fill="none" />
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.6} />
      <ellipse cx={0} cy={0} rx={rx + 5} ry={ry + 3} fill="none" stroke="rgba(248,212,136,0.45)" strokeWidth={1.2} />
      {fire > 0 ? (
        <g opacity={fire}>
          <ellipse cx={0} cy={0} rx={rx * 0.9} ry={ry * 0.85} fill={`url(#${id}f)`} />
          {Array.from({ length: 7 }, (_, i) => {
            const a0 = random(`${seed}fa${i}`) * 6.28 + f * 0.012 * (i % 2 ? 1 : -1);
            const rr = range(`${seed}fr${i}`, 0.3, 0.85);
            const a1 = a0 + 1.2;
            return (
              <path
                key={i}
                d={`M ${f1(Math.cos(a0) * rx * rr)} ${f1(Math.sin(a0) * ry * rr)} A ${f1(rx * rr)} ${f1(ry * rr)} 0 0 1 ${f1(Math.cos(a1) * rx * rr)} ${f1(Math.sin(a1) * ry * rr)}`}
                stroke={i % 2 ? "rgba(255,150,60,0.7)" : "rgba(255,210,120,0.6)"}
                strokeWidth={3 + 2 * Math.sin(f * 0.2 + i)}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : null}
      {Array.from({ length: 14 }, (_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const d = Math.sqrt(random(`${seed}d${i}`)) * 0.9;
        return sparkle(Math.cos(a) * rx * d, Math.sin(a) * ry * d, 2, 0.9 * Math.max(0, Math.sin(f * 0.07 + i * 2.3)), i);
      })}
    </g>
  );
};

// ── The four living creatures ────────────────────────────────────────────────────────────

export type CreatureKind = "lion" | "ox" | "man" | "eagle";

/**
 * One of the four living creatures around the throne (Revelation 4:6–8): an emblem in the manner of the evangelists'
 * symbols — a calm frontal head (lion, ox, man; the eagle in profile) above a small feathered body, framed by six gold-
 * outlined wings whose rows of gold dots stand for "covered with eyes". Plain: (x, y) is the head centre; spread about 360
 * wide, 330 tall at s = 1 (head radius 40). `flap` 0..1 moves the wings slowly, `eyes` 0..1 shows the gold dots,
 * `p` reveals it.
 */
export const LivingCreature: React.FC<{ kind: CreatureKind; x: number; y: number; s?: number; flip?: boolean; p?: number; flap?: number; eyes?: number; glow?: number }> = ({
  kind,
  x,
  y,
  s = 1,
  flip = false,
  p = 1,
  flap = 0.6,
  eyes = 1,
  glow = 1,
}) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  const id = useUid("lc");
  if (p <= 0) return null;
  const bob = Math.sin(f * 0.04 + (kind.length * 1.3)) * 4;
  const wings = [
    { a: 24, R: 160, w: 44 },
    { a: 86, R: 172, w: 46 },
    { a: 150, R: 140, w: 42 },
  ];
  const tints: Record<CreatureKind, string> = { lion: "#C8924A", ox: "#8A5A3A", man: "#E8E0D0", eagle: "#8A6A3A" };
  const body = tints[kind];
  const wingEl = (a: number, R: number, wd: number, side: number, i: number) => {
    const fl = flap * Math.sin(f * 0.055 + i * 0.9) * 5;
    const ang = side * (a + fl * (i === 1 ? 1 : 0.7));
    const els: React.ReactNode[] = [];
    const n = 4;
    for (let j = n - 1; j >= 0; j--) {
      const fa = side * lerp(-5, 20, j / (n - 1)) * D2R;
      const L = R * lerp(1, 0.66, j / (n - 1));
      const B: Pt = [side * wd * 0.12 * j, -R * 0.06 * j];
      const T: Pt = [B[0] + Math.sin(fa) * L, B[1] - Math.cos(fa) * L];
      const Mf = mixPt(B, T, 0.58);
      const nx = Math.cos(fa);
      const ny = Math.sin(fa);
      const w = wd * 0.32;
      els.push(<path key={`f${j}`} d={`M ${P(B)} Q ${f1(Mf[0] + nx * w)} ${f1(Mf[1] + ny * w)} ${P(T)} Q ${f1(Mf[0] - nx * w)} ${f1(Mf[1] - ny * w)} ${P(B)} Z`} fill="rgba(255,246,228,0.94)" stroke={LINE} strokeWidth={1.6} strokeLinejoin="round" />);
      els.push(<path key={`q${j}`} d={`M ${P(B)} L ${P(mixPt(B, T, 0.9))}`} stroke={GOLD} strokeWidth={1} opacity={0.7} />);
      if (eyes > 0)
        [0.5, 0.76].forEach((t, k) => {
          const q = mixPt(B, T, t);
          els.push(<circle key={`e${j}${k}`} cx={q[0]} cy={q[1]} r={3.6} fill={GOLD} opacity={eyes} />);
          els.push(<circle key={`c${j}${k}`} cx={q[0]} cy={q[1]} r={1.3} fill="#FFF8E0" opacity={eyes} />);
        });
    }
    els.push(<path key="cov" d={`M 0 6 Q ${f1(side * -wd * 0.55)} ${f1(-R * 0.24)} ${f1(side * wd * 0.05)} ${f1(-R * 0.48)} Q ${f1(side * wd * 0.8)} ${f1(-R * 0.34)} ${f1(side * wd * 0.62)} ${f1(-R * 0.04)} Q ${f1(side * wd * 0.3)} 10 0 6 Z`} fill="#E8CC8A" stroke={LINE} strokeWidth={1.8} />);
    if (eyes > 0)
      [[0.02, 0.18], [0.24, 0.26], [0.12, 0.34]].forEach(([u, t], k) => {
        els.push(<circle key={`ce${k}`} cx={side * wd * u * 1.6} cy={-R * t} r={3.4} fill={GOLD} opacity={eyes} />);
      });
    return (
      <g key={`${side}${i}`} transform={`translate(${side * 16} 6) rotate(${f1(ang)})`}>
        {els}
      </g>
    );
  };
  const head = () => {
    if (kind === "lion") {
      const mane = Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const rr = i % 2 ? 46 : 58;
        return [Math.cos(a) * rr, Math.sin(a) * rr + 4] as Pt;
      });
      return (
        <g>
          <path d={smooth(mane, true, 0.25)} fill="#9A6A2E" stroke={LINE} strokeWidth={1.8} />
          <circle cx={-24} cy={-24} r={8} fill="#B8843E" />
          <circle cx={24} cy={-24} r={8} fill="#B8843E" />
          <path d="M -28 -6 Q -30 -30 0 -34 Q 30 -30 28 -6 Q 26 22 0 32 Q -26 22 -28 -6 Z" fill="#D8A860" stroke="#F2D488" strokeWidth={1.2} />
          <ellipse cx={0} cy={14} rx={15} ry={11} fill="#EED2A0" />
          <path d="M -7 4 L 7 4 L 0 12 Z" fill="#5A3A20" />
          <path d="M 0 12 L 0 18 M -8 21 Q 0 25 8 21" stroke="#6A4626" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <path d="M -17 -8 Q -11 -12 -5 -8" stroke="#3A2614" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <path d="M 5 -8 Q 11 -12 17 -8" stroke="#3A2614" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <path d="M -12 -22 Q 0 -26 12 -22" stroke="#B8843E" strokeWidth={1.4} fill="none" />
        </g>
      );
    }
    if (kind === "ox") {
      return (
        <g>
          <path d="M -22 -26 Q -40 -34 -50 -58 Q -38 -40 -24 -34 Z" fill="#EADCBE" stroke={LINE} strokeWidth={1.4} />
          <path d="M 22 -26 Q 40 -34 50 -58 Q 38 -40 24 -34 Z" fill="#EADCBE" stroke={LINE} strokeWidth={1.4} />
          <ellipse cx={-34} cy={-14} rx={12} ry={6} fill="#7A4A2E" transform="rotate(-20 -34 -14)" />
          <ellipse cx={34} cy={-14} rx={12} ry={6} fill="#7A4A2E" transform="rotate(20 34 -14)" />
          <path d="M -26 -30 Q 0 -40 26 -30 Q 30 0 22 22 Q 12 38 0 38 Q -12 38 -22 22 Q -30 0 -26 -30 Z" fill="#8E5E3C" stroke="#F2D488" strokeWidth={1.2} />
          <path d="M -8 -32 Q 0 -24 8 -32" stroke="#B88A5A" strokeWidth={2} fill="none" />
          <ellipse cx={0} cy={26} rx={18} ry={12} fill="#C8A07A" />
          <ellipse cx={-7} cy={26} rx={3} ry={2.2} fill="#4A2E1E" />
          <ellipse cx={7} cy={26} rx={3} ry={2.2} fill="#4A2E1E" />
          <path d="M -17 -6 Q -11 -10 -5 -6" stroke="#2A1A10" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <path d="M 5 -6 Q 11 -10 17 -6" stroke="#2A1A10" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        </g>
      );
    }
    if (kind === "man") {
      return (
        <g>
          <path d="M -30 -6 Q -34 -42 0 -44 Q 34 -42 30 -6 Q 26 -28 0 -30 Q -26 -28 -30 -6 Z" fill="#5A3A22" />
          <ellipse cx={0} cy={0} rx={25} ry={31} fill="#E2BC98" stroke="#F2D488" strokeWidth={1.2} />
          <path d="M -26 -8 Q -28 -36 0 -38 Q 28 -36 26 -8 Q 20 -24 0 -26 Q -20 -24 -26 -8 Z" fill="#5A3A22" />
          <path d="M -14 -4 Q -9 -7 -4 -4" stroke="#3A2416" strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M 4 -4 Q 9 -7 14 -4" stroke="#3A2416" strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M 0 -2 L -2 10 L 2 11" stroke="#B88A68" strokeWidth={1.4} fill="none" />
          <path d="M -6 18 Q 0 21 6 18" stroke="#8A4A3A" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </g>
      );
    }
    return (
      <g>
        <path d="M -26 30 Q -32 -6 -14 -30 Q 4 -46 24 -36 Q 38 -28 44 -14 L 56 -8 Q 58 2 48 6 Q 42 6 38 2 Q 30 14 22 30 Z" fill="#8A6A3A" stroke="#F2D488" strokeWidth={1.4} />
        <path d="M -14 -30 Q 4 -46 24 -36 Q 34 -30 38 -20 Q 20 -26 2 -18 Q -10 -12 -18 -4 Q -20 -20 -14 -30 Z" fill="#E8DCC0" />
        <path d="M 38 -18 Q 54 -18 58 -6 Q 58 6 50 10 Q 50 0 44 -4 Z" fill="#E8B83A" stroke="#F8D488" strokeWidth={1} />
        <circle cx={26} cy={-20} r={5} fill="#F2C048" />
        <circle cx={27} cy={-20} r={2.4} fill="#1A120C" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${-18 + i * 6} ${4 + i * 6} q 8 4 14 0`} stroke="#5A4426" strokeWidth={1.4} fill="none" />
        ))}
      </g>
    );
  };
  return (
    <g transform={`translate(${f1(x)} ${f1(y + bob * k)}) scale(${flip ? -k : k} ${k})`} opacity={Math.min(1, p * 1.4)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone(body, 0.2)} />
          <stop offset="1" stopColor={tone(body, -0.35)} />
        </linearGradient>
      </defs>
      {glow > 0 ? <GlowS x={0} y={10} r={220} color="255,226,170" opacity={0.32 * glow} /> : null}
      {wings.map((w, i) => (i === 0 ? [wingEl(w.a, w.R, w.w, -1, i), wingEl(w.a, w.R, w.w, 1, i)] : null))}
      {wings.map((w, i) => (i === 2 ? [wingEl(w.a, w.R, w.w, -1, i), wingEl(w.a, w.R, w.w, 1, i)] : null))}
      <path d="M -30 22 Q -36 70 -18 128 L 18 128 Q 36 70 30 22 Z" fill={`url(#${id})`} stroke={LINE} strokeWidth={1.6} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M ${-24 + i * 2} ${44 + i * 20} Q 0 ${52 + i * 20} ${24 - i * 2} ${44 + i * 20}`} stroke={LINE} strokeWidth={1} fill="none" opacity={0.5} />
      ))}
      {wings.map((w, i) => (i === 1 ? [wingEl(w.a, w.R, w.w, -1, i), wingEl(w.a, w.R, w.w, 1, i)] : null))}
      {head()}
    </g>
  );
};

// ── The Lamb and the scroll ──────────────────────────────────────────────────────────────

const woolPath = (cx: number, cy: number, rx: number, ry: number, n = 18, b = 3.4) => {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 1 + (i % 2 ? b / Math.max(rx, ry) : 0);
    pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
  }
  return smooth(pts, true, 0.6);
};

/**
 * The Lamb, standing as if slain (Revelation 5:6): a gentle white lamb standing with a soft glow and a gold nimbus; the
 * seven horns are seven small gold tines above the head and the seven eyes seven gold points on the nimbus — marks of
 * fullness of power and sight, never a wound. Faces right (flip for left). Person scale: shoulder -56, head top -84,
 * nimbus centre (36, -70) r 19; about 100 long. `glow`, `horns`, `eyes`, `halo` 0..1; `p` fades it in.
 */
export const LambStanding: React.FC<Base & { glow?: number; horns?: number; eyes?: number; halo?: number; p?: number }> = ({ x, y, s = 1, flip = false, glow = 1, horns = 1, eyes = 1, halo = 1, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const wool = "#F6F2E8";
  const shade = "#D8D0C0";
  const leg = (x0: number, c: string, key: string) => (
    <g key={key}>
      <path d={`M ${x0} -32 L ${x0 + 1} -6`} stroke={c} strokeWidth={6} strokeLinecap="round" />
      <ellipse cx={x0 + 1.5} cy={-2.5} rx={4} ry={2.6} fill="#6A5E54" />
    </g>
  );
  const hc: Pt = [36, -70];
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${flip ? -s : s} ${s})`} opacity={Math.min(1, p * 1.3)}>
      {glow > 0 ? (
        <>
          <GlowS x={6} y={-50} r={150} color="255,240,210" opacity={0.45 * glow} />
          <GlowS x={hc[0]} y={hc[1]} r={60} color="255,236,190" opacity={0.6 * glow} />
        </>
      ) : null}
      <ellipse cx={0} cy={0} rx={44} ry={4} fill="rgba(0,0,0,0.25)" />
      {leg(-17, shade, "l1")}
      {leg(17, shade, "l2")}
      {halo > 0 ? (
        <g opacity={halo}>
          <circle cx={hc[0]} cy={hc[1]} r={19} fill="rgba(255,226,150,0.22)" stroke={GOLD} strokeWidth={2.2} />
          <circle cx={hc[0]} cy={hc[1]} r={22.5} fill="none" stroke={GOLD_L} strokeWidth={0.8} opacity={0.6} />
        </g>
      ) : null}
      <path d={woolPath(-33, -46, 6, 6, 8, 1.6)} fill={wool} />
      <path d={woolPath(0, -42, 31, 16)} fill={wool} stroke="rgba(255,240,210,0.9)" strokeWidth={1.2} />
      {[[-14, -46], [-2, -50], [10, -46], [-8, -36], [6, -36]].map(([cx, cy], i) => (
        <path key={i} d={`M ${cx - 4} ${cy} q 4 -4 8 0`} stroke={shade} strokeWidth={1.2} fill="none" />
      ))}
      {leg(-21, wool, "l3")}
      {leg(21, wool, "l4")}
      <path d="M 18 -50 Q 24 -62 30 -64 L 36 -56 Q 30 -48 24 -44 Z" fill={wool} />
      <path d="M 27 -73 Q 34 -82 44 -78 Q 53 -74 55 -66 Q 55 -60 49 -58 Q 41 -56 33 -58 Q 25 -62 27 -73 Z" fill="#F0EAE0" stroke="rgba(255,240,210,0.9)" strokeWidth={1} />
      <path d={woolPath(34, -76, 8, 6, 10, 1.6)} fill={wool} />
      <path d="M 30 -70 Q 22 -70 18 -62 Q 24 -62 30 -66 Z" fill="#E6DCCC" />
      <path d="M 41 -69 Q 43 -71 45 -69" stroke="#3A2E28" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <ellipse cx={53.5} cy={-63.5} rx={1.8} ry={1.4} fill="#A08A80" />
      {horns > 0
        ? Array.from({ length: 7 }, (_, i) => {
            const a = (-150 + (i * 120) / 6) * D2R;
            const b: Pt = [hc[0] + Math.cos(a) * 10, hc[1] - 4 + Math.sin(a) * 9];
            const t: Pt = [hc[0] + Math.cos(a) * 16.5, hc[1] - 4 + Math.sin(a) * 15];
            return <path key={`h${i}`} d={`M ${P(b)} L ${P(t)}`} stroke={GOLD} strokeWidth={2} strokeLinecap="round" opacity={clamp1(horns * 7 - i)} />;
          })
        : null}
      {eyes > 0
        ? Array.from({ length: 7 }, (_, i) => {
            const a = (-165 + (i * 150) / 6) * D2R;
            const q: Pt = [hc[0] + Math.cos(a) * 19, hc[1] + Math.sin(a) * 19];
            return sparkle(q[0], q[1], 1.3, clamp1(eyes * 7 - i) * (0.85 + 0.15 * Math.sin(f * 0.1 + i)), `e${i}`);
          })
        : null}
    </g>
  );
};

/**
 * The scroll sealed with seven seals (Revelation 5:1; 6). Plain, centred at (x, y): a rolled scroll 150 long with gold
 * finials and seven red wax seals along its seam. `broken` 0..7 breaks them in order (a fraction animates the break: the
 * halves part with a flash); `open` 0..1 lets the sheet down from the roll, written on in gold-brown lines (once all seals
 * are broken). `glow` adds light. At s = 1 it suits a figure's hand; s ≈ 4–6 for a close-up.
 */
export const Scroll7: React.FC<{ x: number; y: number; s?: number; open?: number; broken?: number; glow?: number; rot?: number }> = ({ x, y, s = 1, open = 0, broken = 0, glow = 0, rot: r0 = 0 }) => {
  const k = s * useBand().k;
  const id = useUid("sc");
  const sheetH = 170 * open;
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${r0}) scale(${k})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6E0" />
          <stop offset="0.45" stopColor="#E8D6B0" />
          <stop offset="1" stopColor="#A88A5A" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2E6C8" />
          <stop offset="1" stopColor="#E2D0A8" />
        </linearGradient>
      </defs>
      {glow > 0 ? <GlowS x={0} y={sheetH / 2} r={160 + sheetH} color="255,226,170" opacity={0.45 * glow} /> : null}
      {open > 0 ? (
        <g>
          <rect x={-70} y={4} width={140} height={sheetH} fill={`url(#${id}s)`} stroke="rgba(160,120,60,0.6)" strokeWidth={1} />
          {Array.from({ length: Math.floor(sheetH / 12) }, (_, i) => {
            const yy = 18 + i * 12;
            if (yy > sheetH - 4) return null;
            const w0 = 100 - ((i * 37) % 23);
            return <line key={i} x1={-56} y1={yy} x2={-56 + w0} y2={yy} stroke="rgba(120,80,30,0.7)" strokeWidth={2} strokeDasharray="7 3 12 3 5 3" />;
          })}
          <rect x={-74} y={sheetH} width={148} height={10} rx={5} fill={`url(#${id})`} />
          <circle cx={-78} cy={sheetH + 5} r={5} fill={GOLD} />
          <circle cx={78} cy={sheetH + 5} r={5} fill={GOLD} />
        </g>
      ) : null}
      <rect x={-75} y={-13} width={150} height={26} rx={12} fill={`url(#${id})`} stroke="rgba(255,240,200,0.7)" strokeWidth={1} />
      <path d="M -70 -5 L 70 -5" stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
      <path d="M -70 6 Q 0 9 70 6" stroke="rgba(120,90,50,0.5)" strokeWidth={1.2} fill="none" />
      {[-1, 1].map((d) => (
        <g key={d}>
          <rect x={d * 75 - (d > 0 ? 0 : 6)} y={-5} width={6} height={10} fill={GOLD_D} />
          <circle cx={d * 84} cy={0} r={6.5} fill={GOLD} stroke={GOLD_L} strokeWidth={1} />
          <circle cx={d * 84 - 1.5} cy={-1.5} r={2} fill={GOLD_L} />
        </g>
      ))}
      {open <= 0
        ? Array.from({ length: 7 }, (_, i) => {
            const cx = -60 + i * 20;
            const kk = clamp1(broken - i);
            if (kk >= 1) return <circle key={i} cx={cx} cy={6} r={3.5} fill="rgba(140,40,30,0.35)" />;
            const sp = kk * 9;
            const fade = 1 - Math.max(0, kk - 0.4) / 0.6;
            return (
              <g key={i}>
                {kk > 0 ? <GlowS x={cx} y={6} r={24} color="255,226,160" opacity={Math.sin(Math.min(1, kk * 2) * Math.PI) * 0.9} /> : null}
                <g opacity={fade}>
                  <path d={`M ${cx - 7} ${6 - sp * 0.2} A 7 7 0 0 1 ${cx + 7} ${6 - sp * 0.2} Z`} transform={`translate(0 ${-sp}) rotate(${-kk * 20} ${cx} 6)`} fill="#A8261E" stroke="#E8C060" strokeWidth={0.9} />
                  <path d={`M ${cx - 7} ${6 + sp * 0.2} A 7 7 0 0 0 ${cx + 7} ${6 + sp * 0.2} Z`} transform={`translate(0 ${sp}) rotate(${kk * 20} ${cx} 6)`} fill="#8A1C16" stroke="#E8C060" strokeWidth={0.9} />
                  {kk <= 0 ? <path d={`M ${cx} 2 L ${cx} 10 M ${cx - 4} 6 L ${cx + 4} 6`} stroke="#E8C060" strokeWidth={1.1} opacity={0.8} /> : null}
                </g>
              </g>
            );
          })
        : null}
    </g>
  );
};

// ── Horses and riders ────────────────────────────────────────────────────────────────────

export type HorseColor = "white" | "red" | "black" | "pale";
const HORSE: Record<HorseColor, { coat: string; shade: string; mane: string; hoof: string }> = {
  white: { coat: "#EEEAE0", shade: "#C2BAAA", mane: "#FAF6EE", hoof: "#5A5048" },
  red: { coat: "#962E1E", shade: "#5E1A12", mane: "#4A1410", hoof: "#2A1A14" },
  black: { coat: "#26222A", shade: "#121016", mane: "#0C0A10", hoof: "#1A1616" },
  pale: { coat: "#A8B29C", shade: "#7A8470", mane: "#CDD2C2", hoof: "#4A4A44" },
};

const HORSE_BODY = smooth(
  [[72, -110], [74, -132], [58, -150], [30, -151], [0, -142], [-36, -146], [-66, -151], [-86, -140], [-93, -118], [-86, -98], [-62, -90], [-20, -87], [28, -89], [56, -95]] as Pt[],
  true,
  0.5,
);
const HORSE_NECK = smooth([[50, -147], [66, -178], [80, -208], [94, -217], [106, -198], [96, -168], [84, -134], [68, -114]] as Pt[], true, 0.45);
const HORSE_HEAD = smooth([[86, -212], [96, -226], [110, -222], [130, -192], [139, -178], [133, -168], [117, -170], [103, -184]] as Pt[], true, 0.45);

/**
 * A large, noble horse at true Person scale (the kit horse is small): withers at -150, head top about -240, nose to tail
 * about 240 long, facing right (flip for left). Made for the Rider Faithful and True, the armies of heaven and the four
 * horsemen. `color` white | red | black | pale, `run` a gallop phase (e.g. walkPhase(f, 2.4)) or `walk` a walk phase, `tack`
 * "royal" (gold bridle, white-and-gold cloth) | "plain" | "none", `glow` 0..1 heavenly light. `rider` is drawn in the
 * saddle: a Person at x = 0, y = 0 with pose { sit: 1 } (same s as the horse); `drape` (a robe colour) adds the rider's leg
 * and robe hanging down the near flank so the seat reads as astride.
 */
export const WhiteHorse: React.FC<Base & { color?: HorseColor; run?: number; walk?: number; glow?: number; tack?: "royal" | "plain" | "none"; rider?: React.ReactNode; drape?: string | null; p?: number; cloth?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  color = "white",
  run,
  walk,
  glow = 0,
  tack = "plain",
  rider,
  drape = null,
  p = 1,
  cloth,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const id = useUid("wh");
  if (p <= 0) return null;
  const C = HORSE[color];
  const coat = glow > 0 ? mixHex(ink(C.coat), "#FFFFFF", 0.2 * glow) : ink(C.coat);
  const shade = ink(C.shade);
  const mane = ink(C.mane);
  const galloping = run !== undefined;
  const walking = walk !== undefined;
  const ph = run ?? walk ?? 0;
  const amp = galloping ? 36 : walking ? 18 : 0;
  const bendA = galloping ? 70 : walking ? 30 : 0;
  const bob = galloping ? -Math.abs(Math.sin(ph)) * 7 : walking ? -Math.abs(Math.sin(ph)) * 2 : 0;
  const pitch = galloping ? Math.sin(ph) * 3 : 0;
  const offs = galloping ? [0, 0.35, 1.05, 1.4] : [0, 1, 0.5, 1.5];
  const leg = (hx: number, hy: number, i: number, hind: boolean, c: string, wd: number) => {
    const q = ph + offs[i] * Math.PI;
    const sw = amp > 0 ? Math.sin(q) * amp : hind ? -4 : 2;
    const bend = amp > 0 ? Math.max(0, -Math.cos(q)) * bendA : 0;
    const L1 = hind ? 50 : 48;
    const L2 = hind ? 54 : 52;
    const kx = hx + Math.sin(sw * D2R) * L1;
    const ky = hy + Math.cos(sw * D2R) * L1;
    const an = (sw + (hind ? bend : -bend)) * D2R;
    const fx = kx + Math.sin(an) * L2;
    const fy = ky + Math.cos(an) * L2;
    return (
      <g key={`lg${i}`}>
        <path d={`M ${f1(hx)} ${f1(hy)} L ${f1(kx)} ${f1(ky)}`} stroke={c} strokeWidth={wd} strokeLinecap="round" />
        <path d={`M ${f1(kx)} ${f1(ky)} L ${f1(fx)} ${f1(fy)}`} stroke={c} strokeWidth={wd * 0.55} strokeLinecap="round" />
        <circle cx={kx} cy={ky} r={wd * 0.36} fill={c} />
        <path d={`M ${f1(fx - 5)} ${f1(fy - 3)} L ${f1(fx + 6)} ${f1(fy - 3)} L ${f1(fx + 7)} ${f1(fy + 3)} L ${f1(fx - 6)} ${f1(fy + 3)} Z`} fill={ink(C.hoof)} transform={`rotate(${f1(-an / D2R * 0.4)} ${f1(fx)} ${f1(fy)})`} />
      </g>
    );
  };
  const wind = galloping ? 1 : 0.4;
  const maneStrands = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    const b: Pt = [lerp(90, 54, t), lerp(-214, -150, t)];
    const wv = Math.sin(f * 0.2 * wind + i * 0.9) * 4 * wind;
    const len = 26 + 6 * Math.sin(i * 1.7);
    return `M ${P(b)} Q ${f1(b[0] - len * 0.5)} ${f1(b[1] + 2 + wv)} ${f1(b[0] - len)} ${f1(b[1] + 10 + wv * 1.6)}`;
  }).join(" ");
  const tw = Math.sin(f * 0.16 * (galloping ? 1.6 : 0.6)) * (galloping ? 12 : 4);
  const tail = `M -88 -138 Q ${f1(-118 - tw * 0.3)} -128 ${f1(-122 - tw * 0.6)} ${galloping ? -110 : -96} Q ${f1(-126 - tw)} ${galloping ? -92 : -66} ${f1(-118 - tw * 1.2)} ${galloping ? -76 : -40}`;
  const clothC = cloth ?? (tack === "royal" ? "#F4F0E6" : "#6A4A30");
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${flip ? -s : s} ${s})`} opacity={Math.min(1, p * 1.4)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone(coat, 0.12)} />
          <stop offset="0.6" stopColor={coat} />
          <stop offset="1" stopColor={mixHex(coat, shade, 0.6)} />
        </linearGradient>
      </defs>
      {glow > 0 ? <GlowS x={10} y={-130} r={240} squash={0.7} color="255,244,220" opacity={0.45 * glow} /> : null}
      <ellipse cx={0} cy={0} rx={110} ry={7} fill="rgba(0,0,0,0.32)" />
      <g transform={`translate(0 ${f1(bob)}) rotate(${f1(pitch)} 0 -120)`}>
        {leg(48, -104, 1, false, shade, 15)}
        {leg(-74, -108, 3, true, shade, 19)}
        <path d={tail} stroke={mane} strokeWidth={12} fill="none" strokeLinecap="round" />
        <path d={tail} stroke={tone(mane, -0.15)} strokeWidth={5} fill="none" strokeLinecap="round" transform="translate(4 4)" />
        <path d={HORSE_NECK} fill={`url(#${id})`} stroke={rim(0.9)} strokeWidth={1.4} />
        <path d={HORSE_BODY} fill={`url(#${id})`} stroke={rim(0.9)} strokeWidth={1.4} />
        <path d="M -62 -146 Q -86 -126 -80 -100" stroke={tone(coat, -0.12)} strokeWidth={2} fill="none" opacity={0.6} />
        <path d="M 56 -146 Q 70 -126 62 -100" stroke={tone(coat, -0.12)} strokeWidth={2} fill="none" opacity={0.6} />
        <path d={HORSE_HEAD} fill={`url(#${id})`} stroke={rim(0.9)} strokeWidth={1.4} />
        <path d="M 91 -222 L 89 -240 L 98 -226 Z M 99 -224 L 102 -241 L 106 -222 Z" fill={coat} stroke={rim(0.8)} strokeWidth={1} />
        <path d={maneStrands} stroke={mane} strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d={`M 94 -220 Q 104 ${-214 + Math.sin(f * 0.2) * 2} 110 -206`} stroke={mane} strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M 108 -206 Q 111 -208 113 -205" stroke="#1A1410" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <ellipse cx={133} cy={-180} rx={2.2} ry={1.6} fill={tone(coat, -0.5)} />
        {tack !== "none" ? (
          <g>
            <path d="M -34 -150 Q 0 -156 38 -150 L 34 -110 Q 0 -104 -30 -110 Z" fill={ink(clothC)} stroke={tack === "royal" ? "#E8C060" : rim(0.7)} strokeWidth={tack === "royal" ? 2 : 1} />
            {tack === "royal"
              ? Array.from({ length: 9 }, (_, i) => <line key={i} x1={-28 + i * 7.6} y1={-108 + Math.sin(i) * 0.5} x2={-28 + i * 7.6} y2={-102} stroke="#E8C060" strokeWidth={1.6} />)
              : null}
            <path d="M 98 -220 L 112 -176 M 104 -196 L 130 -186 M 118 -172 L 132 -184" stroke={tack === "royal" ? "#E8C060" : "#3A2A1C"} strokeWidth={2} fill="none" />
            <path d="M 120 -176 Q 80 -150 40 -148" stroke={tack === "royal" ? "#E8C060" : "#3A2A1C"} strokeWidth={1.6} fill="none" />
          </g>
        ) : null}
        {leg(58, -102, 0, false, coat, 15)}
        {leg(-64, -106, 2, true, coat, 19)}
        <NoScale>
          <g transform="translate(9 -104)">{rider}</g>
        </NoScale>
        {drape ? (
          <g>
            <path d="M -12 -146 Q 14 -148 36 -136 Q 42 -118 34 -98 Q 28 -90 20 -90 L 6 -94 Q 2 -116 -12 -130 Z" fill={ink(drape)} stroke={rim(0.8)} strokeWidth={1.1} />
            <path d="M 18 -98 Q 24 -94 30 -96" stroke={tone(ink(drape), -0.3)} strokeWidth={1.4} fill="none" />
            <ellipse cx={26} cy={-88} rx={8} ry={3.4} fill={ink("#6A4632")} />
          </g>
        ) : null}
      </g>
    </g>
  );
};

/** Balance scales held up by the front hand at (hx, hy) (Person units). */
const scalesEl = (hx: number, hy: number) => (
  <g>
    <line x1={hx} y1={hy} x2={hx} y2={hy - 14} stroke={GOLD} strokeWidth={1.6} />
    <line x1={hx - 22} y1={hy - 14} x2={hx + 22} y2={hy - 14} stroke={GOLD} strokeWidth={2} strokeLinecap="round" />
    {[-1, 1].map((d) => (
      <g key={d}>
        <path d={`M ${hx + d * 22} ${hy - 14} L ${hx + d * 22 - 7} ${hy + 6} M ${hx + d * 22} ${hy - 14} L ${hx + d * 22 + 7} ${hy + 6}`} stroke="rgba(232,200,120,0.8)" strokeWidth={0.8} />
        <path d={`M ${hx + d * 22 - 9} ${hy + 6} Q ${hx + d * 22} ${hy + 13} ${hx + d * 22 + 9} ${hy + 6} Z`} fill={GOLD} stroke={GOLD_L} strokeWidth={0.6} />
      </g>
    ))}
    <circle cx={hx} cy={hy - 15} r={2} fill={GOLD_L} />
  </g>
);

export type RiderKind = "white" | "red" | "black" | "pale";
const RIDER_LOOK: Record<RiderKind, Look> = {
  white: { robe: "#ECE6D8", head: "hair", sash: "#E8C060", mantle: "#F6F0E2" },
  red: { robe: "#7A1E1A", head: "hair", sash: "#3A1210", beard: true },
  black: { robe: "#24202A", head: "hood", mantle: "#2E2834", sash: "#5A4A3A", beard: true },
  pale: { robe: "#8A9484", head: "hood", mantle: "#6E7868", skin: "#5A5A54" },
};

/**
 * A horseman of the first four seals (Revelation 6:1–8), stylized and without violence: the white horse's rider with a bow
 * and a gold crown, the red horse's rider holding a great sword upright, the black horse's rider holding up a pair of
 * scales, the pale (ash-green) horse's hooded rider named Death, with Hades a drifting shadow behind him (`hades` 0..1).
 * Built on WhiteHorse (same scale and anchors); `run`/`walk` as there; `hold` overrides the default.
 */
export const SealRider: React.FC<Base & { kind: RiderKind; run?: number; walk?: number; hold?: "bow" | "sword" | "scales" | "none"; crown?: boolean; p?: number; look?: Look; hades?: number; glow?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  kind,
  run,
  walk,
  hold,
  crown,
  p = 1,
  look,
  hades = 0,
  glow = 0,
}) => {
  const f = useCurrentFrame();
  const band = useBand();
  const gy = y ?? band.gy(x);
  const h = hold ?? (kind === "white" ? "bow" : kind === "red" ? "sword" : kind === "black" ? "scales" : "none");
  const lk = look ?? RIDER_LOOK[kind];
  const pose: Pose = { sit: 1, lean: run !== undefined ? 6 : 0, arm: h === "scales" ? [128, 30] : h === "sword" ? [150, 4] : h === "bow" ? [70, 10] : [40, 40], arm2: [30, 50] };
  const r = poseRig(pose);
  const hasCrown = crown ?? kind === "white";
  const riderLook: Look = { ...lk, hold: h === "bow" ? "bow" : h === "sword" ? "sword" : null };
  const k = s * band.k;
  return (
    <g>
      {hades > 0 && p > 0
        ? (() => {
            const d = flip ? 1 : -1;
            const hx = x + d * 200 * k;
            const hy = gy - 150 * k;
            return (
              <g opacity={hades * p}>
                {Array.from({ length: 14 }, (_, i) => {
                  const ph = random(`hd${i}`) * 6.28;
                  return (
                    <ellipse
                      key={i}
                      cx={hx + (random(`hdx${i}`) - 0.5) * 160 * k + Math.sin(f * 0.04 + ph) * 12 * k}
                      cy={hy + (random(`hdy${i}`) - 0.5) * 120 * k + Math.cos(f * 0.05 + ph) * 8 * k}
                      rx={range(`hdr${i}`, 40, 80) * k}
                      ry={range(`hdr${i}`, 26, 50) * k}
                      fill="rgba(8,8,14,0.26)"
                    />
                  );
                })}
              </g>
            );
          })()
        : null}
      <WhiteHorse
        x={x}
        y={gy}
        s={s}
        flip={flip}
        color={kind}
        run={run}
        walk={walk}
        p={p}
        glow={glow}
        tack={kind === "white" ? "royal" : "plain"}
        cloth={kind === "red" ? "#3A1410" : kind === "black" ? "#3A3440" : kind === "pale" ? "#5A6254" : undefined}
        drape={lk.robe ?? null}
        rider={
          <g>
            <Person x={0} y={0} s={1} look={riderLook} pose={pose} shadow={false} />
            {h === "scales" ? scalesEl(r.hand[0], r.hand[1]) : null}
            {hasCrown ? <path d={crownPath(r.top[0], r.top[1] + 3, 22, 3, 12)} fill="#E8C060" stroke="#FFF0C0" strokeWidth={0.8} /> : null}
          </g>
        }
      />
    </g>
  );
};

// ── Altar, censer, trumpet, bowls, sickle ────────────────────────────────────────────────

/**
 * The golden altar with the souls beneath it (Revelation 6:9–11): a gold altar of incense with horns, standing on a
 * stone platform pierced by three arches; under it kneel white-robed souls in a soft light, hands raised ("How long, O
 * Lord?"). Person scale: platform 130 tall and 420 wide, altar top -250, horn tips -266. `robes` 0..1 brightens their
 * robes to shining white (the white robes given), `souls` how many (3–9), `smoke` incense from the altar.
 */
export const AltarSouls: React.FC<Base & { souls?: number; robes?: number; smoke?: number; glow?: number; seed?: string }> = ({ x, y, s = 1, souls = 7, robes = 0, smoke = 0.6, glow = 1, seed = "as" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const id = useUid("as");
  const stone = ink("#8A7C68");
  const n = Math.max(1, Math.round(souls));
  const robe = mixHex("#BDB6A8", "#FFFFFF", robes);
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`}>
      <defs>
        <GoldGrad id={id} c={ink(GOLD)} />
        <radialGradient id={`${id}v`} cx="0.5" cy="0.7" r="0.7">
          <stop offset="0" stopColor="rgb(255,240,210)" stopOpacity={0.7 + 0.25 * robes} />
          <stop offset="1" stopColor="rgb(120,100,80)" stopOpacity={0.15} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={0} rx={230} ry={9} fill="rgba(0,0,0,0.35)" />
      <path d="M -210 0 L -210 -118 L 210 -118 L 210 0 Z" fill={stone} stroke={rim(0.8)} strokeWidth={1.3} />
      <rect x={-222} y={-130} width={444} height={14} fill={tone(stone, 0.12)} stroke={rim(0.8)} strokeWidth={1} />
      {[-130, 0, 130].map((ax) => (
        <g key={ax}>
          <path d={`M ${ax - 56} 0 L ${ax - 56} -60 Q ${ax - 56} -104 ${ax} -106 Q ${ax + 56} -104 ${ax + 56} -60 L ${ax + 56} 0 Z`} fill={`url(#${id}v)`} />
          <path d={`M ${ax - 56} 0 L ${ax - 56} -60 Q ${ax - 56} -104 ${ax} -106 Q ${ax + 56} -104 ${ax + 56} -60 L ${ax + 56} 0`} fill="none" stroke={tone(stone, 0.25)} strokeWidth={3} />
        </g>
      ))}
      <GlowS x={0} y={-50} r={260} squash={0.4} color="255,236,200" opacity={(0.3 + 0.4 * robes) * glow} />
      <NoScale>
        {Array.from({ length: n }, (_, i) => {
          const u = n === 1 ? 0.5 : i / (n - 1);
          const sx = lerp(-170, 170, u);
          const lk: Look = { robe, head: i % 3 === 1 ? "veil" : "hair", mantle: mixHex("#C8C0B0", "#FFFFFF", robes), glow: 0.3 + 0.6 * robes, beard: i % 3 === 2 };
          return <Person key={i} x={sx} y={-4} s={0.5} flip={sx > 0} look={lk} pose={{ kneel: 1, lean: -4, head: -18, arm: [150 + 8 * Math.sin(f * 0.05 + i), 10], arm2: [140, 14] }} shadow={false} />;
        })}
      </NoScale>
      <rect x={-80} y={-138} width={160} height={10} fill={`url(#${id})`} />
      <path d="M -60 -138 L -60 -236 L 60 -236 L 60 -138 Z" fill={`url(#${id})`} stroke="rgba(255,236,190,0.8)" strokeWidth={1.2} />
      <path d="M -60 -190 L 60 -190" stroke={GOLD_L} strokeWidth={1.2} opacity={0.6} />
      <rect x={-68} y={-250} width={136} height={14} fill={`url(#${id})`} stroke="rgba(255,236,190,0.8)" strokeWidth={1} />
      {[-62, 62].map((hx) => (
        <path key={hx} d={`M ${hx - 6} -250 L ${hx - 5} -260 Q ${hx} -270 ${hx + 5} -260 L ${hx + 6} -250 Z`} fill={`url(#${id})`} />
      ))}
      <ellipse cx={0} cy={-252} rx={30} ry={4} fill="#FF9A3A" opacity={0.8} />
      <GlowS x={0} y={-262} r={70} color="255,170,80" opacity={0.6} />
      <Puffs x={0} y={-256} h={260} w={16} a={smoke * 0.8} seed={`${seed}sm`} />
    </g>
  );
};

/**
 * A golden censer on three chains (Revelation 8:3–5). Plain: (x, y) is the ring held in the hand; the bowl hangs 64 below
 * (about 100 tall overall at s = 1). `swing` rotates it (degrees), `smoke` 0..1 incense rising (the prayers of the saints),
 * `fire` 0..1 fills it with blazing coals (before it is hurled to the earth).
 */
export const GoldenCenser: React.FC<{ x: number; y: number; s?: number; swing?: number; smoke?: number; fire?: number; seed?: string }> = ({ x, y, s = 1, swing = 0, smoke = 0.8, fire = 0, seed = "gc" }) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  const id = useUid("gc");
  const fl = 0.85 + 0.15 * Math.sin(f * 0.6);
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${k})`}>
      <defs>
        <GoldGrad id={id} />
      </defs>
      <Puffs x={-Math.sin(swing * D2R) * 52} y={Math.cos(swing * D2R) * 48} h={190} w={11} n={10} a={smoke * 0.85} spread={10} seed={`${seed}sm`} />
      <g transform={`rotate(${f1(swing)})`}>
        <circle cx={0} cy={0} r={5} fill="none" stroke={GOLD} strokeWidth={2} />
        {[-14, 0, 14].map((cx) => (
          <line key={cx} x1={0} y1={4} x2={cx} y2={52} stroke="rgba(232,196,110,0.9)" strokeWidth={1.1} />
        ))}
        {fire > 0 ? <GlowS x={0} y={58} r={70} color="255,140,50" opacity={0.75 * fire * fl} /> : null}
        <path d="M -17 52 Q 0 40 17 52 Z" fill={`url(#${id})`} stroke={GOLD_L} strokeWidth={0.8} />
        {[-8, 0, 8].map((hx) => (
          <circle key={hx} cx={hx} cy={49} r={1.6} fill={fire > 0 ? "#FFD27A" : "#5A3A14"} opacity={0.9} />
        ))}
        <path d="M -18 52 L 18 52 Q 18 72 0 76 Q -18 72 -18 52 Z" fill={`url(#${id})`} stroke={GOLD_L} strokeWidth={0.9} />
        <path d="M -6 76 L 6 76 L 8 82 L -8 82 Z" fill={GOLD_D} />
        <ellipse cx={0} cy={52} rx={18} ry={2.6} fill={GOLD_L} opacity={0.8} />
        {fire > 0 ? (
          <g opacity={fire}>
            {[-9, 0, 9].map((fx, i) => (
              <path key={i} d={`M ${fx - 5} 50 Q ${fx - 6} ${44 - 8 * fl} ${fx} ${36 - 10 * fl * (i === 1 ? 1.5 : 1)} Q ${fx + 6} ${44 - 8 * fl} ${fx + 5} 50 Z`} fill={i === 1 ? "#FFC24A" : "#FF7A22"} />
            ))}
          </g>
        ) : null}
      </g>
    </g>
  );
};

/**
 * An angel's trumpet: a long straight gold horn with a flared bell (Revelation 8:6). Plain: (x, y) is the mouthpiece and
 * `ang` the direction in degrees (0 points right, -30 points up and right); 96 long at s = 1. `blow` 0..1 sends rings of
 * light from the bell. RevAngel (Cast6) puts it to the lips for you.
 */
export const GoldTrumpet: React.FC<{ x: number; y: number; s?: number; ang?: number; blow?: number; glow?: number }> = ({ x, y, s = 1, ang = -20, blow = 0, glow = 0.6 }) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  const id = useUid("tr");
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${k})`}>
      <defs>
        <GoldGrad id={id} vertical />
      </defs>
      {glow > 0 ? <GlowS x={92} y={0} r={40 + 50 * blow} color="255,226,160" opacity={(0.3 + 0.5 * blow) * glow} /> : null}
      {blow > 0
        ? [0, 1, 2].map((i) => {
            const t = mod(f * 0.04 + i / 3, 1);
            const r = 14 + t * 90;
            return <path key={i} d={`M ${f1(96 + r * 0.5)} ${f1(-r)} A ${f1(r)} ${f1(r)} 0 0 1 ${f1(96 + r * 0.5)} ${f1(r)}`} stroke={`rgba(255,236,190,${((1 - t) * 0.8 * blow).toFixed(3)})`} strokeWidth={2.4 * (1 - t) + 0.6} fill="none" />;
          })
        : null}
      <path d="M -2 -3.5 Q 2 -4.5 4 -2 L 4 2 Q 2 4.5 -2 3.5 Z" fill={GOLD_D} />
      <rect x={3} y={-2.2} width={70} height={4.4} rx={2} fill={`url(#${id})`} />
      {[20, 46].map((rx) => (
        <rect key={rx} x={rx} y={-3.6} width={4} height={7.2} rx={1.5} fill={GOLD} stroke={GOLD_L} strokeWidth={0.5} />
      ))}
      <path d="M 72 -2.4 Q 84 -4 92 -12 L 96 -13 L 96 13 L 92 12 Q 84 4 72 2.4 Z" fill={`url(#${id})`} stroke={GOLD_L} strokeWidth={0.7} />
      <ellipse cx={96} cy={0} rx={2.6} ry={13} fill={GOLD_L} />
    </g>
  );
};

/**
 * One golden bowl (Revelation 5:8 full of incense; 15:7 the seven bowls). Plain: (x, y) is the bowl's centre; 64 wide at
 * s = 1. `tip` 0..1 tilts it (to the right), `pour` 0..1 lets a stream of fiery light fall from the lip (length `len`);
 * `incense` draws rising smoke instead.
 */
export const GoldenBowl: React.FC<{ x: number; y: number; s?: number; tip?: number; pour?: number; len?: number; incense?: boolean; color?: string }> = ({ x, y, s = 1, tip = 0, pour = 0, len = 520, incense = false, color = "255,150,70" }) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  const id = useUid("gb");
  const a = tip * 62;
  const lip: Pt = add(rot([32, -6], a), [0, 0]);
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${k})`}>
      <defs>
        <GoldGrad id={id} />
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={0.95} />
          <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0} />
        </linearGradient>
      </defs>
      {pour > 0 && !incense ? (
        <g style={{ mixBlendMode: "screen" }}>
          {[0.25, 0.55, 0.85].map((t) => (
            <GlowS key={t} x={lip[0] + 12} y={lip[1] + len * pour * t} r={46} squash={1.6} color={color} opacity={0.5 * pour} />
          ))}
          <path d={`M ${f1(lip[0] - 6)} ${f1(lip[1])} Q ${f1(lip[0] + 4)} ${f1(lip[1] + 30)} ${f1(lip[0] - 2)} ${f1(lip[1] + len * pour)} L ${f1(lip[0] + 30)} ${f1(lip[1] + len * pour)} Q ${f1(lip[0] + 22)} ${f1(lip[1] + 30)} ${f1(lip[0] + 8)} ${f1(lip[1] - 2)} Z`} fill={`url(#${id}p)`} />
          <path d={`M ${f1(lip[0] + 1)} ${f1(lip[1])} Q ${f1(lip[0] + 12)} ${f1(lip[1] + 30)} ${f1(lip[0] + 13)} ${f1(lip[1] + len * pour * 0.8)}`} stroke="rgba(255,240,200,0.85)" strokeWidth={3.4} fill="none" strokeLinecap="round" />
          {Array.from({ length: 10 }, (_, i) => {
            const t = mod(f * 0.03 + i / 10, 1) * pour;
            return <circle key={i} cx={lip[0] + 12 + Math.sin(i * 2.1) * 8} cy={lip[1] + t * len} r={2.6} fill={`rgba(255,240,200,${(0.9 * (1 - t / Math.max(0.01, pour))).toFixed(3)})`} />;
          })}
        </g>
      ) : null}
      {incense ? <Puffs x={0} y={-8} h={150} w={10} n={8} a={0.75} spread={8} seed="gbi" /> : null}
      <g transform={`rotate(${f1(a)})`}>
        <ellipse cx={0} cy={-6} rx={32} ry={6} fill={incense ? "#C8A070" : "#5A2A14"} />
        <path d="M -32 -6 Q -28 12 0 14 Q 28 12 32 -6 Q 0 0 -32 -6 Z" fill={`url(#${id})`} stroke={GOLD_L} strokeWidth={0.9} />
        <ellipse cx={0} cy={-6} rx={32} ry={6} fill="none" stroke={GOLD_L} strokeWidth={1.4} />
        <path d="M -8 14 L 8 14 L 6 19 L -6 19 Z" fill={GOLD_D} />
      </g>
    </g>
  );
};

/** Seven golden bowls in a shallow arc (Revelation 15:7). Plain: (x, y) centre of the row, `w` spread; `pour` a number for
 *  all or an array of seven 0..1 values (each tips and pours in turn). */
export const GoldenBowls: React.FC<{ x: number; y: number; w?: number; s?: number; pour?: number | number[]; len?: number; incense?: boolean }> = ({ x, y, w = 600, s = 1, pour = 0, len = 400, incense = false }) => (
  <g>
    {Array.from({ length: 7 }, (_, i) => {
      const u = i / 6 - 0.5;
      const pv = Array.isArray(pour) ? pour[i] ?? 0 : pour;
      return <GoldenBowl key={i} x={x + u * w} y={y + u * u * 60} s={s} tip={Math.min(1, pv * 2)} pour={clamp1(pv * 2 - 0.6)} len={len} incense={incense} />;
    })}
  </g>
);

/** A sharp golden sickle (Revelation 14:14). Plain: (x, y) is the grip; `ang` rotates it (degrees). Blade about 80 across
 *  at s = 1. */
export const GoldenSickle: React.FC<{ x: number; y: number; s?: number; ang?: number; glow?: number }> = ({ x, y, s = 1, ang = 0, glow = 0.6 }) => {
  const k = s * useBand().k;
  const id = useUid("gs");
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${k})`}>
      <defs>
        <GoldGrad id={id} />
      </defs>
      {glow > 0 ? <GlowS x={20} y={-40} r={70} color="255,226,160" opacity={0.45 * glow} /> : null}
      <rect x={-3} y={-6} width={6} height={30} rx={2.4} fill="#7A5230" />
      <rect x={-4} y={-9} width={8} height={5} rx={1.5} fill={GOLD} />
      <path d="M -2 -8 C -6 -52 40 -76 70 -50 C 52 -62 14 -56 4 -8 Z" fill={`url(#${id})`} stroke={GOLD_L} strokeWidth={1} />
      <path d="M 4 -14 C 10 -50 44 -64 64 -52" stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} fill="none" />
    </g>
  );
};

/** A white cloud billow to sit on (Revelation 14:14 "seated on a white cloud"). Band: base y = 0 is the cloud's underside;
 *  320 wide, top about -120 at s = 1; the `seat` anchor (0, -78) takes a Person at x = 0, y = 0 with pose { sit: 1 }. */
export const CloudSeat: React.FC<Base & { glow?: number; seat?: React.ReactNode; w?: number; seed?: string }> = ({ x, y, s = 1, glow = 0.8, seat, w = 320, seed = "cs" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const f = useCurrentFrame();
  const puffs = Array.from({ length: 11 }, (_, i) => {
    const u = i / 10 - 0.5;
    return { x: u * w * 0.9 + range(`${seed}x${i}`, -10, 10), y: -40 - (1 - 4 * u * u) * 40 + range(`${seed}y${i}`, -8, 8), r: range(`${seed}r${i}`, 34, 52) * (1 - Math.abs(u) * 0.6) };
  });
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`}>
      {glow > 0 ? <GlowS x={0} y={-60} r={w * 0.9} squash={0.5} color="255,236,200" opacity={0.4 * glow} /> : null}
      {puffs.map((q, i) => (
        <circle key={`s${i}`} cx={q.x + 4} cy={q.y + 8 + Math.sin(f * 0.03 + i) * 1.5} r={q.r} fill="rgba(170,176,196,0.9)" />
      ))}
      {puffs.map((q, i) => (
        <circle key={`c${i}`} cx={q.x} cy={q.y + Math.sin(f * 0.03 + i) * 1.5} r={q.r} fill="#F6F4F0" stroke="rgba(255,226,170,0.6)" strokeWidth={1.2} />
      ))}
      <path d={`M ${-w * 0.48} -10 Q 0 6 ${w * 0.48} -10`} stroke="rgba(160,166,188,0.8)" strokeWidth={10} fill="none" strokeLinecap="round" />
      <NoScale>
        <g transform="translate(0 -36)">{seat}</g>
      </NoScale>
    </g>
  );
};

// ── The mighty angel, the two witnesses ──────────────────────────────────────────────────

/**
 * The mighty angel of Revelation 10: robed in a cloud, a rainbow above his head, his face like the sun, his legs like
 * pillars of fire, his right foot on the sea and his left on the land, his right hand raised to heaven and the little
 * scroll open in his left. Seen from the front, so his right foot is on the screen left (flip to swap). Plain: (x, y) is
 * the ground line midway between his feet (feet ±150, pillars to -440, robe of cloud -440..-800); head centre (0, -860),
 * rainbow to about -1070, raised hand -1000 at s = 1. `scroll` 0..1 opens the little scroll, `roar` 0..1 sends rings from
 * his face, `p` brings him in.
 */
export const MightyAngel: React.FC<{ x: number; y: number; s?: number; flip?: boolean; p?: number; scroll?: number; roar?: number; seed?: string }> = ({ x, y, s = 1, flip = false, p = 1, scroll = 1, roar = 0, seed = "ma" }) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  const id = useUid("ma");
  if (p <= 0) return null;
  const pillar = (fx: number, key: string) => {
    const top: Pt = [fx * 0.5, -440];
    const tongues = Array.from({ length: 9 }, (_, i) => {
      const t = (i + 0.5) / 9;
      const yy = lerp(-20, -420, t);
      const xx = lerp(fx, top[0], t);
      const wd = lerp(56, 46, t);
      const ph = random(`${seed}${key}${i}`) * 6;
      const h = 30 + 16 * Math.sin(f * 0.4 + ph);
      return (
        <g key={i}>
          <path d={`M ${f1(xx - wd)} ${f1(yy + 10)} Q ${f1(xx - wd - 10)} ${f1(yy - h * 0.5)} ${f1(xx - wd + 4 + Math.sin(f * 0.3 + ph) * 4)} ${f1(yy - h)} Q ${f1(xx - wd + 8)} ${f1(yy - h * 0.4)} ${f1(xx - wd + 12)} ${f1(yy + 6)} Z`} fill="#FF8A2A" opacity={0.85} />
          <path d={`M ${f1(xx + wd)} ${f1(yy + 10)} Q ${f1(xx + wd + 10)} ${f1(yy - h * 0.5)} ${f1(xx + wd - 4 + Math.sin(f * 0.3 + ph + 1) * 4)} ${f1(yy - h)} Q ${f1(xx + wd - 8)} ${f1(yy - h * 0.4)} ${f1(xx + wd - 12)} ${f1(yy + 6)} Z`} fill="#FF8A2A" opacity={0.85} />
        </g>
      );
    });
    return (
      <g key={key}>
        <GlowS x={(fx + top[0]) / 2} y={-220} r={200} squash={1.6} color="255,140,50" opacity={0.5} />
        {tongues}
        <path d={`M ${fx - 56} 0 L ${top[0] - 46} ${top[1]} L ${top[0] + 46} ${top[1]} L ${fx + 56} 0 Z`} fill={`url(#${id}f)`} />
        <path d={`M ${fx - 20} 0 L ${top[0] - 15} ${top[1]} L ${top[0] + 15} ${top[1]} L ${fx + 20} 0 Z`} fill="rgba(255,246,214,0.85)" />
      </g>
    );
  };
  const robePts: Pt[] = [[-118, -772], [-100, -650], [-114, -540], [-156, -440], [-118, -404], [-40, -416], [40, -416], [118, -404], [156, -440], [114, -540], [100, -650], [118, -772], [62, -802], [0, -808], [-62, -802]];
  const robeD = smooth(robePts, true, 0.42);
  const sleeveR = tube([-100, -752], [-150, -820], [-196, -900], [-232, -968], (t) => lerp(80, 42, t));
  const sleeveL = tube([100, -752], [136, -712], [160, -668], [196, -652], (t) => lerp(74, 44, t));
  const edge: Pt[] = [];
  for (let i = 0; i < robePts.length; i++) {
    const a = robePts[i];
    const b = robePts[(i + 1) % robePts.length];
    for (let j = 0; j < 3; j++) edge.push(mixPt(a, b, j / 3));
  }
  const soft = (cx: number, cy: number, r: number, key: string, o = 1) => <circle key={key} cx={f1(cx)} cy={f1(cy)} r={f1(r)} fill={`url(#${id}c)`} opacity={o} />;
  const drift = (i: number) => Math.sin(f * 0.03 + i * 1.7) * 3;
  const head: Pt = [0, -860];
  const rb = ["#E8483A", "#F08A30", "#F2D040", "#5AB84A", "#3A8AD8", "#7A4AA8"];
  return (
    <g transform={`translate(${f1(x)} ${f1(y - (1 - p) * 200 * k)}) scale(${flip ? -k : k} ${k})`} opacity={Math.min(1, p * 1.3)}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFB040" />
          <stop offset="0.5" stopColor="#FF7A22" />
          <stop offset="1" stopColor="#FFD27A" />
        </linearGradient>
        <radialGradient id={`${id}s`}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#FFF2C4" />
          <stop offset="1" stopColor="#FFC85A" />
        </radialGradient>
        <radialGradient id={`${id}c`}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <stop offset="0.55" stopColor="#F2F4FA" stopOpacity={0.9} />
          <stop offset="1" stopColor="#E2E6F0" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#E8ECF4" />
          <stop offset="1" stopColor="#B8C0D2" />
        </linearGradient>
      </defs>
      <g style={{ mixBlendMode: "screen" }} opacity={0.85}>
        {rb.map((c, i) => (
          <path key={i} d={`M ${-210 + i * 10} ${head[1]} A ${210 - i * 10} ${210 - i * 10} 0 0 1 ${210 - i * 10} ${head[1]}`} stroke={c} strokeWidth={11} fill="none" opacity={0.7} />
        ))}
      </g>
      {pillar(-150, "r")}
      {pillar(150, "l")}
      <GlowS x={0} y={-620} r={460} squash={1.2} color="255,240,214" opacity={0.45} />
      <path d={sleeveR.d} fill={`url(#${id}r)`} />
      {sleeveR.C.filter((_, i) => i % 3 === 0).map((q, i) => soft(q[0] - 14 + drift(i), q[1], lerp(46, 30, i / 9), `sr${i}`, 0.9))}
      <path d={robeD} fill={`url(#${id}r)`} />
      {edge.map((q, i) => soft(q[0] + drift(i), q[1] + drift(i + 3), range(`${seed}e${i}`, 24, 38), `e${i}`, 0.95))}
      {Array.from({ length: 22 }, (_, i) => soft(range(`${seed}ix${i}`, -100, 100), range(`${seed}iy${i}`, -760, -440), range(`${seed}ir${i}`, 26, 44), `i${i}`, 0.7))}
      {[0, 1, 2, 3].map((i) => (
        <path key={`fold${i}`} d={`M ${-60 + i * 40} -620 Q ${-70 + i * 46} -520 ${-90 + i * 60} -430`} stroke="rgba(150,160,190,0.35)" strokeWidth={3} fill="none" />
      ))}
      <path d={sleeveL.d} fill={`url(#${id}r)`} />
      {sleeveL.C.filter((_, i) => i % 3 === 0).map((q, i) => soft(q[0] + drift(i), q[1] + 8, lerp(42, 30, i / 9), `sl${i}`, 0.9))}
      <path d={robeD} fill="none" stroke="rgba(255,226,170,0.55)" strokeWidth={2} />
      <GlowS x={-240} y={-995} r={70} color="255,246,220" opacity={0.9} />
      <path d="M -252 -990 Q -256 -1022 -246 -1030 Q -238 -1024 -238 -1004 L -228 -1018 Q -222 -1012 -226 -996 Q -232 -980 -246 -978 Z" fill="#FFF4DC" />
      <g transform={`translate(196 -664)`}>
        <rect x={-8} y={-26} width={16} height={4} rx={2} fill="#C8A060" />
        <rect x={-6} y={-24} width={12 + 30 * scroll} height={36} fill="#F6EBD0" stroke={GOLD} strokeWidth={1} transform={`translate(${-6 * scroll} 0)`} />
        {scroll > 0.3 ? [0, 1, 2].map((i) => <line key={i} x1={-6} y1={-14 + i * 9} x2={-6 + 24 * scroll} y2={-14 + i * 9} stroke="rgba(120,80,30,0.7)" strokeWidth={1.6} />) : null}
        <circle cx={-2} cy={-4} r={9} fill="#FFF4DC" />
      </g>
      <GlowS x={head[0]} y={head[1]} r={240} color="255,226,150" opacity={0.85} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + f * 0.004;
        return <line key={i} x1={head[0] + Math.cos(a) * 76} y1={head[1] + Math.sin(a) * 76} x2={head[0] + Math.cos(a) * (106 + (i % 2) * 24)} y2={head[1] + Math.sin(a) * (106 + (i % 2) * 24)} stroke="rgba(255,230,170,0.85)" strokeWidth={3.4} strokeLinecap="round" />;
      })}
      <circle cx={head[0]} cy={head[1]} r={70} fill={`url(#${id}s)`} />
      <circle cx={head[0]} cy={head[1]} r={46} fill="#FFFFFF" opacity={0.85} />
      <circle cx={head[0]} cy={head[1]} r={74} fill="none" stroke="rgba(255,236,190,0.8)" strokeWidth={2} />
      {roar > 0
        ? [0, 1, 2].map((i) => {
            const t = mod(f * 0.03 + i / 3, 1);
            const r = 80 + t * 260;
            return <circle key={i} cx={head[0]} cy={head[1]} r={r} fill="none" stroke={`rgba(255,236,190,${((1 - t) * 0.6 * roar).toFixed(3)})`} strokeWidth={4 * (1 - t) + 1} />;
          })
        : null}
    </g>
  );
};

/**
 * The two witnesses as their sign (Revelation 11:4; Zechariah 4): two olive trees and two golden lampstands, the trees
 * feeding the lamps with golden oil. Band: base y = 0; spans about ±250; tree tops about -290, lamp flames -205 at s = 1.
 * `lit` 0..1, `oil` 0..1 draws the gold streams, `glow`.
 */
export const OliveLampstands: React.FC<Base & { lit?: number; oil?: number; glow?: number; seed?: string }> = ({ x, y, s = 1, lit = 1, oil = 1, glow = 1, seed = "ol" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const olive = (tx: number, key: string) => {
    const blobs = Array.from({ length: 16 }, (_, i) => {
      const a = random(`${seed}${key}a${i}`) * Math.PI * 2;
      const rr = Math.sqrt(random(`${seed}${key}r${i}`));
      return { x: tx + Math.cos(a) * 92 * rr, y: -214 + Math.sin(a) * 56 * rr, r: range(`${seed}${key}s${i}`, 24, 38) };
    });
    const leaf = ink("#6A7A5A");
    const bark = ink("#5A5048");
    return (
      <g key={key}>
        <ellipse cx={tx} cy={0} rx={70} ry={6} fill="rgba(0,0,0,0.3)" />
        <path d={`M ${tx - 16} 0 Q ${tx - 4} -60 ${tx - 22} -110 Q ${tx - 10} -150 ${tx + 4} -170 L ${tx + 14} -160 Q ${tx + 4} -120 ${tx + 18} -90 Q ${tx + 10} -40 ${tx + 20} 0 Z`} fill={bark} stroke={rim(0.7)} strokeWidth={1.2} />
        {blobs.map((b, i) => (
          <circle key={`s${i}`} cx={b.x + 4} cy={b.y + 6} r={b.r} fill={tone(leaf, -0.35)} />
        ))}
        {blobs.map((b, i) => (
          <circle key={`m${i}`} cx={b.x} cy={b.y} r={b.r} fill={leaf} />
        ))}
        {blobs.map((b, i) => (b.y < -224 ? <circle key={`h${i}`} cx={b.x - b.r * 0.28} cy={b.y - b.r * 0.32} r={b.r * 0.5} fill={tone(leaf, 0.1)} /> : null))}
        {blobs.map((b, i) => (i % 3 === 0 ? <ellipse key={`o${i}`} cx={b.x + b.r * 0.3} cy={b.y + b.r * 0.3} rx={3.4} ry={4.4} fill={ink("#3A4A2A")} /> : null))}
        <path d={smooth(blobs.filter((b) => b.y < -230).map((b) => [b.x, b.y - b.r * 0.9] as Pt).sort((a, b) => a[0] - b[0]), false)} stroke="rgba(248,212,136,0.55)" strokeWidth={1.6} fill="none" />
      </g>
    );
  };
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`}>
      {glow > 0 ? <GlowS x={0} y={-160} r={340} squash={0.7} color="255,226,170" opacity={0.3 * glow} /> : null}
      {olive(-170, "L")}
      {olive(170, "R")}
      {oil > 0
        ? [-1, 1].map((d) => {
            const dd = `M ${d * 120} -200 C ${d * 100} -150 ${d * 70} -190 ${d * 58} -172`;
            return (
              <g key={d}>
                <GoldLine d={dd} p={oil} w={2.6} glow={0.8} />
                {Array.from({ length: 4 }, (_, i) => {
                  const t = mod(f * 0.02 + i / 4, 1);
                  const q = bez3([d * 120, -200], [d * 100, -150], [d * 70, -190], [d * 58, -172], t);
                  return <circle key={i} cx={q[0]} cy={q[1]} r={2} fill="#FFE8A8" opacity={oil * Math.sin(Math.PI * t)} />;
                })}
              </g>
            );
          })
        : null}
      <NoScale>
        <GoldenLampstand x={-58} y={0} s={1} lit={lit} h={150} seed={`${seed}l1`} />
        <GoldenLampstand x={58} y={0} s={1} lit={lit} h={150} seed={`${seed}l2`} />
      </NoScale>
      {glow > 0 && lit > 0 ? <GlowS x={0} y={-190} r={120} color="255,214,140" opacity={0.25 * glow * lit * (0.9 + 0.1 * Math.sin(f * 0.2))} /> : null}
    </g>
  );
};

// ── The dragon and the beasts (heraldic emblems) ─────────────────────────────────────────

/** A heraldic beast head pointing +x at the origin: snout, jaw, an eye dot, horns (`horns` 0–2) and an optional crown. */
const beastHead = (body: string, belly: string, line: string, horns: number, crown: boolean, mane: boolean, lion: boolean, key: string) => (
  <g key={key}>
    {mane ? <path d={smooth(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const rr = i % 2 ? 17 : 23; return [Math.cos(a) * rr - 2, Math.sin(a) * rr] as Pt; }), true, 0.3)} fill={tone(body, -0.3)} stroke={line} strokeWidth={1.2} /> : null}
    {Array.from({ length: horns }, (_, i) => (
      <path key={i} d={`M ${-4 - i * 7} -9 Q ${-14 - i * 8} -22 ${-24 - i * 7} -30 Q ${-12 - i * 7} -20 ${2 - i * 7} -11 Z`} fill="#E8DCC0" stroke={line} strokeWidth={0.9} />
    ))}
    <path d={lion ? "M -10 -12 Q 6 -17 20 -12 L 32 -6 Q 36 0 32 5 L 18 9 Q 2 12 -10 9 Z" : "M -10 -10 Q 8 -15 24 -9 L 42 -4 Q 46 0 42 4 L 22 8 Q 4 11 -10 9 Z"} fill={body} stroke={line} strokeWidth={1.3} strokeLinejoin="round" />
    <path d={lion ? "M 2 3 L 30 3" : "M 6 2.5 L 40 2.5"} stroke={tone(body, -0.45)} strokeWidth={1.2} />
    <path d={lion ? "M -6 6 Q 8 10 26 6" : "M -6 6 Q 12 10 36 6"} stroke={belly} strokeWidth={2} fill="none" opacity={0.7} />
    <circle cx={lion ? 10 : 12} cy={-5} r={2.4} fill={GOLD_L} />
    <circle cx={lion ? 31 : 40} cy={-1.5} r={1.1} fill={tone(body, -0.5)} />
    {crown ? <path d={crownPath(2, -12, 18, 3, 10)} fill="#E8C060" stroke="#FFF0C0" strokeWidth={0.7} /> : null}
  </g>
);

/**
 * The great red dragon of Revelation 12:3 as a heraldic emblem: a red serpentine body with gold scale lines, two clawed
 * legs, spined red wings, a long curling tail, and seven necks fanning up from the shoulders, each head wearing a small
 * gold crown — ten ivory horns among them. Calm, closed mouths, gold dot eyes. Band: feet at y = 0, facing right (flip
 * for left); about 640 wide, body top about -190, wing tips about -380, heads up to -400 at s = 1. `tail` 0..1 sweeps the tail up (with
 * `stars` a trail of falling stars, 12:4), `fall` 0..1 tumbles it down out of heaven (12:9), `p` fades it in.
 */
export const RedDragon: React.FC<Base & { p?: number; tail?: number; stars?: boolean; fall?: number; color?: string; seed?: string }> = ({ x, y, s = 1, flip = false, p = 1, tail = 0, stars = false, fall = 0, color = "#8E1C1A", seed = "rd" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const body = ink(color);
  const dark = tone(body, -0.4);
  const belly = ink("#D8844A");
  const line = "#E8C060";
  const O: Pt = [0, -118];
  const at = (q: Pt): Pt => [q[0] + O[0], q[1] + O[1]];
  const torso = tube(at([-150, 40]), at([-90, -6]), at([-10, 30]), at([62, -34]), (t) => lerp(52, 84, Math.sin(Math.PI * (0.25 + 0.6 * t))));
  const tsw = tail * 1;
  const tl = tube(at([-150, 40]), at([-250, 70 - tsw * 60]), at([-330, -40 - tsw * 160]), at([-260 + tsw * 40, -150 - tsw * 140]), (t) => lerp(34, 4, Math.pow(t, 0.8)));
  const tip = tl.C[tl.C.length - 1];
  const wing = (dx: number, dy: number, sc: number, c: string, key: string) => {
    const R = at([-20 + dx, -24 + dy]);
    const fl = Math.sin(f * 0.05) * 4;
    const El: Pt = [R[0] - 60 * sc, R[1] - 170 * sc - fl];
    const tipsP: Pt[] = [
      [R[0] - 190 * sc, R[1] - 240 * sc - fl * 1.5],
      [R[0] - 220 * sc, R[1] - 160 * sc - fl],
      [R[0] - 196 * sc, R[1] - 90 * sc],
      [R[0] - 140 * sc, R[1] - 50 * sc],
    ];
    let d = `M ${P(R)} L ${P(El)} L ${P(tipsP[0])}`;
    for (let i = 1; i < tipsP.length; i++) {
      const a = tipsP[i - 1];
      const b = tipsP[i];
      const m = mixPt(a, b, 0.5);
      const toR = [R[0] - m[0], R[1] - m[1]];
      d += ` Q ${f1(m[0] + toR[0] * 0.22)} ${f1(m[1] + toR[1] * 0.22)} ${P(b)}`;
    }
    d += ` Q ${f1((tipsP[3][0] + R[0]) / 2 + 10)} ${f1((tipsP[3][1] + R[1]) / 2 + 10)} ${P(R)} Z`;
    return (
      <g key={key}>
        <path d={d} fill={c} stroke={line} strokeWidth={1.4} strokeLinejoin="round" />
        {tipsP.map((q, i) => (
          <path key={i} d={`M ${P(El)} L ${P(q)}`} stroke={line} strokeWidth={i === 0 ? 2.2 : 1.4} opacity={0.85} />
        ))}
        <path d={`M ${P(R)} L ${P(El)}`} stroke={line} strokeWidth={2.6} />
      </g>
    );
  };
  const leg = (hx: number, hy: number, key: string, front: boolean) => {
    const H0 = at([hx, hy]);
    const F: Pt = [H0[0] + (front ? 30 : 8), -8];
    const K: Pt = [lerp(H0[0], F[0], 0.5) + (front ? -22 : 24), lerp(H0[1], F[1], 0.45)];
    const lg = tube(H0, mixPt(H0, K, 0.8), mixPt(K, F, 0.35), F, (t) => lerp(46, 18, Math.pow(t, 0.8)));
    return (
      <g key={key}>
        <path d={lg.d} fill={front ? body : dark} stroke={line} strokeWidth={1.3} strokeLinejoin="round" />
        <ellipse cx={F[0] + 6} cy={F[1] + 2} rx={16} ry={7} fill={front ? body : dark} stroke={line} strokeWidth={1.1} />
        {[-6, 4, 14].map((c) => (
          <path key={c} d={`M ${f1(F[0] + c + 4)} ${f1(F[1] + 4)} q 5 1 7 6`} stroke="#E8DCC0" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        ))}
      </g>
    );
  };
  const base = at([60, -40]);
  const heads = Array.from({ length: 7 }, (_, i) => {
    const a = (-128 + i * 19) * D2R;
    const R = 200 + (i % 2) * 26 - Math.abs(i - 3) * 6;
    const sw: Pt = [Math.sin(f * 0.035 + i * 1.1) * 7, Math.cos(f * 0.03 + i * 0.8) * 6];
    const H: Pt = [base[0] + Math.cos(a) * R + sw[0], base[1] + Math.sin(a) * R * 0.95 + sw[1]];
    const b0: Pt = [base[0] + (i - 3) * 5, base[1] + 4];
    const c1: Pt = [b0[0] + Math.cos(a) * R * 0.35 - 10, b0[1] + Math.sin(a) * R * 0.3 - 20];
    const c2: Pt = [H[0] - Math.cos(a) * R * 0.3, H[1] + 30];
    const nk = tube(b0, c1, c2, H, (t) => lerp(26, 15, t));
    const horns = i === 0 || i === 2 || i === 5 ? 2 : 1;
    return { nk, H, ang: lerp(-30, 10, i / 6), horns, i };
  });
  const fallR = fall * 70;
  return (
    <g transform={`translate(${f1(x)} ${f1(gy + fall * 700 * s)}) scale(${flip ? -s : s} ${s}) rotate(${f1(fallR)} 0 -150)`} opacity={Math.min(1, p * 1.3) * (1 - Math.max(0, fall - 0.7) / 0.3)}>
      <GlowS x={0} y={-200} r={420} squash={0.8} color="200,40,30" opacity={0.18} />
      {wing(30, -6, 0.86, dark, "w2")}
      {stars && tail > 0
        ? Array.from({ length: 12 }, (_, i) => {
            const t = mod(f * 0.012 + i / 12, 1);
            const sx = tip[0] - 40 + (random(`${seed}s${i}`) - 0.5) * 260 - t * 60;
            const sy = tip[1] + t * 520;
            return sparkle(sx, sy, 3, tail * (1 - t) * 0.9, `st${i}`);
          })
        : null}
      <path d={tl.d} fill={body} stroke={line} strokeWidth={1.4} strokeLinejoin="round" />
      <path d={`M ${P(tip)} l -16 -14 l 30 -6 l -4 26 Z`} fill={body} stroke={line} strokeWidth={1.3} transform={`rotate(${f1(tl.ang + 40)} ${f1(tip[0])} ${f1(tip[1])})`} />
      {leg(-110, 46, "hl", false)}
      {heads.map((h) => (
        <path key={`n${h.i}`} d={h.nk.d} fill={body} stroke={line} strokeWidth={1.3} strokeLinejoin="round" />
      ))}
      <path d={torso.d} fill={body} stroke={line} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={smooth(torso.C.filter((_, i) => i % 3 === 0).map((q) => [q[0], q[1] + 14] as Pt), false)} stroke={belly} strokeWidth={8} fill="none" opacity={0.7} strokeLinecap="round" />
      {torso.C.filter((_, i) => i % 2 === 0 && i > 2 && i < 24).map((q, i) => (
        <path key={`sc${i}`} d={`M ${f1(q[0] - 7)} ${f1(q[1] - 6)} q 7 7 14 0`} stroke={line} strokeWidth={0.9} fill="none" opacity={0.55} />
      ))}
      {leg(40, 10, "fl", true)}
      {wing(0, 0, 1, body, "w1")}
      {heads.map((h) => (
        <g key={`h${h.i}`} transform={`translate(${f1(h.H[0])} ${f1(h.H[1])}) rotate(${f1(h.ang)}) scale(1.05)`}>
          {beastHead(body, belly, line, h.horns, true, false, false, `bh${h.i}`)}
        </g>
      ))}
    </g>
  );
};

/**
 * The beast rising out of the sea (Revelation 13:1–2) as an emblem: a leopard's spotted body on a bear's heavy paws, seven
 * necks with maned lion-like heads, ten horns each with a small crown, faint dark marks for the names on its heads.
 * kind "scarlet" is the scarlet beast of 17:3 (no spots, marks along the body, no crowns), which carries `rider` (the woman:
 * a Person at x = 0, y = 0 with pose { sit: 1 }, anchor on its back at (-4, -86)). Band: feet at y = 0 facing right; body
 * top -132, heads to about -330, about 420 wide at s = 1. `rise` 0..1 lifts it out of the water: everything below y = 0
 * is hidden (place y on the sea's surface).
 */
export const SeaBeast: React.FC<Base & { kind?: "sea" | "scarlet"; rise?: number; p?: number; rider?: React.ReactNode; color?: string; seed?: string }> = ({ x, y, s = 1, flip = false, kind = "sea", rise = 1, p = 1, rider, color, seed = "sb" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const f = useCurrentFrame();
  const id = useUid("sb");
  if (p <= 0) return null;
  const scarlet = kind === "scarlet";
  const body = ink(color ?? (scarlet ? "#A01E26" : "#B08A4A"));
  const dark = tone(body, -0.45);
  const belly = scarlet ? tone(body, 0.2) : ink("#E0C890");
  const line = "#E8C060";
  const sink = (1 - rise) * 320;
  const bodyD = smooth([[-122, -116], [-60, -130], [10, -126], [70, -132], [100, -118], [106, -92], [92, -72], [40, -68], [-40, -70], [-100, -72], [-128, -92]] as Pt[], true, 0.5);
  const legs = [-100, -72, 48, 76].map((lx, i) => {
    const sw = Math.sin(f * 0.05 + i * 1.6) * 3;
    return (
      <g key={i}>
        <path d={`M ${lx - 15} -84 Q ${lx - 17 + sw} -40 ${lx - 13 + sw} -8 L ${lx + 13 + sw} -8 Q ${lx + 15 + sw} -40 ${lx + 15} -84 Z`} fill={i % 2 ? body : dark} stroke={line} strokeWidth={1.1} />
        <ellipse cx={lx + sw + 4} cy={-6} rx={18} ry={8} fill={i % 2 ? body : dark} stroke={line} strokeWidth={1.1} />
        {[-8, 0, 8].map((c) => (
          <path key={c} d={`M ${lx + sw + 10 + c * 0.6} -4 q 3 2 4 5`} stroke="#E8DCC0" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        ))}
      </g>
    );
  });
  const tail = tube([-124, -100], [-170, -90], [-190, -30], [-160 + Math.sin(f * 0.04) * 10, -20], (t) => lerp(12, 5, t));
  const base: Pt = [88, -118];
  const heads = Array.from({ length: 7 }, (_, i) => {
    const a = (-150 + i * 21) * D2R;
    const R = 150 + (i % 2) * 22 - Math.abs(i - 3) * 4;
    const sw: Pt = [Math.sin(f * 0.035 + i * 1.3) * 6, Math.cos(f * 0.032 + i) * 5];
    const H: Pt = [base[0] + Math.cos(a) * R * 0.8 + 30 + sw[0], base[1] + Math.sin(a) * R + sw[1]];
    const b0: Pt = [base[0] + (i - 3) * 4, base[1] + 6];
    const nk = tube(b0, [b0[0] + Math.cos(a) * 40, b0[1] - 50], [H[0] - 20, H[1] + 40], H, (t) => lerp(24, 16, t));
    const horns = i === 0 || i === 3 || i === 6 ? 2 : 1;
    return { nk, H, horns, i, ang: lerp(-20, 12, i / 6) };
  });
  const spots = scarlet
    ? []
    : Array.from({ length: 22 }, (_, i) => ({ x: range(`${seed}x${i}`, -110, 90), y: range(`${seed}y${i}`, -122, -80), r: range(`${seed}r${i}`, 3, 5.5) }));
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${flip ? -s : s} ${s})`} opacity={Math.min(1, p * 1.3)}>
      <defs>
        <clipPath id={id}>
          <rect x={-400} y={-900} width={900} height={900} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <g transform={`translate(0 ${f1(sink)})`}>
          <path d={tail.d} fill={body} stroke={line} strokeWidth={1.1} />
          {heads.map((h) => (
            <path key={`n${h.i}`} d={h.nk.d} fill={body} stroke={line} strokeWidth={1.2} strokeLinejoin="round" />
          ))}
          {legs[0]}
          {legs[2]}
          <path d={bodyD} fill={body} stroke={line} strokeWidth={1.5} />
          <path d="M -110 -78 Q 0 -66 96 -80" stroke={belly} strokeWidth={6} fill="none" opacity={0.55} strokeLinecap="round" />
          {spots.map((q, i) => (
            <g key={i}>
              <circle cx={q.x} cy={q.y} r={q.r} fill="none" stroke={tone(body, -0.55)} strokeWidth={1.8} strokeDasharray="3 2" />
              <circle cx={q.x} cy={q.y} r={q.r * 0.4} fill={tone(body, -0.3)} />
            </g>
          ))}
          {scarlet
            ? Array.from({ length: 10 }, (_, i) => (
                <path key={i} d={`M ${-100 + i * 20} ${-112 + (i % 2) * 14} l 4 -4 l 3 6 l 4 -5 l 3 4`} stroke="rgba(30,8,10,0.7)" strokeWidth={1.4} fill="none" />
              ))
            : null}
          {legs[1]}
          {legs[3]}
          {scarlet ? (
            <g>
              <path d="M -40 -130 Q -4 -138 34 -130 L 30 -104 Q -4 -98 -36 -104 Z" fill={ink("#4A1E5A")} stroke={line} strokeWidth={1.6} />
              <NoScale>
                <g transform="translate(-4 -86)">{rider}</g>
              </NoScale>
            </g>
          ) : null}
          {heads.map((h) => (
            <g key={`h${h.i}`} transform={`translate(${f1(h.H[0])} ${f1(h.H[1])}) rotate(${f1(h.ang)})`}>
              {beastHead(body, belly, line, h.horns, false, true, true, `bh${h.i}`)}
              {!scarlet ? Array.from({ length: h.horns }, (_, j) => <path key={j} d={crownPath(-24 - j * 7, -30, 9, 3, 6)} fill="#E8C060" stroke="#FFF0C0" strokeWidth={0.5} />) : null}
              <path d="M 2 -9 l 3 -3 l 2 4 l 3 -4" stroke="rgba(30,10,8,0.7)" strokeWidth={1.1} fill="none" />
            </g>
          ))}
        </g>
      </g>
      {rise < 1 && rise > 0 ? (
        <g>
          {[0, 1, 2].map((i) => {
            const t = mod(f * 0.03 + i / 3, 1);
            return <ellipse key={i} cx={0} cy={0} rx={160 + t * 160} ry={14 + t * 12} fill="none" stroke={`rgba(220,236,255,${(0.5 * (1 - t)).toFixed(3)})`} strokeWidth={2} />;
          })}
        </g>
      ) : null}
    </g>
  );
};

/**
 * The beast out of the earth (Revelation 13:11): two horns like a lamb, but it spoke like a dragon — a smoky grey lamb-
 * like beast with two small horns, amber eyes, a ridge of spines and a dragon's tail. Band: feet at y = 0 facing right;
 * back -110, horn tips about -170, about 260 long at s = 1. `speak` 0..1 opens its mouth with a red-gold breath; `fire`
 * 0..1 brings a column of fire down from the sky in front of it (13:13).
 */
export const EarthBeast: React.FC<Base & { speak?: number; fire?: number; p?: number }> = ({ x, y, s = 1, flip = false, speak = 0, fire = 0, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const id = useUid("eb");
  if (p <= 0) return null;
  const body = ink("#6E645A");
  const dark = tone(body, -0.35);
  const line = "rgba(232,192,96,0.8)";
  const tail = tube([-60, -84], [-110, -80], [-140, -20], [-112 + Math.sin(f * 0.05) * 8, -10], (t) => lerp(14, 3, t));
  const tipT = tail.C[tail.C.length - 1];
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${flip ? -s : s} ${s})`} opacity={Math.min(1, p * 1.3)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF0C0" stopOpacity={0.1} />
          <stop offset="0.7" stopColor="#FF9A40" stopOpacity={0.6} />
          <stop offset="1" stopColor="#FFE6A0" stopOpacity={0.95} />
        </linearGradient>
      </defs>
      {fire > 0 ? (
        <g style={{ mixBlendMode: "screen" }}>
          <path d={`M 196 -1000 L 244 -1000 L ${f1(256)} ${f1(-1000 + 1000 * fire)} L ${f1(184)} ${f1(-1000 + 1000 * fire)} Z`} fill={`url(#${id})`} />
          <GlowS x={220} y={-1000 + 1000 * fire} r={110} squash={0.5} color="255,170,80" opacity={0.8 * fire} />
        </g>
      ) : null}
      <ellipse cx={0} cy={0} rx={96} ry={6} fill="rgba(0,0,0,0.3)" />
      <path d={tail.d} fill={dark} stroke={line} strokeWidth={1} />
      <path d={`M ${P(tipT)} l -10 -12 l 22 0 Z`} fill={dark} />
      {[-40, 34].map((lx) => (
        <path key={lx} d={`M ${lx} -70 L ${lx - 2} -4`} stroke={dark} strokeWidth={10} strokeLinecap="round" />
      ))}
      <path d={woolPath(0, -82, 62, 30, 22, 4)} fill={body} stroke={rim(0.8)} strokeWidth={1.3} />
      {Array.from({ length: 9 }, (_, i) => {
        const xx = -50 + i * 11;
        const yy = -108 - Math.sin((i / 8) * Math.PI) * 6;
        return <path key={i} d={`M ${xx - 4} ${yy + 2} L ${xx} ${yy - 9} L ${xx + 4} ${yy + 2} Z`} fill={dark} stroke={line} strokeWidth={0.6} />;
      })}
      {[-48, 40].map((lx) => (
        <path key={lx} d={`M ${lx} -66 L ${lx + 2} -4`} stroke={body} strokeWidth={11} strokeLinecap="round" />
      ))}
      <path d="M 50 -96 Q 62 -122 76 -124 L 86 -110 Q 74 -96 62 -84 Z" fill={body} />
      <path d="M 66 -132 Q 76 -144 90 -138 Q 102 -132 104 -122 Q 104 -114 96 -112 Q 86 -110 76 -114 Q 64 -120 66 -132 Z" fill={body} stroke={rim(0.8)} strokeWidth={1.1} />
      {speak > 0 ? (
        <g>
          <path d={`M 96 -116 L 104 -112 L 96 ${-108 + speak * 6} Z`} fill="#2A0E0A" />
          <GlowS x={112} y={-112} r={30 + 30 * speak} color="255,120,50" opacity={0.7 * speak} />
          <path d={`M 104 -112 Q ${120 + 30 * speak} ${-118 + Math.sin(f * 0.4) * 3} ${130 + 50 * speak} -110`} stroke="rgba(255,150,60,0.7)" strokeWidth={4 * speak} fill="none" strokeLinecap="round" />
        </g>
      ) : null}
      <path d="M 74 -136 Q 70 -152 78 -160 Q 80 -150 80 -138 Z" fill="#E8DCC0" stroke={line} strokeWidth={0.8} />
      <path d="M 84 -136 Q 84 -154 92 -160 Q 92 -148 90 -134 Z" fill="#E8DCC0" stroke={line} strokeWidth={0.8} />
      <path d="M 72 -128 Q 62 -128 58 -120 Q 66 -120 72 -124 Z" fill={dark} />
      <circle cx={88} cy={-126} r={2.4} fill="#F2B040" />
    </g>
  );
};

// ── Millstone, chain, key, abyss ─────────────────────────────────────────────────────────

/**
 * The great millstone the mighty angel hurls into the sea (Revelation 18:21): a massive round stone (radius 110 at s = 1)
 * with a centre eye and dressing furrows, seen three-quarter. Plain: centred at (x, y); `rot` spins it (degrees); `splash`
 * 0..1 throws up a crown of water around (x, y + r), for the moment it strikes the sea; `glow` rims it with the angel's light.
 */
export const GreatMillstone: React.FC<{ x: number; y: number; s?: number; rot?: number; splash?: number; glow?: number; seed?: string }> = ({ x, y, s = 1, rot: r0 = 0, splash = 0, glow = 0.4, seed = "gm" }) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  const id = useUid("gm");
  const R = 110;
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${k})`}>
      <defs>
        <radialGradient id={id} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#B8B0A4" />
          <stop offset="0.7" stopColor="#7E766C" />
          <stop offset="1" stopColor="#4E4842" />
        </radialGradient>
      </defs>
      {glow > 0 ? <GlowS x={0} y={0} r={R * 1.8} color="255,236,200" opacity={0.35 * glow} /> : null}
      <g transform={`rotate(${f1(r0)})`}>
        <ellipse cx={8} cy={14} rx={R} ry={R * 0.96} fill="#3A3632" />
        <circle cx={0} cy={0} r={R} fill={`url(#${id})`} stroke={glow > 0 ? "rgba(255,236,200,0.7)" : "rgba(255,236,200,0.3)"} strokeWidth={2} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <path key={i} d={`M ${f1(Math.cos(a) * 26)} ${f1(Math.sin(a) * 26)} Q ${f1(Math.cos(a + 0.25) * 70)} ${f1(Math.sin(a + 0.25) * 70)} ${f1(Math.cos(a + 0.35) * (R - 8))} ${f1(Math.sin(a + 0.35) * (R - 8))}`} stroke="rgba(40,36,32,0.45)" strokeWidth={2.2} fill="none" />;
        })}
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={`g${i}`} cx={range(`${seed}x${i}`, -R * 0.7, R * 0.7)} cy={range(`${seed}y${i}`, -R * 0.7, R * 0.7)} r={range(`${seed}r${i}`, 1, 2.6)} fill={i % 2 ? "rgba(230,224,214,0.4)" : "rgba(30,28,26,0.35)"} />
        ))}
        <circle cx={0} cy={0} r={22} fill="#2A2622" stroke="rgba(200,190,176,0.5)" strokeWidth={2} />
        <rect x={-26} y={-5} width={52} height={10} rx={3} fill="#5A3E26" />
      </g>
      {splash > 0
        ? (
          <g>
            {Array.from({ length: 16 }, (_, i) => {
              const a = Math.PI + (i / 15) * Math.PI;
              const h = (60 + 90 * random(`${seed}sp${i}`)) * Math.sin(Math.PI * splash);
              const bx = Math.cos(a) * R * 1.05;
              return <path key={i} d={`M ${f1(bx)} ${R} Q ${f1(bx * 1.25)} ${f1(R - h * 0.8)} ${f1(bx * 1.5)} ${f1(R - h + h * splash * 0.6)}`} stroke="rgba(226,240,255,0.75)" strokeWidth={4 * (1 - splash) + 1.5} fill="none" strokeLinecap="round" />;
            })}
            {[0, 1].map((i) => (
              <ellipse key={i} cx={0} cy={R} rx={R * (1.1 + splash * (1.4 + i))} ry={18 * (1 + splash * (1 + i))} fill="none" stroke={`rgba(220,236,255,${(0.6 * (1 - splash)).toFixed(3)})`} strokeWidth={3} />
            ))}
          </g>
        )
        : null}
    </g>
  );
};

/**
 * A great chain (Revelation 20:1) along a smooth path through `pts` (plain units): interlocking links seen flat and edge-on
 * by turns. `link` is a link's length (default 22), `p` 0..1 how much of the path is chained (drawn from the first point),
 * `color` iron or gold.
 */
export const GreatChain: React.FC<{ pts: Pt[]; link?: number; p?: number; color?: string; glow?: number }> = ({ pts, link = 22, p = 1, color = "#8A7A5A", glow = 0.3 }) => {
  if (p <= 0 || pts.length < 2) return null;
  const dense: Pt[] = [];
  const n = pts.length;
  const at = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let j = 0; j < 16; j++) {
      const t = j / 16;
      const t2 = t * t;
      const t3 = t2 * t;
      dense.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  dense.push(pts[n - 1]);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[cum.length - 1] * p;
  const links: React.ReactNode[] = [];
  let j = 0;
  for (let d = link / 2, i = 0; d < total; d += link * 0.78, i++) {
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = (d - cum[j]) / Math.max(0.001, cum[j + 1] - cum[j]);
    const q = mixPt(dense[j], dense[j + 1], t);
    const a = Math.atan2(dense[j + 1][1] - dense[j][1], dense[j + 1][0] - dense[j][0]) / D2R;
    links.push(
      i % 2 ? (
        <g key={i} transform={`translate(${f1(q[0])} ${f1(q[1])}) rotate(${f1(a)})`}>
          <rect x={-link * 0.55} y={-2.4} width={link * 1.1} height={4.8} rx={2.4} fill={tone(color, -0.25)} stroke={tone(color, 0.35)} strokeWidth={0.8} />
        </g>
      ) : (
        <g key={i} transform={`translate(${f1(q[0])} ${f1(q[1])}) rotate(${f1(a)})`}>
          <ellipse cx={0} cy={0} rx={link * 0.56} ry={link * 0.3} fill="none" stroke={color} strokeWidth={link * 0.17} />
          <ellipse cx={0} cy={-link * 0.04} rx={link * 0.5} ry={link * 0.24} fill="none" stroke={tone(color, 0.45)} strokeWidth={link * 0.05} />
        </g>
      ),
    );
  }
  return (
    <g>
      {glow > 0 ? <path d={smooth(pts, false)} stroke={`rgba(255,226,160,${(0.18 * glow).toFixed(3)})`} strokeWidth={link * 1.4} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} /> : null}
      {links}
    </g>
  );
};

/** The key of the Abyss (Revelation 9:1; 20:1): a large ornate gold key. Plain: (x, y) is the centre of its bow; `ang` turns
 *  it (degrees, 0 points the shaft right); 130 long at s = 1. */
export const AbyssKey: React.FC<{ x: number; y: number; s?: number; ang?: number; glow?: number }> = ({ x, y, s = 1, ang = 0, glow = 0.7 }) => {
  const k = s * useBand().k;
  const id = useUid("ak");
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${k})`}>
      <defs>
        <GoldGrad id={id} vertical />
      </defs>
      {glow > 0 ? <GlowS x={50} y={0} r={110} squash={0.5} color="255,226,160" opacity={0.5 * glow} /> : null}
      {[0, 120, 240].map((a) => (
        <circle key={a} cx={Math.cos(a * D2R) * 9} cy={Math.sin(a * D2R) * 9} r={10} fill="none" stroke={`url(#${id})`} strokeWidth={5} />
      ))}
      <circle cx={0} cy={0} r={4} fill={GOLD_L} />
      <rect x={16} y={-4} width={104} height={8} rx={3} fill={`url(#${id})`} stroke={GOLD_L} strokeWidth={0.6} />
      <rect x={24} y={-7} width={6} height={14} rx={2} fill={GOLD} />
      <path d="M 96 4 L 96 22 L 104 22 L 104 14 L 110 14 L 110 22 L 120 22 L 120 4 Z" fill={`url(#${id})`} stroke={GOLD_L} strokeWidth={0.6} />
    </g>
  );
};

/**
 * The pit of the Abyss (Revelation 9:1–2; 20:1–3): a round shaft in the ground ringed with dressed stone, seen in perspective.
 * Band: rim centre on the ground at y = 0; rim 340 wide at s = 1. `open` 0..1 slides the round lid off to the right, `sealed`
 * 0..1 sets a red seal with a gold cord across the closed lid, `smoke` 0..1 lets dark smoke rise from the open pit, `glow`
 * a dull red light inside.
 */
export const AbyssPit: React.FC<Base & { open?: number; sealed?: number; smoke?: number; glow?: number; seed?: string }> = ({ x, y, s = 1, open = 0, sealed = 0, smoke = 0, glow = 0.4, seed = "ab" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const id = useUid("ab");
  const stone = ink("#6A625A");
  const lx = open * 330;
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`}>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor={`rgb(${Math.round(60 + 90 * glow)},20,12)`} />
          <stop offset="1" stopColor="#040306" />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={-20} rx={180} ry={56} fill={tone(stone, -0.2)} stroke={rim(0.8)} strokeWidth={1.3} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <line key={i} x1={Math.cos(a) * 140} y1={-20 + Math.sin(a) * 40} x2={Math.cos(a) * 180} y2={-20 + Math.sin(a) * 56} stroke="rgba(20,16,14,0.5)" strokeWidth={1.4} />;
      })}
      <ellipse cx={0} cy={-20} rx={140} ry={40} fill={`url(#${id})`} />
      {glow > 0 && open > 0 ? <GlowS x={0} y={-24} r={160} squash={0.35} color="160,40,20" opacity={0.5 * glow * open} /> : null}
      {smoke > 0 && open > 0 ? <Puffs x={0} y={-30} h={760} w={90} n={16} a={smoke * open * 0.9} color="40,34,36" spread={60} speed={0.005} wisps={false} seed={`${seed}sm`} /> : null}
      <path d="M -180 -20 L -180 0 Q 0 56 180 0 L 180 -20 Q 0 36 -180 -20 Z" fill={tone(stone, -0.35)} />
      <g transform={`translate(${f1(lx)} ${f1(-open * 6)})`}>
        <ellipse cx={0} cy={-26} rx={152} ry={44} fill={tone(stone, -0.3)} />
        <ellipse cx={0} cy={-34} rx={152} ry={44} fill={stone} stroke={rim(0.9)} strokeWidth={1.4} />
        <ellipse cx={0} cy={-34} rx={120} ry={33} fill="none" stroke={tone(stone, 0.2)} strokeWidth={2} />
        {sealed > 0 ? (
          <g opacity={sealed}>
            <path d="M -150 -40 Q 0 -10 150 -40" stroke="#E8C060" strokeWidth={3} fill="none" />
            <path d="M -60 -74 Q 0 -30 60 4" stroke="#E8C060" strokeWidth={3} fill="none" />
            <ellipse cx={0} cy={-34} rx={22} ry={12} fill="#9A1E1A" stroke="#E8C060" strokeWidth={1.4} />
            <path d="M -8 -34 L 8 -34 M 0 -40 L 0 -28" stroke="#E8C060" strokeWidth={1.6} />
            <GlowS x={0} y={-34} r={50} squash={0.6} color="255,214,140" opacity={0.5 * sealed} />
          </g>
        ) : null}
      </g>
    </g>
  );
};

// ── Judgment: the great white throne and the books ───────────────────────────────────────

/**
 * An open book with gold edges and glowing pages (Revelation 20:12). Plain: centred on its spine at (x, y); 150 wide, 70
 * tall at s = 1. `open` 0..1 opens the covers, `glow` lights the pages, `life` makes it the Book of Life (larger glow,
 * gold cover, a ribbon).
 */
export const BookOfLife: React.FC<{ x: number; y: number; s?: number; open?: number; glow?: number; life?: boolean; tilt?: number }> = ({ x, y, s = 1, open = 1, glow = 0.8, life = true, tilt = 0 }) => {
  const f = useCurrentFrame();
  const k = s * useBand().k;
  const a = open;
  const page = (d: number) => {
    const w = 72 * lerp(0.15, 1, a);
    const lift = (1 - a) * 30;
    return `M 0 0 Q ${d * w * 0.5} ${-8 - lift} ${d * w} ${-4 - lift * 1.4} L ${d * w} ${-64 - lift * 1.4} Q ${d * w * 0.5} ${-70 - lift} 0 -62 Z`;
  };
  const cover = life ? "#B8862F" : "#5A3A2A";
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${tilt}) scale(${k})`}>
      {glow > 0 ? <GlowS x={0} y={-34} r={life ? 170 : 110} squash={0.7} color="255,236,190" opacity={(life ? 0.75 : 0.45) * glow * (0.92 + 0.08 * Math.sin(f * 0.07))} /> : null}
      <path d="M -80 6 Q -40 -2 0 4 Q 40 -2 80 6 L 80 -2 Q 40 -10 0 -4 Q -40 -10 -80 -2 Z" fill={cover} stroke={life ? GOLD_L : "rgba(200,170,120,0.6)"} strokeWidth={1} />
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={page(d)} fill="#F8F0DC" stroke={life ? GOLD : "rgba(180,150,100,0.8)"} strokeWidth={1.2} />
          {a > 0.5
            ? Array.from({ length: 6 }, (_, i) => (
                <line key={i} x1={d * 10} y1={-52 + i * 8} x2={d * (10 + 50 - ((i * 13) % 17))} y2={-54 + i * 8} stroke={life ? "rgba(160,110,30,0.7)" : "rgba(90,70,50,0.6)"} strokeWidth={1.6} opacity={(a - 0.5) * 2} />
              ))
            : null}
        </g>
      ))}
      <line x1={0} y1={0} x2={0} y2={-62} stroke="rgba(160,120,60,0.6)" strokeWidth={1.2} />
      {life ? <path d="M 4 -4 L 4 20 L 8 14 L 12 22 L 12 -2" fill="#9A1E2A" opacity={0.9} /> : null}
    </g>
  );
};

/**
 * The great white throne (Revelation 20:11–12): a tall throne of white and silver-gold on broad white steps, the One seated
 * on it shown as brilliant white light, the books opened before it on stands and the Book of Life on a central lectern.
 * Band: base y = 0 (front of the lowest step); seat -170, back top -560, spans about ±330 with the books at s = 1. `glow`
 * light and rays, `books` 0..1 opens the books, `life` 0..1 lights the Book of Life.
 */
export const GreatWhiteThrone: React.FC<Base & { glow?: number; books?: number; life?: number; presence?: number }> = ({ x, y, s = 1, glow = 1, books = 1, life = 1, presence = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const f = useCurrentFrame();
  const id = useUid("gw");
  const lectern = (lx: number, ly: number, sc: number, key: string, isLife: boolean) => (
    <g key={key}>
      <path d={`M ${lx - 6 * sc} ${ly} L ${lx - 3 * sc} ${ly - 70 * sc} L ${lx + 3 * sc} ${ly - 70 * sc} L ${lx + 6 * sc} ${ly} Z`} fill="#D8D2C4" stroke="rgba(255,236,200,0.6)" strokeWidth={1} />
      <path d={`M ${lx - 34 * sc} ${ly - 70 * sc} L ${lx + 34 * sc} ${ly - 70 * sc} L ${lx + 30 * sc} ${ly - 80 * sc} L ${lx - 30 * sc} ${ly - 80 * sc} Z`} fill="#E8E2D6" />
      <NoScale>
        <BookOfLife x={lx} y={ly - 78 * sc} s={sc * 0.5} open={books} glow={isLife ? life : 0.5 * books} life={isLife} />
      </NoScale>
    </g>
  );
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C8C4BC" />
          <stop offset="0.35" stopColor="#FFFFFF" />
          <stop offset="0.7" stopColor="#ECEAE4" />
          <stop offset="1" stopColor="#B8B4AC" />
        </linearGradient>
      </defs>
      {glow > 0
        ? Array.from({ length: 36 }, (_, i) => {
            const a = (i / 36) * 360 + f * 0.05;
            const L = 900;
            const wd = 8 + 10 * random(`gwr${i}`);
            const e: Pt = [Math.cos(a * D2R) * L, -330 + Math.sin(a * D2R) * L];
            const nx = -Math.sin(a * D2R) * wd;
            const ny = Math.cos(a * D2R) * wd;
            return <path key={i} d={`M 0 -330 L ${f1(e[0] + nx)} ${f1(e[1] + ny)} L ${f1(e[0] - nx)} ${f1(e[1] - ny)} Z`} fill={`rgba(255,252,240,${(0.07 * glow * (0.6 + 0.4 * Math.sin(f * 0.03 + i))).toFixed(3)})`} />;
          })
        : null}
      <GlowS x={0} y={-330} r={620 * glow} squash={0.9} color="255,252,244" opacity={0.6 * glow} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={-300 + i * 30} y={-18 - i * 18} width={600 - i * 60} height={18} fill={i % 2 ? "#ECE8E0" : "#F8F6F2"} stroke="rgba(220,210,190,0.8)" strokeWidth={1} />
      ))}
      <path d="M -110 -170 L -110 -470 Q -110 -560 0 -572 Q 110 -560 110 -470 L 110 -170 Z" fill={`url(#${id})`} stroke="#E8DCC0" strokeWidth={1.6} />
      <path d="M -92 -172 L -92 -464 Q -92 -540 0 -552 Q 92 -540 92 -464 L 92 -172 Z" fill="rgba(255,255,255,0.65)" />
      {presence > 0 ? (
        <g opacity={presence}>
          <GlowS x={0} y={-330} r={260} squash={1.2} color="255,255,250" opacity={1} />
          <path d="M 0 -500 C 46 -460 56 -330 40 -176 L -40 -176 C -56 -330 -46 -460 0 -500 Z" fill="rgba(255,255,255,0.92)" />
        </g>
      ) : null}
      <path d="M -132 -170 L 132 -170 L 124 -96 L -124 -96 Z" fill="#F8F6F2" stroke="#E8DCC0" strokeWidth={1.4} />
      <rect x={-134} y={-178} width={268} height={10} rx={3} fill="#E8DCC0" />
      {[-1, 1].map((d) => (
        <g key={d}>
          <path d={`M ${d * 132} -96 L ${d * 132} -230 L ${d * 150} -236 L ${d * 152} -96 Z`} fill={`url(#${id})`} stroke="#E8DCC0" strokeWidth={1} />
          <circle cx={d * 142} cy={-242} r={10} fill="#FFFFFF" stroke="#E8DCC0" strokeWidth={1} />
        </g>
      ))}
      {books > 0 ? (
        <g opacity={Math.min(1, books * 1.5)}>
          {lectern(-300, 0, 1, "b1", false)}
          {lectern(-200, 4, 1.05, "b2", false)}
          {lectern(200, 4, 1.05, "b3", false)}
          {lectern(300, 0, 1, "b4", false)}
          {lectern(0, 30, 1.35, "life", true)}
        </g>
      ) : null}
    </g>
  );
};

// ── The new Jerusalem: gate, tree, river ─────────────────────────────────────────────────

/**
 * One of the twelve gates, each a single pearl (Revelation 21:12, 21): a massive arched gate of iridescent pearl standing in
 * a wall of jasper, its opening full of golden light (the gates are never shut), a tribe's name above it, an angel at the
 * gate. Band: base y = 0; opening 140 wide and 250 tall, pearl top -340, wall height 280 (`wall` = wall length each side),
 * at s = 1. `angel` "side" (standing at the gate, Person scale), "top" (on the arch) or null; `name` e.g. "JUDAH".
 */
export const PearlGate: React.FC<Base & { glow?: number; angel?: "side" | "top" | null; name?: string; wall?: number; p?: number }> = ({ x, y, s = 1, glow = 1, angel = "side", name, wall = 260, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const f = useCurrentFrame();
  const id = useUid("pg");
  if (p <= 0) return null;
  const sheen = Math.sin(f * 0.02) * 0.5 + 0.5;
  const arch = "M -70 0 L -70 -170 Q -70 -250 0 -256 Q 70 -250 70 -170 L 70 0 Z";
  const pearl = "M -138 0 L -138 -190 Q -138 -342 0 -350 Q 138 -342 138 -190 L 138 0 Z";
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${s})`} opacity={Math.min(1, p * 1.3)}>
      <defs>
        <radialGradient id={`${id}p`} cx={0.38 + 0.1 * sheen} cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor="#F4EEF2" />
          <stop offset="0.6" stopColor="#E2E4F2" />
          <stop offset="0.8" stopColor="#F2E2E6" />
          <stop offset="1" stopColor="#C8CCD8" />
        </radialGradient>
        <linearGradient id={`${id}j`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(214,246,226,0.85)" />
          <stop offset="1" stopColor="rgba(140,200,170,0.75)" />
        </linearGradient>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6D8" />
          <stop offset="1" stopColor="#F2C860" />
        </linearGradient>
      </defs>
      {wall > 0
        ? [-1, 1].map((d) => (
            <g key={d}>
              <rect x={d < 0 ? -130 - wall : 130} y={-280} width={wall} height={280} fill={`url(#${id}j)`} stroke="rgba(248,212,136,0.7)" strokeWidth={1.2} />
              {Array.from({ length: 7 }, (_, i) => (
                <line key={i} x1={d < 0 ? -130 - wall : 130} y1={-280 + i * 40} x2={d < 0 ? -130 : 130 + wall} y2={-280 + i * 40} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
              ))}
              {FOUNDATION_STONES.slice(0, 4).map((c, i) => (
                <rect key={c} x={d < 0 ? -130 - wall : 130} y={-14 * (i + 1)} width={wall} height={14} fill={c} opacity={0.85} />
              ))}
              <rect x={d < 0 ? -134 - wall : 130} y={-288} width={wall + 4} height={8} fill={GOLD} />
            </g>
          ))
        : null}
      {glow > 0 ? <GlowS x={0} y={-130} r={360} squash={0.9} color="255,236,190" opacity={0.5 * glow} /> : null}
      <path d={pearl} fill={`url(#${id}p)`} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
      <path d="M -120 -190 Q -120 -324 0 -332" stroke="rgba(190,210,255,0.5)" strokeWidth={6} fill="none" />
      <path d="M 120 -190 Q 120 -324 0 -332" stroke="rgba(255,200,220,0.45)" strokeWidth={6} fill="none" />
      <path d={arch} fill={`url(#${id}o)`} />
      <GlowS x={0} y={-110} r={140} squash={1.4} color="255,246,220" opacity={0.9 * glow} />
      <path d={arch} fill="none" stroke={GOLD} strokeWidth={3} />
      {name ? (
        <text x={0} y={-292} textAnchor="middle" fontFamily={fonts.display} fontSize={22} fontWeight={700} letterSpacing={4} fill="#B8862F">
          {name}
        </text>
      ) : null}
      {angel ? (
        <NoScale>
          {angel === "side" ? (
            <g>
              <GoldWings x={-176} y={-136} s={1} p={1} fill={0.25} />
              <Person x={-172} y={0} s={1} look={{ robe: "#F4EEDF", head: "hair", glow: 0.9, mantle: "#FFF6DE", sash: "#E8C060" }} pose={{ arm: [24, 30], head: 4 }} />
            </g>
          ) : (
            <g>
              <GoldWings x={0} y={-350 - 136 * 0.5} s={0.5} p={1} fill={0.25} />
              <Person x={0} y={-350} s={0.5} look={{ robe: "#F4EEDF", head: "hair", glow: 0.9, mantle: "#FFF6DE", sash: "#E8C060" }} pose={{ arm: [30, 30] }} />
            </g>
          )}
        </NoScale>
      ) : null}
    </g>
  );
};

/**
 * The tree of life (Revelation 22:2): a broad luminous tree bearing twelve kinds of fruit, its leaves for the healing of the
 * nations. Band: base y = 0; canopy about 360 wide, top -330 at s = 1. `grow` 0..1, `fruit` 0..1 ripens the twelve kinds
 * (one colour each), `leaves` 0..1 lets a few leaves drift down, `glow` gold light in the canopy.
 */
export const TreeOfLife: React.FC<Base & { grow?: number; fruit?: number; leaves?: number; glow?: number; seed?: string }> = ({ x, y, s = 1, flip = false, grow = 1, fruit = 1, leaves = 0.5, glow = 1, seed = "tl" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  if (grow <= 0) return null;
  const g = clamp1(grow);
  const leaf = ink("#3E7A44");
  const bark = ink("#6A4A30");
  const blobs = Array.from({ length: 22 }, (_, i) => {
    const a = random(`${seed}a${i}`) * Math.PI * 2;
    const rr = Math.sqrt(random(`${seed}r${i}`));
    return { x: Math.cos(a) * 150 * rr, y: -240 + Math.sin(a) * 74 * rr, r: range(`${seed}s${i}`, 30, 46) };
  });
  const sway = Math.sin(f * 0.02 + random(seed) * 6) * 2;
  const canopy = clamp1((g - 0.3) / 0.7);
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${(flip ? -1 : 1) * s * lerp(0.3, 1, g)} ${s * lerp(0.3, 1, g)})`}>
      {glow > 0 ? <GlowS x={0} y={-230} r={260} squash={0.7} color="255,230,170" opacity={0.35 * glow * canopy} /> : null}
      <ellipse cx={0} cy={0} rx={90} ry={8} fill="rgba(0,0,0,0.28)" />
      {[[-60, -230], [60, -236], [-90, -200], [94, -196], [4, -270]].map(([bx, by], i) => (
        <path key={i} d={`M ${i % 2 ? 6 : -6} -120 Q ${bx * 0.4} ${by + 30} ${bx + sway} ${by}`} stroke={bark} strokeWidth={10 - i} fill="none" strokeLinecap="round" />
      ))}
      <path d="M -20 0 Q -6 -60 -16 -120 Q -4 -150 4 -160 Q 14 -150 18 -120 Q 8 -60 22 0 Z" fill={bark} stroke={rim(0.7)} strokeWidth={1.3} />
      {canopy > 0 ? (
        <g transform={`translate(${sway} -240) scale(${canopy}) translate(0 240)`}>
          {blobs.map((b, i) => (
            <circle key={`s${i}`} cx={b.x + 5} cy={b.y + 8} r={b.r} fill={tone(leaf, -0.35)} />
          ))}
          {blobs.map((b, i) => (
            <circle key={`m${i}`} cx={b.x} cy={b.y} r={b.r} fill={leaf} />
          ))}
          {blobs.map((b, i) => (b.y < -238 ? <circle key={`h${i}`} cx={b.x - b.r * 0.25} cy={b.y - b.r * 0.3} r={b.r * 0.55} fill={tone(leaf, 0.18)} /> : null))}
          {blobs.map((b, i) => (b.y < -250 ? <path key={`r${i}`} d={`M ${f1(b.x - b.r * 0.8)} ${f1(b.y - b.r * 0.4)} A ${b.r} ${b.r} 0 0 1 ${f1(b.x + b.r * 0.7)} ${f1(b.y - b.r * 0.55)}`} stroke="rgba(255,226,150,0.7)" strokeWidth={1.6} fill="none" /> : null))}
          {fruit > 0
            ? blobs.map((b, i) => {
                const c = ink(LIFE_FRUIT[i % 12]);
                const a = clamp1(fruit * 12 - (i % 12)) ;
                return (
                  <g key={`f${i}`} opacity={a}>
                    <circle cx={b.x + b.r * 0.35} cy={b.y + b.r * 0.35} r={5.4} fill={c} stroke="rgba(255,240,210,0.7)" strokeWidth={0.8} />
                    <circle cx={b.x + b.r * 0.35 - 7} cy={b.y + b.r * 0.35 + 4} r={4.4} fill={c} />
                    <circle cx={b.x + b.r * 0.35 - 1.6} cy={b.y + b.r * 0.35 - 1.8} r={1.4} fill="rgba(255,255,255,0.75)" />
                  </g>
                );
              })
            : null}
        </g>
      ) : null}
      {leaves > 0
        ? Array.from({ length: 5 }, (_, i) => {
            const t = mod(f * 0.004 + i / 5, 1);
            const lx = range(`${seed}lx${i}`, -140, 140) + Math.sin(t * 9 + i) * 24;
            return <ellipse key={`lv${i}`} cx={lx} cy={-200 + t * 210} rx={5} ry={2.4} fill={tone(leaf, 0.25)} transform={`rotate(${f1(t * 400 + i * 60)} ${f1(lx)} ${f1(-200 + t * 210)})`} opacity={leaves * Math.sin(Math.PI * t)} />;
          })
        : null}
    </g>
  );
};

/**
 * The river of the water of life, bright as crystal (Revelation 22:1). Plain: a centreline through `pts` (from the source),
 * widening from `w0` to `w1`; `p` 0..1 runs it from the source, `glow` lights it, `banks` adds gold banks. Sparkles flow
 * downstream.
 */
export const RiverOfLife: React.FC<{ pts: Pt[]; w0?: number; w1?: number; p?: number; glow?: number; banks?: number; seed?: string }> = ({ pts, w0 = 10, w1 = 120, p = 1, glow = 1, banks = 0, seed = "rl" }) => {
  const f = useCurrentFrame();
  const id = useUid("rl");
  if (p <= 0 || pts.length < 2) return null;
  const n = 40;
  const C: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (pts.length - 1);
    const j = Math.min(pts.length - 2, Math.floor(t));
    const u = t - j;
    const p0 = pts[Math.max(0, j - 1)];
    const p1 = pts[j];
    const p2 = pts[j + 1];
    const p3 = pts[Math.min(pts.length - 1, j + 2)];
    const u2 = u * u;
    const u3 = u2 * u;
    C.push([
      0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
    ]);
  }
  const m = Math.max(2, Math.round(n * p));
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i <= m; i++) {
    const a = C[Math.max(0, i - 1)];
    const b = C[Math.min(n, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, Math.pow(i / n, 1.1)) / 2;
    L.push([C[i][0] - (dy / l) * w, C[i][1] + (dx / l) * w]);
    R.push([C[i][0] + (dy / l) * w, C[i][1] - (dx / l) * w]);
  }
  const d = polyline([...L, ...R.slice().reverse()], true);
  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={C[0][0]} y1={C[0][1]} x2={C[n][0]} y2={C[n][1]}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.4" stopColor="#D8F2FF" />
          <stop offset="1" stopColor="#8EC8E8" />
        </linearGradient>
      </defs>
      {glow > 0 ? <path d={d} fill="rgba(200,240,255,0.25)" stroke="rgba(200,240,255,0.22)" strokeWidth={w1 * 0.3} strokeLinejoin="round" /> : null}
      <path d={d} fill={`url(#${id})`} opacity={0.95} />
      {Array.from({ length: 36 }, (_, j) => {
        const t = mod(random(`${seed}t${j}`) + f * 0.004 * (0.6 + random(`${seed}s${j}`)), 1) * (m / n);
        const i = Math.min(m - 1, Math.floor(t * n));
        const c = C[i];
        const w = lerp(w0, w1, Math.pow(i / n, 1.1)) / 2;
        const off = (random(`${seed}o${j}`) - 0.5) * 1.5 * w;
        const ln = 4 + w * 0.3;
        return <line key={j} x1={c[0] + off - ln} y1={c[1]} x2={c[0] + off + ln} y2={c[1]} stroke="rgba(255,255,255,0.85)" strokeWidth={1.2 + w * 0.02} opacity={Math.sin(Math.PI * clamp1(t / Math.max(0.001, m / n)))} />;
      })}
      {banks > 0 ? (
        <>
          <GoldLine d={smooth(L, false)} p={banks} w={2.2} glow={0.6} />
          <GoldLine d={smooth(R, false)} p={banks} w={2.2} glow={0.6} />
        </>
      ) : null}
    </g>
  );
};

/**
 * A door standing open in heaven (Revelation 4:1). Plain: (x, y) is the bottom centre of the doorway, `w` × `h` its size; two
 * tall leaves of dark wood and gold swing outward as `open` goes 0 -> 1 and light pours through. Behind the opening draw
 * whatever lies beyond (children, clipped to the doorway).
 */
export const HeavenDoor: React.FC<{ x: number; y: number; w?: number; h?: number; open?: number; glow?: number; children?: React.ReactNode }> = ({ x, y, w = 360, h = 620, open = 1, glow = 1, children }) => {
  const f = useCurrentFrame();
  const id = useUid("hd");
  const hw = w / 2;
  const spring = h - hw;
  const archD = `M ${-hw} 0 L ${-hw} ${-spring} A ${hw} ${hw} 0 0 1 ${hw} ${-spring} L ${hw} 0 Z`;
  const lw = hw * Math.cos(open * 1.25);
  const leaf = (d: number) => {
    const x0 = d * hw;
    const x1 = d * (hw - lw);
    const bulge = d * Math.sin(open * 1.25) * 40;
    return `M ${f1(x0)} 0 L ${f1(x0)} ${f1(-h - 10)} L ${f1(x1 + bulge * 0.2)} ${f1(-h - 10)} L ${f1(x1 + bulge)} 0 Z`;
  };
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`}>
      <defs>
        <clipPath id={`${id}c`}>
          <path d={archD} />
        </clipPath>
        <radialGradient id={`${id}l`} cx="0.5" cy="0.55" r="0.65">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.4" stopColor="#FFF0C8" />
          <stop offset="1" stopColor="#E8B860" />
        </radialGradient>
      </defs>
      <GlowS x={0} y={-h * 0.5} r={Math.max(w, h) * (0.8 + 0.6 * open)} squash={1.2} color="255,226,170" opacity={(0.25 + 0.5 * open) * glow} />
      <g clipPath={`url(#${id}c)`}>
        <path d={archD} fill={`url(#${id}l)`} opacity={0.3 + 0.7 * open} />
        {children}
        {open < 1
          ? [-1, 1].map((d) => (
              <g key={d} opacity={1 - open * 0.8}>
                <path d={leaf(d)} fill="#2A1C14" stroke="#E8C060" strokeWidth={2} />
                <path d={`M ${f1(d * (hw - lw * 0.5))} ${f1(-h * 0.2)} L ${f1(d * (hw - lw * 0.5))} ${f1(-h * 0.75)}`} stroke="rgba(232,192,96,0.6)" strokeWidth={1.4} />
              </g>
            ))
          : null}
      </g>
      {open < 0.15 ? <line x1={0} y1={0} x2={0} y2={-h} stroke={`rgba(255,246,220,${(0.9 * (1 - open / 0.15)).toFixed(3)})`} strokeWidth={3 + 8 * open} /> : null}
      <path d={archD} fill="none" stroke={GOLD} strokeWidth={6} />
      <path d={archD} fill="none" stroke={GOLD_L} strokeWidth={1.6} transform="scale(1.04 1.02)" opacity={0.6} />
      {Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI + (i / 8) * Math.PI;
        return sparkle(Math.cos(a) * (hw + 16), -spring + Math.sin(a) * (hw + 16), 2.4, 0.7 * (0.6 + 0.4 * Math.sin(f * 0.1 + i)), i);
      })}
    </g>
  );
};

export { star5 as starPath5, sparkle as sparkleStar };
