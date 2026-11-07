import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Pt, lerp, mod, range, seg, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { GlowS, useUid } from "./Atmos";
import { Smoke } from "./Fx";
import { Look, Person } from "./Person";
import { NoScale, useBand, useInk, useRim } from "./Stage";

/**
 * Props for 1–2 Maccabees, Job, Baruch, Daniel and Jonah. Same conventions as Props.tsx and Props4.tsx: feet/base at
 * y = 0 (on the band's ground at x unless y is given), the band scale k applied automatically, up is negative.
 * Person scale (a man = 174 units) unless a comment says monumental (a man ≈ 40 units, like Army and FortCity).
 * Slots (`seat`, `rider`, `crew`, `inside`, `under`, `below`) are drawn inside the prop's scaled group with NoScale: give
 * them x/y relative to the anchor named in the comment (e.g. `<Person x={0} y={0} s={1} .../>`), and they take the
 * prop's scale. Heights below are local units at s = 1; multiply by s * K.<band> for screen pixels.
 */

type Base = { x: number; y?: number; s?: number; flip?: boolean };
const useBase = (x: number, y?: number) => {
  const band = useBand();
  return y ?? band.gy(x);
};
const D = Math.PI / 180;
const dirv = (deg: number): Pt => [Math.sin(deg * D), Math.cos(deg * D)];
const poly = (pts: Pt[]) => `${pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} Z`;
const mixPts = (a: Pt[], b: Pt[], t: number): Pt[] => a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);
const rotAbout = (p: Pt, c: Pt, deg: number): Pt => {
  const a = deg * D;
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
};

/** A filled band of width w0 -> w1 along a centreline (trunks, tails, stems, a serpent's body). */
const taper = (pts: Pt[], w0: number, w1: number, t = 0.5) => {
  const n = pts.length;
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const w = lerp(w0, w1, i / Math.max(1, n - 1)) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return smooth([...L, ...R.reverse()], true, t);
};

const flame = (fx: number, w: number, h: number, lean: number) => `M ${fx - w / 2} 0 Q ${fx - w * 0.45} ${-h * 0.6} ${fx + lean} ${-h} Q ${fx + w * 0.45} ${-h * 0.6} ${fx + w / 2} 0 Z`;

/** A row of n flickering flame tongues, base centred at (x, y), `w` wide and up to `h` tall, strength a 0..1. */
const flames = (f: number, seed: string, x: number, y: number, w: number, h: number, n: number, a: number, spread = 1) =>
  a <= 0.01 ? null : (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      {Array.from({ length: n }, (_, i) => {
        const ww = (w / n) * 1.3;
        const u = (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2);
        const fx = Math.sign(u) * Math.pow(Math.abs(u), 1 / spread) * (w / 2) * 0.9 + range(`${seed}o${i}`, -3, 3);
        const ph = random(`${seed}p${i}`) * 6;
        const hh = h * a * (0.6 + 0.4 * random(`${seed}h${i}`)) * (0.86 + 0.14 * Math.sin(f * 0.5 + ph) + 0.08 * Math.sin(f * 1.3 + ph));
        const lean = Math.sin(f * 0.3 + ph) * ww * 0.2;
        return (
          <g key={i}>
            <path d={flame(fx, ww, hh, lean)} fill="#FF6A18" opacity={0.9} />
            <path d={flame(fx, ww * 0.6, hh * 0.7, lean * 0.6)} fill="#FFB43C" />
            <path d={flame(fx, ww * 0.3, hh * 0.42, lean * 0.3)} fill="#FFF2C4" />
          </g>
        );
      })}
    </g>
  );

// ── Beasts of war and of wonder ──────────────────────────────────────────────────────────

const ELE_CREW = (i: number): Look => ({ robe: ["#7A2A22", "#5A2A44", "#7A4A22"][i % 3], head: "plume", armor: "#9A7A44", short: true, beard: i % 2 === 0, hold: "spear" });
const ELE_DRIVER: Look = { robe: "#D8CCB0", head: "turban", cap: "#E8DCC0", skin: "#4A3022", short: true };

/**
 * An Indian war elephant of the Seleucid army (1 Maccabees 6:34–37), facing right: a red caparison with gold fringe, a
 * bronze head plate with a crest, a wooden tower with hung shields on its back and its crew in it, and the "Indian" driver
 * on its neck. Person scale: shoulder at -262, tower top at -386, head top -282, about 330 long (rump -130 to trunk tip
 * +200). In a battle vista beside a monumental Army (size 40) use s ≈ 0.23. `walk` is a phase (walkPhase(f, 0.7));
 * `trunk` 0..1 raises the trunk; `crew` (Look[] of up to 3, null for none) stand in the tower; `driver` (null for none).
 */
export const WarElephant: React.FC<Base & { walk?: number; trunk?: number; tower?: boolean; crew?: Look[] | null; driver?: Look | null; cloth?: string; armor?: boolean; color?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  walk,
  trunk = 0,
  tower = true,
  crew,
  driver,
  cloth = "#7A2228",
  armor = true,
  color = "#6E6863",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const skin = ink(color);
  const walking = walk !== undefined;
  const ph = walk ?? 0;
  const bob = walking ? -Math.abs(Math.sin(ph)) * 4 : 0;
  const crewL = crew === undefined ? [ELE_CREW(0), ELE_CREW(1), ELE_CREW(2)] : crew ?? [];
  const drv = driver === undefined ? ELE_DRIVER : driver;
  const cl = ink(cloth);
  const gold = ink("#D8A840");
  const bronze = ink("#A8803E");
  const leg = (hx: number, off: number, c: string, key: string) => {
    const q = ph + off;
    const a = walking ? Math.sin(q) * 11 : 0;
    const lift = walking ? Math.max(0, -Math.cos(q)) * 12 : 0;
    const top = -126 + bob;
    const L = -lift - top;
    return (
      <g key={key} transform={`rotate(${a.toFixed(2)} ${hx} ${top.toFixed(1)})`}>
        <path d={`M ${hx - 27} ${top} Q ${hx - 31} ${top + L * 0.5} ${hx - 22} ${top + L - 8} Q ${hx} ${top + L + 1} ${hx + 23} ${top + L - 8} Q ${hx + 30} ${top + L * 0.45} ${hx + 26} ${top} Z`} fill={c} stroke={rim(0.5)} strokeWidth={1.2} />
        {[-12, 0, 12].map((o) => (
          <path key={o} d={`M ${hx + o - 5} ${top + L - 3} q 5 -5 10 0`} stroke={tone(c, 0.3)} strokeWidth={1.4} fill="none" />
        ))}
      </g>
    );
  };
  const body: Pt[] = [
    [-128, -170], [-114, -222], [-70, -252], [-10, -263], [40, -262], [80, -250], [102, -272], [130, -283], [156, -264], [167, -230], [160, -198],
    [138, -176], [112, -166], [96, -148], [80, -120], [40, -106], [-30, -102], [-90, -116], [-123, -138],
  ];
  const sway = Math.sin(f * 0.05) * (walking ? 7 : 4);
  const hang: Pt[] = [[156, -206], [172, -168], [178, -120], [176, -76], [180, -40], [194, -30]];
  const up: Pt[] = [[156, -212], [186, -236], [204, -272], [202, -312], [186, -328], [176, -312]];
  const tc = hang.map((pt, i) => [lerp(pt[0], up[i][0], trunk) + sway * (i / 5) * (1 - trunk), lerp(pt[1], up[i][1], trunk)] as Pt);
  const earA = Math.sin(f * 0.07) * 4;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={20} cy={0} rx={170} ry={9} fill="rgba(0,0,0,0.35)" />
      {leg(-70, 0, tone(skin, -0.42), "lb")}
      {leg(52, Math.PI * 0.5, tone(skin, -0.42), "lf")}
      {leg(-94, Math.PI, tone(skin, -0.08), "rb")}
      {leg(76, Math.PI * 1.5, tone(skin, -0.08), "rf")}
      <g transform={`translate(0 ${bob.toFixed(2)})`}>
        <path d={taper([[-124, -196], [-136, -168], [-142, -136], [-140, -112]], 8, 4)} fill={tone(skin, -0.2)} />
        <path d="M -146 -116 L -134 -116 L -138 -96 Z" fill={tone(skin, -0.45)} />
        <path d={smooth(body, true, 0.42)} fill={skin} stroke={rim(1)} strokeWidth={1.6} />
        <path d={smooth([[-110, -150], [-60, -120], [20, -114], [74, -128]], false)} stroke={tone(skin, -0.2)} strokeWidth={3} fill="none" opacity={0.6} />
        {[[-40, -150], [0, -146], [-80, -168]].map(([wx, wy], i) => (
          <path key={i} d={`M ${wx - 14} ${wy} q 14 6 28 0`} stroke={tone(skin, -0.22)} strokeWidth={1.2} fill="none" opacity={0.6} />
        ))}
        <path d="M 142 -184 Q 172 -174 200 -160 Q 174 -164 144 -172 Z" fill={ink("#ECE4D0")} stroke={rim(0.8)} strokeWidth={1} />
        <g transform={`rotate(${earA.toFixed(2)} 104 -246)`}>
          <path d={smooth([[106, -252], [80, -246], [66, -214], [74, -184], [96, -176], [112, -204]], true, 0.45)} fill={tone(skin, -0.1)} stroke={rim(0.8)} strokeWidth={1.2} />
          <path d={smooth([[100, -240], [82, -232], [78, -206], [90, -190]], false)} stroke={tone(skin, -0.28)} strokeWidth={1.4} fill="none" />
        </g>
        <ellipse cx={140} cy={-238} rx={4.2} ry={3} fill={ink("#1A120E")} />
        <path d="M 133 -242 Q 140 -246 147 -241" stroke={tone(skin, -0.35)} strokeWidth={1.4} fill="none" />
        {armor ? (
          <>
            <path d={smooth([[-114, -204], [-98, -238], [-40, -260], [30, -263], [70, -252], [76, -212], [68, -164], [20, -154], [-40, -152], [-96, -160], [-116, -174]], true, 0.4)} fill={cl} stroke={rim(0.9)} strokeWidth={1.3} />
            <path d={smooth([[-96, -160], [-40, -152], [20, -154], [68, -164]], false)} stroke={gold} strokeWidth={4} fill="none" />
            {Array.from({ length: 16 }, (_, i) => {
              const t = i / 15;
              const xx = lerp(-94, 66, t);
              const yy = lerp(-158, -162, t) + 6 * Math.sin(t * Math.PI);
              return <line key={i} x1={xx} y1={yy} x2={xx + 1} y2={yy + 12} stroke={gold} strokeWidth={2} strokeLinecap="round" />;
            })}
            <path d={smooth([[-104, -206], [-90, -232], [-40, -252], [28, -255], [64, -246]], false)} stroke={gold} strokeWidth={2} fill="none" opacity={0.8} />
            <circle cx={-20} cy={-200} r={16} fill="none" stroke={gold} strokeWidth={2.4} />
            <circle cx={-20} cy={-200} r={5} fill={gold} />
            <path d={smooth([[112, -276], [146, -272], [160, -240], [150, -214], [124, -226], [108, -252]], true, 0.4)} fill={bronze} stroke={rim(0.9)} strokeWidth={1.2} />
            {[[124, -262], [142, -258], [150, -236], [132, -238]].map(([rx, ry], i) => (
              <circle key={i} cx={rx} cy={ry} r={2.4} fill={tone(bronze, 0.35)} />
            ))}
          </>
        ) : null}
        {tower ? (
          <>
            <path d="M -74 -256 Q -84 -180 -66 -108" stroke={ink("#5A4430")} strokeWidth={4} fill="none" />
            <path d="M 24 -258 Q 34 -180 20 -106" stroke={ink("#5A4430")} strokeWidth={4} fill="none" />
            <NoScale>
              {crewL.slice(0, 3).map((lk, i) => (
                <Person key={i} x={-52 + i * 30} y={-258} s={1} look={lk} pose={{ arm: [30, 40], arm2: [10, 20] }} shadow={false} />
              ))}
            </NoScale>
            <rect x={-82} y={-372} width={112} height={116} fill={ink("#6A4A2E")} stroke={rim(1)} strokeWidth={1.4} />
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1={-82} y1={-350 + i * 26} x2={30} y2={-350 + i * 26} stroke={ink("#4A3220")} strokeWidth={1.3} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <rect key={`m${i}`} x={-82 + i * 31} y={-386} width={19} height={15} fill={ink("#6A4A2E")} stroke={rim(0.8)} strokeWidth={1} />
            ))}
            <rect x={-86} y={-262} width={120} height={8} fill={ink("#4A3220")} />
            {[-58, -26, 6].map((sx) => (
              <g key={sx}>
                <circle cx={sx} cy={-312} r={15} fill={bronze} stroke={rim(0.8)} strokeWidth={1.1} />
                <circle cx={sx} cy={-312} r={4.5} fill={tone(bronze, 0.35)} />
              </g>
            ))}
          </>
        ) : null}
        {drv ? (
          <NoScale>
            <Person x={64} y={-196} s={1} look={drv} pose={{ sit: 0.55, arm: [70, 40], arm2: [40, 30] }} shadow={false} />
          </NoScale>
        ) : null}
        <path d={taper(tc, 36, 12)} fill={skin} stroke={rim(0.8)} strokeWidth={1.2} />
        {tc.slice(1, 5).map((p, i) => (
          <path key={i} d={`M ${p[0] - 12} ${p[1]} q 12 5 24 0`} stroke={tone(skin, -0.25)} strokeWidth={1.2} fill="none" />
        ))}
      </g>
    </g>
  );
};

const HORSE: Pt[] = [
  [-84, -136], [-62, -147], [-20, -140], [28, -142], [48, -153], [68, -178], [88, -204], [98, -217], [107, -215], [127, -192], [145, -170], [150, -159],
  [143, -151], [125, -156], [112, -166], [103, -172], [92, -148], [80, -120], [70, -97], [40, -88], [0, -86], [-40, -90], [-62, -95], [-84, -105], [-92, -122],
];

/**
 * A horse at Person scale (withers at -153, head top -230, nose +150, rump -92), facing right, with an optional rider
 * (a Person at x = 0, y = 0 with pose sit ≈ 0.55 sits on the saddle and takes the horse's scale and rotation).
 * gait: "stand" | "walk" | "gallop" with `phase` (walkPhase(f, 1.2) for a walk, (f, 2.4) for a gallop); `rear` 0..1
 * rears it up on its hind legs, forefeet striking (2 Maccabees 3:25); `glory` 0..1 turns it into the golden horse of
 * heaven with a fiery mane and a glow (pair with a glowing rider). `cloth` is the saddle cloth colour.
 */
export const Steed: React.FC<Base & { gait?: "stand" | "walk" | "gallop"; phase?: number; rear?: number; glory?: number; color?: string; cloth?: string; rider?: React.ReactNode; reins?: boolean }> = ({
  x,
  y,
  s = 1,
  flip = false,
  gait = "stand",
  phase,
  rear = 0,
  glory = 0,
  color = "#5A3E2A",
  cloth = "#7A2228",
  rider,
  reins = true,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const gid = useUid("std");
  const ph = phase ?? (gait === "gallop" ? f * 0.5 : f * 0.24);
  const moving = gait !== "stand" && rear < 0.5;
  const amp = gait === "gallop" ? 30 : 18;
  const g = Math.min(1, glory);
  const coat = g > 0 ? mixHex(ink(color), "#F2D486", g) : ink(color);
  const fill = g > 0.3 ? `url(#${gid})` : coat;
  const dark = tone(coat, -0.32);
  const bob = moving ? -Math.abs(Math.sin(ph)) * (gait === "gallop" ? 7 : 2.5) : 0;
  const pitch = moving && gait === "gallop" ? Math.sin(ph) * 3 : 0;
  const leg = (hip: Pt, l: [number, number, number], ang: [number, number, number], c: string, key: string) => {
    const p1: Pt = [hip[0] + dirv(ang[0])[0] * l[0], hip[1] + dirv(ang[0])[1] * l[0]];
    const p2: Pt = [p1[0] + dirv(ang[1])[0] * l[1], p1[1] + dirv(ang[1])[1] * l[1]];
    const p3: Pt = [p2[0] + dirv(ang[2])[0] * l[2], p2[1] + dirv(ang[2])[1] * l[2]];
    const hv = dirv(ang[2]);
    return (
      <g key={key}>
        <path d={taper([hip, p1, p2, p3], 24, 9, 0.3)} fill={c} stroke={rim(0.6)} strokeWidth={1} />
        <path d={poly([[p3[0] - hv[1] * 6 - hv[0] * 2, p3[1] + hv[0] * 6 - 2], [p3[0] + hv[1] * 7, p3[1] - hv[0] * 7 - 2], [p3[0] + hv[1] * 8 + hv[0] * 7, p3[1] - hv[0] * 8 + hv[1] * 7], [p3[0] - hv[1] * 6 + hv[0] * 6, p3[1] + hv[0] * 6 + hv[1] * 6]])} fill={g > 0 ? "#FFF0C0" : ink("#1A120C")} />
      </g>
    );
  };
  const front = (o: number): [number, number, number] => {
    const far = o > 0.1;
    if (rear > 0) return [lerp(far ? -4 : 5, far ? 52 : 70, rear) + Math.sin(f * 0.3 + o) * 8 * rear, lerp(0, far ? -60 : -40, rear), lerp(14, -66, rear)];
    if (!moving) return far ? [-4, -2, 14] : [5, 0, 14];
    const q = ph + o;
    const fold = Math.max(0, Math.cos(q));
    const a1 = 4 + amp * Math.sin(q);
    return [a1, a1 - 70 * fold, a1 - 70 * fold + 20 + 30 * fold];
  };
  const hind = (o: number): [number, number, number] => {
    const far = o > Math.PI * 1.2;
    if (rear > 0) return [lerp(far ? -6 : -14, -46, rear), lerp(far ? 8 : 6, -30, rear), lerp(14, -14, rear)];
    if (!moving) return far ? [-6, 8, 14] : [-14, 6, 14];
    const q = ph + o;
    const fold = Math.max(0, Math.cos(q));
    const a1 = -12 + amp * 0.8 * Math.sin(q);
    return [a1, a1 + 18 - 50 * fold, a1 + 38 - 20 * fold];
  };
  const tailSw = Math.sin(f * 0.08) * 6 + (moving ? (gait === "gallop" ? -24 : -6) : 0);
  const tail: Pt[] = [[-84, -136], [-102, -128 + tailSw * 0.3], [-114 + tailSw * 0.4, -104 + tailSw], [-114 + tailSw, -76 + tailSw * 1.2], [-108 + tailSw * 1.5, -54 + tailSw * 1.3]];
  const mane = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const bx = lerp(98, 46, t);
    const byy = lerp(-216, -152, t);
    const wv = Math.sin(f * (moving ? 0.3 : 0.08) + i * 0.8) * (moving ? 6 : 2);
    const len = (g > 0 ? 34 : 24) + 6 * Math.sin(i * 1.7);
    const e: Pt = g > 0 ? [bx - len * 1.0 + wv, byy - len * 0.32 + wv * 0.4] : [bx - len * 0.42 + wv, byy + len * 0.88];
    return { b: [bx, byy] as Pt, e, c: [(bx + e[0]) / 2 - 7, (byy + e[1]) / 2 - 3] as Pt };
  });
  const saddle: Pt = [8, -146];
  const pivot: Pt = [-69, 0];
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="-230" x2="0" y2="-80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF8DC" />
          <stop offset="0.5" stopColor="#F2C860" />
          <stop offset="1" stopColor="#C8862A" />
        </linearGradient>
      </defs>
      <ellipse cx={0} cy={0} rx={rear > 0 ? 90 : 120} ry={7} fill="rgba(0,0,0,0.35)" />
      {g > 0 ? <GlowS x={20} y={-140} r={320} squash={0.7} color="255,214,140" opacity={0.65 * g} /> : null}
      <g transform={`rotate(${(-36 * rear + pitch).toFixed(2)} ${pivot[0]} ${pivot[1]}) translate(0 ${bob.toFixed(2)})`}>
        {leg([56, -97], [44, 40, 14], front(Math.PI * 0.5), tone(coat, -0.4), "ff")}
        {leg([-62, -102], [52, 38, 14], hind(Math.PI * 1.5), tone(coat, -0.4), "hf")}
        <path d={taper(tail, 16, 5, 0.5)} fill={g > 0 ? "#FFB040" : ink("#1E140E")} opacity={0.95} />
        {g > 0 ? <path d={taper(tail.map((p) => [p[0] + 3, p[1]] as Pt), 8, 2, 0.5)} fill="#FFF0C0" opacity={0.8 * g} /> : null}
        <path d={smooth(HORSE, true, 0.42)} fill={fill} stroke={g > 0 ? "rgba(255,246,214,0.95)" : rim(1)} strokeWidth={1.5} />
        <path d={smooth([[-70, -128], [-40, -132], [10, -128], [44, -138]], false)} stroke={tone(coat, 0.14)} strokeWidth={2} fill="none" opacity={0.5} />
        <path d={smooth([[60, -150], [84, -176], [100, -196]], false)} stroke={tone(coat, -0.18)} strokeWidth={2} fill="none" opacity={0.5} />
        <path d="M 99 -214 L 96 -236 L 106 -218 Z" fill={tone(coat, -0.1)} stroke={rim(0.7)} strokeWidth={0.9} />
        <ellipse cx={119} cy={-195} rx={3.4} ry={2.6} fill={g > 0 ? "#FFFFFF" : ink("#0E0A08")} />
        <ellipse cx={144} cy={-163} rx={2.4} ry={1.6} fill={tone(coat, -0.45)} />
        {mane.map((m, i) => (
          <path key={i} d={`M ${m.b[0]} ${m.b[1]} Q ${m.c[0]} ${m.c[1]} ${m.e[0]} ${m.e[1]}`} stroke={g > 0 ? (i % 2 ? "#FF9A3A" : "#FFD27A") : ink("#1A120C")} strokeWidth={g > 0 ? 5 : 4.4} strokeLinecap="round" fill="none" />
        ))}
        {g <= 0.5 ? (
          <>
            <path d="M 112 -205 L 124 -168 M 122 -170 L 146 -166" stroke={ink("#2A1A10")} strokeWidth={2.2} fill="none" />
            {reins && rider ? <path d="M 126 -166 Q 80 -150 36 -168" stroke={ink("#2A1A10")} strokeWidth={1.6} fill="none" /> : null}
            <path d={poly([[-26, -144], [40, -147], [36, -108], [-22, -106]])} fill={ink(cloth)} stroke={rim(0.7)} strokeWidth={1} />
            <path d="M -22 -108 L 36 -110" stroke={ink("#D8A840")} strokeWidth={2.4} />
          </>
        ) : (
          <path d={poly([[-26, -144], [40, -147], [36, -108], [-22, -106]])} fill="#FFE6A0" stroke="rgba(255,250,230,0.9)" strokeWidth={1} opacity={0.9} />
        )}
        {rider ? (
          <NoScale>
            <g transform={`translate(${saddle[0] + 3.3} ${saddle[1] + 60.9})`}>{rider}</g>
          </NoScale>
        ) : null}
        {leg([66, -98], [44, 40, 14], front(0), tone(coat, -0.05), "fn")}
        {leg([-70, -104], [52, 38, 14], hind(Math.PI), tone(coat, -0.05), "hn")}
        {g > 0
          ? Array.from({ length: 10 }, (_, i) => {
              const t = mod(f * 0.012 + random(`stg${i}`), 1);
              return <circle key={`sp${i}`} cx={range(`stx${i}`, -90, 140)} cy={-60 - t * 180} r={1.6 + random(`str${i}`) * 1.6} fill="#FFF6D8" opacity={g * Math.sin(Math.PI * t)} />;
            })
          : null}
      </g>
    </g>
  );
};

/**
 * A lion at Person scale, facing right: about 230 long (tail tip -150 to nose +125), shoulder at -104 standing, mane
 * top -166 (sitting: head at -146, mane top -196; lying: back at -63). Mouth always closed (Daniel 6:22). pose: "stand" | "walk" (with `phase`) | "lie" (couched, head up) |
 * "sleep" (head down on its paws, eyes shut) | "sit"; `mane` false draws a lioness; `head` turns the head (degrees,
 * positive = down); `color` for a gold statue lion (throne lions).
 */
export const DenLion: React.FC<Base & { pose?: "stand" | "walk" | "lie" | "sleep" | "sit"; phase?: number; mane?: boolean; head?: number; color?: string; seed?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  pose = "stand",
  phase,
  mane = true,
  head = 0,
  color = "#B88A4C",
  seed = "dl",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const c = ink(color);
  const dk = tone(c, -0.3);
  const mc = ink(mixHex(color, "#3A2410", 0.55));
  const lying = pose === "lie" || pose === "sleep";
  const sitting = pose === "sit";
  const walking = pose === "walk";
  const ph = phase ?? f * 0.2;
  const low = lying ? 44 : 0;
  const breathe = Math.sin(f * 0.06 + random(seed) * 6) * (lying ? 1.5 : 0.8);
  const tilt = 0;
  const bodyPts: Pt[] = [
    [-104, -86], [-84, -100], [-30, -96], [30, -100], [58, -112], [74, -96], [70, -66], [52, -56], [0, -52 - breathe], [-60, -54], [-96, -60], [-110, -72],
  ];
  const body = bodyPts.map((p) => [p[0], p[1] + low * (p[1] < -80 ? 0.85 : 0.95)] as Pt);
  const headC: Pt = sitting ? [62, -146] : [88, -110 + low * 0.7 + (pose === "sleep" ? 34 : 0)];
  const hRot = head + (pose === "sleep" ? 18 : 0);
  const leg = (hx: number, hy: number, a: number, w: number, col: string, key: string) => {
    const L1 = 32;
    const L2 = 30;
    const k1: Pt = [hx + Math.sin(a * D) * L1, hy + Math.cos(a * D) * L1];
    const ft: Pt = [k1[0] + Math.sin(a * 0.3 * D) * 4, 0];
    return (
      <g key={key}>
        <path d={taper([[hx, hy], k1, [ft[0], -8], ft], w, w * 0.62, 0.4)} fill={col} stroke={rim(0.5)} strokeWidth={1} />
        <ellipse cx={ft[0] + 6} cy={-4} rx={10} ry={5} fill={col} />
      </g>
    );
  };
  const standLegs = (back: boolean) => {
    const sw = walking ? Math.sin(ph) * 20 : 0;
    const col = back ? tone(c, -0.38) : tone(c, -0.05);
    return back ? [leg(-78, -64, -sw, 22, col, "hb"), leg(46, -62, sw, 20, col, "fb")] : [leg(-62, -62, sw, 24, col, "hn"), leg(58, -60, -sw, 21, col, "fn")];
  };
  const tailSw = Math.sin(f * 0.05 + random(`${seed}t`) * 6) * 10;
  const tail: Pt[] = lying
    ? [[-104, -40], [-126, -30], [-146, -18], [-160 + tailSw * 0.4, -10], [-170 + tailSw * 0.5, -8]]
    : [[-106, -84], [-130, -74], [-142, -48 + tailSw * 0.3], [-136 + tailSw * 0.5, -24], [-148 + tailSw, -18]];
  const maneRing = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const rr = (i % 2 ? 40 : 50) + 4 * Math.sin(i * 2.3);
    return [Math.cos(a) * rr * 0.9 - 8, Math.sin(a) * rr + 6] as Pt;
  });
  const eyeOpen = pose !== "sleep";
  const headEl = (
    <g transform={`translate(${headC[0]} ${headC[1]}) rotate(${hRot})`}>
      {mane ? <path d={smooth(maneRing, true, 0.5)} fill={mc} stroke={rim(0.8)} strokeWidth={1.2} /> : null}
      <path d={smooth([[-14, -26], [10, -30], [30, -20], [44, -4], [42, 10], [26, 18], [4, 20], [-14, 12], [-20, -8]], true, 0.45)} fill={c} stroke={rim(0.9)} strokeWidth={1.2} />
      <path d="M -6 -26 L -2 -38 L 8 -28 Z" fill={dk} />
      <path d={smooth([[30, -4], [44, -2], [46, 8], [36, 12]], false)} stroke={dk} strokeWidth={1.4} fill="none" />
      <ellipse cx={45} cy={-3} rx={4} ry={3} fill={ink("#2A1A12")} />
      <path d="M 26 12 Q 34 16 42 10" stroke={ink("#3A2414")} strokeWidth={1.4} fill="none" />
      {eyeOpen ? (
        <>
          <ellipse cx={22} cy={-12} rx={3.4} ry={2.4} fill={ink("#E8C060")} />
          <circle cx={23} cy={-12} r={1.4} fill="#120C08" />
          <path d="M 17 -15 Q 22 -17 27 -14" stroke={dk} strokeWidth={1.4} fill="none" />
        </>
      ) : (
        <path d="M 17 -12 Q 22 -9 27 -12" stroke={dk} strokeWidth={1.6} fill="none" />
      )}
    </g>
  );
  if (sitting) {
    const sTail: Pt[] = [[-60, -8], [-92, -6], [-114, -12], [-122 + tailSw * 0.3, -24], [-118 + tailSw * 0.4, -34]];
    return (
      <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
        <ellipse cx={-6} cy={0} rx={90} ry={6} fill="rgba(0,0,0,0.32)" />
        <path d={taper(sTail, 9, 4)} fill={c} />
        <path d={`M ${sTail[4][0] - 6} ${sTail[4][1] - 4} q -6 -6 2 -12 q 8 2 8 10 Z`} fill={mc} />
        <path d={taper([[30, -82], [34, -40], [36, -6]], 22, 15)} fill={tone(c, -0.32)} />
        <path d={smooth([[-78, -24], [-82, -62], [-56, -92], [-10, -112], [30, -128], [56, -112], [58, -76], [52, -44], [20, -30], [-20, -14], [-64, -6]], true, 0.45)} fill={c} stroke={rim(1)} strokeWidth={1.4} />
        <path d={smooth([[-74, -58], [-40, -76], [-8, -64], [-2, -30], [-30, -14], [-66, -14]], true, 0.5)} fill={tone(c, -0.1)} stroke={rim(0.6)} strokeWidth={1} />
        <ellipse cx={-14} cy={-6} rx={22} ry={7} fill={tone(c, -0.1)} />
        {headEl}
        <path d={taper([[44, -82], [48, -40], [50, -6]], 22, 15)} fill={tone(c, -0.02)} stroke={rim(0.6)} strokeWidth={1} />
        <ellipse cx={56} cy={-5} rx={11} ry={6} fill={tone(c, -0.02)} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={-10} cy={0} rx={lying ? 130 : 110} ry={6} fill="rgba(0,0,0,0.32)" />
      <g transform={`rotate(${tilt} -90 0)`}>
        {!lying && !sitting ? standLegs(true) : null}
        <path d={taper(tail, 9, 4)} fill={c} />
        <path d={`M ${tail[4][0] - 8} ${tail[4][1] - 4} q -6 6 0 12 q 8 -2 10 -10 Z`} fill={mc} />
        {lying ? <ellipse cx={-70} cy={-28} rx={40} ry={26} fill={tone(c, -0.12)} stroke={rim(0.6)} strokeWidth={1} /> : null}
        <path d={smooth(body, true, 0.45)} fill={c} stroke={rim(1)} strokeWidth={1.4} />
        {lying ? (
          <>
            <path d={taper([[46, -28], [80, -12], [118, -8]], 22, 16)} fill={tone(c, -0.05)} stroke={rim(0.6)} strokeWidth={1} />
            <ellipse cx={122} cy={-8} rx={12} ry={7} fill={tone(c, -0.05)} />
            <ellipse cx={-36} cy={-8} rx={22} ry={8} fill={tone(c, -0.1)} />
          </>
        ) : null}
        {headEl}
        {!lying ? standLegs(false) : null}
      </g>
    </g>
  );
};

/**
 * The great fish (Jonah 1:17, 2:10), restrained: a huge, calm blue-grey fish with a kind eye, facing right. Person scale,
 * default len 900 (centre at the anchor; body from -450 to +450, back at -160, belly at +130). `mouth` 0..1 opens the
 * lower jaw (a dark mouth, no teeth); `spit` 0..1 pours a gush of water from the mouth; `belly` 0..1 opens a warm cutaway
 * window in its side where `inside` is drawn (a Person at x = 0, y = 0 stands on the window floor, 70 below the centre);
 * `tilt` rotates it (degrees). Put it in a water band's children so the part below the surface is hidden.
 */
export const GreatFish: React.FC<Base & { len?: number; mouth?: number; spit?: number; belly?: number; inside?: React.ReactNode; tilt?: number; color?: string; swim?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  len = 900,
  mouth = 0,
  spit = 0,
  belly = 0,
  inside,
  tilt = 0,
  color = "#2E4A5A",
  swim,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const clip = useUid("gfc");
  const bg = useUid("gfb");
  const L = len / 2;
  const c = ink(color);
  const bellyC = ink(mixHex(color, "#D8E0DC", 0.62));
  const P = (u: number, v: number): Pt => [u * L, v * L];
  const sw = swim ?? f * 0.06;
  const tailA = Math.sin(sw) * 8;
  const finA = Math.sin(sw * 1.3 + 1) * 10;
  const main = [P(0.62, 0.05), P(1.0, 0.0), P(0.98, -0.1), P(0.84, -0.27), P(0.4, -0.36), P(0, -0.33), P(-0.45, -0.18), P(-0.72, -0.08), P(-0.72, 0.07), P(-0.4, 0.2), P(0.1, 0.29), P(0.5, 0.24), P(0.58, 0.14)];
  const hinge = P(0.6, 0.06);
  const jaw0 = [P(0.6, 0.05), P(0.97, 0.04), P(0.9, 0.14), P(0.7, 0.2), P(0.56, 0.15)];
  const ja = mouth * 26;
  const jaw = jaw0.map((p) => rotAbout(p, hinge, ja));
  const tail = [P(-0.7, -0.07), P(-0.86, -0.2), P(-1.02, -0.36), P(-0.94, -0.05), P(-0.88, 0), P(-0.94, 0.05), P(-1.02, 0.34), P(-0.86, 0.2), P(-0.7, 0.07)];
  const winC: Pt = P(0.02, 0.0);
  const winR: Pt = [L * 0.34 * belly, L * 0.19 * belly];
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s}) rotate(${tilt})`}>
      <defs>
        <radialGradient id={bg}>
          <stop offset="0" stopColor="#C8743A" />
          <stop offset="0.6" stopColor="#6A2E1E" />
          <stop offset="1" stopColor="#2A100C" />
        </radialGradient>
        <clipPath id={clip}>
          <ellipse cx={winC[0]} cy={winC[1]} rx={Math.max(1, winR[0])} ry={Math.max(1, winR[1])} />
        </clipPath>
      </defs>
      <g transform={`rotate(${tailA.toFixed(2)} ${-0.7 * L} 0)`}>
        <path d={smooth(tail, true, 0.3)} fill={tone(c, -0.12)} stroke={rim(0.8)} strokeWidth={1.4} />
        {[-0.2, 0, 0.2].map((v) => (
          <path key={v} d={`M ${-0.74 * L} ${v * 0.3 * L} L ${-0.96 * L} ${v * 1.4 * L}`} stroke={tone(c, 0.1)} strokeWidth={1.2} opacity={0.5} />
        ))}
      </g>
      <path d={smooth([P(0.08, -0.32), P(-0.14, -0.52), P(-0.32, -0.26)], true, 0.3)} fill={tone(c, -0.1)} stroke={rim(0.8)} strokeWidth={1.2} />
      {mouth > 0.02 ? <path d={poly([P(0.6, 0.05), P(1.0, 0.0), jaw[1], jaw[2], jaw[3]])} fill="#1A0E10" /> : null}
      {mouth > 0.02 ? <path d={smooth([rotAbout(P(0.66, 0.1), hinge, ja * 0.6), rotAbout(P(0.86, 0.08), hinge, ja * 0.7), rotAbout(P(0.8, 0.13), hinge, ja * 0.8)], true)} fill="#4A1E22" opacity={0.8} /> : null}
      <path d={smooth(main, true, 0.42)} fill={c} stroke={rim(1)} strokeWidth={1.6} />
      <path d={smooth([P(-0.6, 0.1), P(-0.3, 0.2), P(0.1, 0.27), P(0.5, 0.22), P(0.56, 0.12), P(0.2, 0.12), P(-0.3, 0.08)], true, 0.45)} fill={bellyC} opacity={0.85} />
      {[0.14, 0.17, 0.2].map((v, i) => (
        <path key={i} d={smooth([P(0.0, v + 0.04), P(0.3, v + 0.02), P(0.52, v - 0.04)], false)} stroke={tone(bellyC, -0.2)} strokeWidth={1.4} fill="none" opacity={0.7} />
      ))}
      <path d={smooth(jaw, true, 0.4)} fill={bellyC} stroke={rim(0.8)} strokeWidth={1.2} />
      <path d={smooth([P(0.62, 0.04), P(0.82, 0.03), P(1.0, 0.0)], false)} stroke={tone(c, -0.4)} strokeWidth={2} fill="none" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={range(`gfx${i}`, -0.5, 0.6) * L} cy={range(`gfy${i}`, -0.28, -0.12) * L} r={range(`gfr${i}`, 1.5, 4)} fill={tone(c, 0.2)} opacity={0.5} />
      ))}
      <path d={smooth([P(0.2, -0.3), P(0.55, -0.29), P(0.82, -0.2)], false)} stroke={tone(c, 0.25)} strokeWidth={3} fill="none" opacity={0.45} />
      <ellipse cx={0.73 * L} cy={-0.1 * L} rx={0.036 * L} ry={0.03 * L} fill="#E8ECE6" />
      <circle cx={0.735 * L} cy={-0.098 * L} r={0.022 * L} fill="#10161A" />
      <circle cx={0.728 * L} cy={-0.106 * L} r={0.007 * L} fill="#FFFFFF" />
      <path d={`M ${0.69 * L} ${-0.13 * L} Q ${0.73 * L} ${-0.155 * L} ${0.775 * L} ${-0.125 * L}`} stroke={tone(c, -0.35)} strokeWidth={2.4} fill="none" />
      <g transform={`rotate(${finA.toFixed(2)} ${0.36 * L} ${0.12 * L})`}>
        <path d={smooth([P(0.38, 0.1), P(0.16, 0.22), P(0.08, 0.36), P(0.3, 0.2)], true, 0.4)} fill={tone(c, -0.08)} stroke={rim(0.8)} strokeWidth={1.2} />
      </g>
      {belly > 0.02 ? (
        <>
          <ellipse cx={winC[0]} cy={winC[1]} rx={winR[0] + 6} ry={winR[1] + 6} fill={tone(c, -0.4)} />
          <ellipse cx={winC[0]} cy={winC[1]} rx={winR[0]} ry={winR[1]} fill={`url(#${bg})`} />
          <g clipPath={`url(#${clip})`}>
            {[-0.6, -0.3, 0, 0.3, 0.6].map((u) => (
              <path key={u} d={`M ${winC[0] + u * winR[0]} ${winC[1] - winR[1]} Q ${winC[0] + u * winR[0] * 1.15} ${winC[1]} ${winC[0] + u * winR[0]} ${winC[1] + winR[1]}`} stroke="rgba(255,200,150,0.18)" strokeWidth={10} fill="none" />
            ))}
            <ellipse cx={winC[0]} cy={winC[1] + winR[1] * 0.75} rx={winR[0]} ry={winR[1] * 0.35} fill="rgba(60,24,16,0.6)" />
            <NoScale>
              <g transform={`translate(${winC[0]} ${winC[1] + 70})`} opacity={belly}>
                {inside}
              </g>
            </NoScale>
          </g>
          <ellipse cx={winC[0]} cy={winC[1]} rx={winR[0]} ry={winR[1]} fill="none" stroke="rgba(255,214,170,0.5)" strokeWidth={2} />
        </>
      ) : null}
      {spit > 0.01
        ? Array.from({ length: 26 }, (_, i) => {
            const t = mod(f * 0.03 + i / 26, 1);
            const sx = L * 1.0 + t * 380;
            const syy = L * 0.03 + t * t * 260 - t * 90 + Math.sin(i * 2.1) * 20 * t;
            return <circle key={`w${i}`} cx={sx} cy={syy} r={(6 + 10 * t) * spit} fill="rgba(210,232,244,0.75)" opacity={spit * (1 - t)} />;
          })
        : null}
      {spit > 0.01 ? <path d={`M ${L} ${0.02 * L} Q ${L + 160} ${-0.08 * L} ${L + 300} ${0.3 * L}`} stroke="rgba(200,228,242,0.55)" strokeWidth={34 * spit} fill="none" strokeLinecap="round" /> : null}
    </g>
  );
};

/**
 * Behemoth (Job 40:15–24), stylized and majestic, not monstrous: a massive river beast with a tail like a cedar, bronze
 * bones, hippo-like. Person scale, facing right, default len 560 (back at -248, ear top -264, rump -206 to nose +318, tail
 * tip up to -334). `gold` 0..1 turns it into gold line
 * art (for God's speech from the whirlwind); `p` 0..1 draws it on (gold) or fades it in. `walk` is a phase.
 */
export const Behemoth: React.FC<Base & { len?: number; gold?: number; p?: number; walk?: number; color?: string }> = ({ x, y, s = 1, flip = false, len = 560, gold = 0, p = 1, walk, color = "#4A4038" }) => {
  const gy = useBase(x, y);
  const k = (len / 560) * s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const c = ink(color);
  const ph = walk ?? 0;
  const sw = walk !== undefined ? Math.sin(ph) * 9 : 0;
  const body: Pt[] = [
    [-206, -140], [-180, -214], [-80, -248], [40, -246], [120, -232], [160, -222], [198, -246], [240, -244], [290, -214], [318, -176], [316, -146], [300, -126],
    [250, -118], [196, -116], [160, -98], [70, -84], [-60, -82], [-160, -94], [-208, -112],
  ];
  const tail: Pt[] = [[-196, -182], [-240, -202], [-272, -242], [-282, -292], [-268, -334]];
  const legs: [number, number][] = [[-150, 0], [-112, Math.PI], [104, Math.PI], [140, 0]];
  const goldC = "#F8D488";
  const filled = 1 - gold;
  const line = (d: string, w: number, key: string) => (
    <g key={key}>
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke="rgba(255,200,110,0.35)" strokeWidth={w * 4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke={goldC} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  const legPath = (hx: number, o: number) => {
    const a = walk !== undefined ? Math.sin(ph + o) * 10 : 0;
    const kx = hx + Math.sin(a * D) * 50;
    return taper([[hx, -120], [kx, -60], [kx + 2, -10], [kx + 4, 0]], 62, 58, 0.3);
  };
  const bodyD = smooth(body, true, 0.42);
  const tailD = taper(tail.map((q, i) => [q[0] + sw * 0.3 * i, q[1]] as Pt), 40, 18);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -k : k} ${k})`} opacity={gold > 0.5 ? 1 : p}>
      {gold > 0.01 ? <path d={bodyD} fill={c} opacity={0.55 * gold * p} /> : null}
      {filled > 0.01 ? (
        <g opacity={filled}>
          <ellipse cx={20} cy={0} rx={260} ry={9} fill="rgba(0,0,0,0.35)" />
          {legs.slice(0, 2).map(([hx, o], i) => (
            <path key={`b${i}`} d={legPath(hx + 16, o)} fill={tone(c, -0.35)} />
          ))}
          <path d={tailD} fill={tone(c, -0.08)} stroke={rim(0.8)} strokeWidth={1.4} />
          {[0.25, 0.5, 0.75].map((t) => {
            const q = tail[Math.round(t * 4)];
            return <path key={t} d={`M ${q[0] - 14} ${q[1] + 4} q 14 -8 28 0`} stroke={tone(c, 0.2)} strokeWidth={1.4} fill="none" />;
          })}
          <path d={bodyD} fill={c} stroke={rim(1)} strokeWidth={1.8} />
          <path d={smooth([[-180, -110], [-60, -96], [80, -100], [170, -112]], false)} stroke={tone(c, 0.12)} strokeWidth={10} fill="none" opacity={0.35} />
          <path d={smooth([[-170, -200], [-80, -234], [40, -232], [140, -216]], false)} stroke={ink("#B8904A")} strokeWidth={3} fill="none" opacity={0.6} />
          {[-120, -70, -20, 30, 80].map((rx) => (
            <path key={rx} d={`M ${rx} -228 Q ${rx + 14} -170 ${rx + 2} -104`} stroke={ink("#B8904A")} strokeWidth={2.2} fill="none" opacity={0.4} />
          ))}
          <path d="M 196 -244 L 190 -264 L 210 -248 Z" fill={tone(c, -0.1)} stroke={rim(0.6)} strokeWidth={1} />
          <ellipse cx={236} cy={-232} rx={9} ry={7} fill={tone(c, 0.08)} />
          <ellipse cx={238} cy={-232} rx={4.6} ry={3.6} fill={ink("#E8D8A8")} />
          <circle cx={239} cy={-232} r={2.2} fill="#120C08" />
          <path d="M 232 -238 Q 238 -242 245 -237" stroke={tone(c, -0.35)} strokeWidth={1.6} fill="none" />
          <path d="M 252 -134 Q 286 -140 314 -150" stroke={tone(c, -0.4)} strokeWidth={2.4} fill="none" />
          <ellipse cx={306} cy={-196} rx={5} ry={3.4} fill={tone(c, -0.45)} />
          <path d="M 262 -170 Q 280 -160 300 -164" stroke={tone(c, -0.2)} strokeWidth={1.4} fill="none" />
          {legs.slice(2).map(([hx, o], i) => (
            <path key={`f${i}`} d={legPath(hx, o)} fill={tone(c, -0.05)} stroke={rim(0.6)} strokeWidth={1.2} />
          ))}
        </g>
      ) : null}
      {gold > 0.01 ? (
        <g opacity={gold}>
          {line(bodyD, 2.6, "b")}
          {line(tailD, 2, "t")}
          {legs.map(([hx, o], i) => line(legPath(hx, o), 2, `l${i}`))}
          {line("M 252 -134 Q 286 -140 314 -150", 1.6, "m")}
          {line(smooth([[-170, -200], [-80, -234], [40, -232], [140, -216]], false), 1.4, "s")}
          <circle cx={239} cy={-232} r={3} fill={goldC} opacity={p} />
        </g>
      ) : null}
    </g>
  );
};

/**
 * Leviathan (Job 41), stylized and majestic: a long sea creature rising in arches from the waves, its back armoured with
 * rows of shields, mist from its nostrils. Person scale, head at the right; default len 1200, arch height up to 260 * rise
 * above the anchor (the water surface). Put it in a water band's children so the parts below the surface are hidden.
 * `rise` 0..1 lifts it; `swim` is a phase (f * 0.03); `gold` 0..1 gold line art over a dark translucent body, `p` draws it
 * on. In a 16:9 frame s ≈ 0.45–0.55 in the middle band keeps the head in shot.
 */
export const Leviathan: React.FC<Base & { len?: number; rise?: number; swim?: number; gold?: number; p?: number; color?: string }> = ({ x, y, s = 1, flip = false, len = 1200, rise = 1, swim, gold = 0, p = 1, color = "#1E3A40" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const c = ink(color);
  const ph = swim ?? f * 0.025;
  const N = 36;
  const A = 260 * rise;
  const sink = (1 - rise) * 160;
  const cl: Pt[] = Array.from({ length: N + 1 }, (_, i) => {
    const u = i / N;
    const xx = lerp(len / 2, -len / 2, u);
    const yy = -A * Math.sin(u * Math.PI * 2.2 + 0.35 + Math.sin(ph) * 0.25) * (1 - 0.35 * u) + sink + u * 30;
    return [xx, yy];
  });
  const headDir = Math.atan2(cl[0][1] - cl[2][1], cl[0][0] - cl[2][0]);
  const hd = (headDir * 180) / Math.PI;
  const bodyD = taper(cl, 86, 14, 0.5);
  const scutes = cl.slice(2, N - 2).map((q, i) => {
    const a = cl[i + 1];
    const b = cl[i + 3];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const w = lerp(86, 14, (i + 2) / N) / 2;
    const bx = q[0] + nx * w * 0.85;
    const by = q[1] + ny * w * 0.85;
    const hh = 10 + w * 0.35;
    return poly([[bx - (b[0] - a[0]) * 0.18, by - (b[1] - a[1]) * 0.18], [bx + nx * hh, by + ny * hh], [bx + (b[0] - a[0]) * 0.18, by + (b[1] - a[1]) * 0.18]]);
  });
  const headD = smooth([[-10, -40], [40, -44], [110, -30], [150, -12], [150, 6], [100, 16], [40, 30], [-10, 36]], true, 0.4);
  const goldC = "#F8D488";
  const line = (d: string, w: number, key: string) => (
    <g key={key}>
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke="rgba(255,200,110,0.35)" strokeWidth={w * 4} fill="none" strokeLinejoin="round" />
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke={goldC} strokeWidth={w} fill="none" strokeLinejoin="round" />
    </g>
  );
  const mist = Array.from({ length: 8 }, (_, i) => {
    const t = mod(f * 0.015 + i / 8, 1);
    return { cx: 150 + t * 120, cy: -20 - t * 90 + Math.sin(i * 1.7 + f * 0.02) * 10, r: 10 + 34 * t, a: (1 - t) * 0.35 };
  });
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`} opacity={gold > 0.5 ? 1 : p}>
      {gold < 0.99 ? (
        <g opacity={1 - gold}>
          {scutes.map((d, i) => (
            <path key={`s${i}`} d={d} fill={tone(c, -0.15)} stroke={ink("#B89A5A")} strokeWidth={1} opacity={0.9} />
          ))}
          <path d={bodyD} fill={c} stroke={rim(1)} strokeWidth={1.6} />
          {cl.slice(1, N - 1).map((q, i) =>
            i % 2 ? null : <ellipse key={`r${i}`} cx={q[0]} cy={q[1]} rx={lerp(30, 6, i / N)} ry={lerp(14, 3, i / N)} fill="none" stroke={tone(c, 0.22)} strokeWidth={1.2} opacity={0.55} />,
          )}
          <g transform={`translate(${cl[0][0]} ${cl[0][1]}) rotate(${hd})`}>
            <path d={headD} fill={tone(c, 0.05)} stroke={rim(1)} strokeWidth={1.5} />
            <path d="M 30 8 Q 90 12 148 2" stroke={tone(c, -0.4)} strokeWidth={2} fill="none" />
            <path d="M 20 -38 L 6 -60 L 34 -42 Z" fill={tone(c, -0.15)} stroke={ink("#B89A5A")} strokeWidth={1} />
            <ellipse cx={70} cy={-22} rx={7} ry={5} fill="#F2D27A" />
            <circle cx={71} cy={-22} r={2.6} fill="#120C08" />
            <path d="M 62 -28 Q 70 -32 79 -27" stroke={tone(c, -0.4)} strokeWidth={1.6} fill="none" />
          </g>
          {mist.map((m, i) => {
            const q = rotAbout([cl[0][0] + m.cx, cl[0][1] + m.cy], cl[0], hd * 0.5);
            return <circle key={`m${i}`} cx={q[0]} cy={q[1]} r={m.r} fill={`rgba(220,228,236,${m.a.toFixed(3)})`} />;
          })}
        </g>
      ) : null}
      {gold > 0.01 ? (
        <g opacity={gold}>
          <path d={bodyD} fill={c} opacity={0.6 * p} />
          {line(bodyD, 2.4, "b")}
          {scutes.filter((_, i) => i % 2 === 0).map((d, i) => line(d, 1.2, `s${i}`))}
          <g transform={`translate(${cl[0][0]} ${cl[0][1]}) rotate(${hd})`}>
            <path d={headD} fill={c} opacity={0.6 * p} />
            {line(headD, 2.2, "h")}
            <circle cx={70} cy={-22} r={3.4} fill={goldC} opacity={p} />
          </g>
        </g>
      ) : null}
    </g>
  );
};

// ── Daniel ───────────────────────────────────────────────────────────────────────────────

/**
 * The golden image on the plain of Dura (Daniel 3:1), sixty cubits high: a gilded giant king on a pedestal over a stepped
 * base, robed, bearded, crowned, holding a sceptre across his chest. Person scale, so people stand on the steps at the same
 * s: steps 3 × 20 (base top at -60, 520 wide), pedestal top at -0.2 h, shoulders -0.83 h, crown top at -h (h = 1500, about
 * 8.5 men). In a wide shot use s ≈ 0.3–0.5 and give the crowd the same s (Populace size 174 * s). `glint` 0..1 places the
 * specular highlight across the gold (default: a slow sweep); `p` 0..1 raises it from its base; `glow` a sunlit halo.
 */
export const GoldenStatue: React.FC<Base & { h?: number; glint?: number; glow?: number; p?: number }> = ({ x, y, s = 1, flip = false, h = 1500, glint, glow = 0.4, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const gid = useUid("gst");
  const cid = useUid("gsc");
  const stone = ink("#9A8A70");
  const ped = -h * 0.2;
  const yw = -h * 0.6;
  const ys = -h * 0.83;
  const hc = -h * 0.885;
  const hr = h * 0.042;
  const hl = glint ?? 0.5 + 0.28 * Math.sin(f * 0.02);
  const o1 = Math.max(0.04, hl - 0.3);
  const o3 = Math.min(0.96, hl + 0.24);
  const rise = Math.min(1, Math.max(0, p));
  const G = `url(#${gid})`;
  const edge = "rgba(255,240,200,0.85)";
  const line = "rgba(110,70,14,0.45)";
  const fig = (
    <>
      <path d={`M -152 ${ped} Q -142 ${(ped + yw) / 2} -96 ${yw} L 96 ${yw} Q 142 ${(ped + yw) / 2} 152 ${ped} Z`} fill={G} stroke={edge} strokeWidth={2} />
      {[-64, -22, 22, 64].map((fx) => (
        <path key={fx} d={`M ${fx * 0.7} ${yw + 20} Q ${fx * 0.85} ${(ped + yw) / 2} ${fx * 1.25} ${ped - 6}`} stroke={line} strokeWidth={3} fill="none" />
      ))}
      {Array.from({ length: 22 }, (_, i) => (
        <line key={`fr${i}`} x1={-146 + i * 13.9} y1={ped - 18} x2={-146 + i * 13.9} y2={ped - 2} stroke="#C8902A" strokeWidth={4} />
      ))}
      <path d={`M -96 ${yw} L -128 ${ys + 44} Q -126 ${ys} -88 ${ys - 8} L 88 ${ys - 8} Q 126 ${ys} 128 ${ys + 44} L 96 ${yw} Z`} fill={G} stroke={edge} strokeWidth={2} />
      <rect x={-104} y={yw - 16} width={208} height={30} fill="#B8862A" stroke={edge} strokeWidth={1.4} />
      <path d={`M -120 ${ys + 30} Q 0 ${ys + 110} 120 ${ys + 30}`} stroke={line} strokeWidth={3} fill="none" />
      <line x1={-74} y1={yw + 70} x2={52} y2={ys - 10} stroke="#FFF0B8" strokeWidth={13} strokeLinecap="round" />
      <circle cx={56} cy={ys - 22} r={20} fill="#FFF0B8" stroke={edge} strokeWidth={1.5} />
      {[`M -116 ${ys + 30} L -132 ${ys + 170} L -14 ${ys + 128}`, `M 116 ${ys + 30} L 130 ${ys + 210} L 22 ${ys + 186}`].map((d, i) => (
        <g key={`arm${i}`}>
          <path d={d} stroke="rgba(110,70,14,0.55)" strokeWidth={56} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} stroke={G} strokeWidth={48} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      <circle cx={-12} cy={ys + 128} r={24} fill="#E8B848" stroke={edge} strokeWidth={1.4} />
      <circle cx={22} cy={ys + 186} r={24} fill="#E8B848" stroke={edge} strokeWidth={1.4} />
      <rect x={-26} y={hc + hr * 0.6} width={52} height={hr * 0.8} fill={G} />
      <circle cx={0} cy={hc} r={hr} fill={G} stroke={edge} strokeWidth={2} />
      <path d={`M -50 ${hc + 18} L -42 ${hc + 150} Q 0 ${hc + 166} 42 ${hc + 150} L 50 ${hc + 18} Q 0 ${hc + 40} -50 ${hc + 18} Z`} fill="#B8862A" stroke={edge} strokeWidth={1.5} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M -44 ${hc + 44 + i * 22} q 11 7 22 0 q 11 7 22 0 q 11 7 22 0 q 11 7 22 0`} stroke="rgba(90,56,10,0.55)" strokeWidth={2.4} fill="none" />
      ))}
      <path d={`M -34 ${hc + 24} L -6 ${hc + 18} L 6 ${hc + 18} L 34 ${hc + 24}`} stroke="rgba(90,56,10,0.6)" strokeWidth={6} fill="none" strokeLinejoin="round" />
      <path d={`M -36 ${hc - 14} L -10 ${hc - 16} M 10 ${hc - 16} L 36 ${hc - 14}`} stroke="rgba(90,56,10,0.7)" strokeWidth={4} />
      <ellipse cx={-22} cy={hc - 4} rx={8} ry={5} fill="#7A4E10" />
      <ellipse cx={22} cy={hc - 4} rx={8} ry={5} fill="#7A4E10" />
      <path d={`M 0 ${hc - 10} L -6 ${hc + 12} L 6 ${hc + 12}`} stroke="rgba(90,56,10,0.5)" strokeWidth={3} fill="none" />
      <path d={`M -58 ${hc - hr * 0.62} L -66 ${-h + 18} Q 0 ${-h - 8} 66 ${-h + 18} L 58 ${hc - hr * 0.62} Z`} fill="#FFE08A" stroke={edge} strokeWidth={2} />
      <rect x={-62} y={hc - hr * 0.62 - 18} width={124} height={18} fill="#C8962E" />
      {[-36, 0, 36].map((rx) => (
        <circle key={rx} cx={rx} cy={(hc - hr * 0.62 + (-h + 18)) / 2} r={11} fill="#C8962E" stroke="#FFF4C8" strokeWidth={2} />
      ))}
    </>
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <defs>
        <linearGradient id={gid} x1="-160" y1="0" x2="160" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9A6418" />
          <stop offset={o1} stopColor="#D8A438" />
          <stop offset={hl} stopColor="#FFEDB0" />
          <stop offset={o3} stopColor="#D8A438" />
          <stop offset="1" stopColor="#A8701E" />
        </linearGradient>
        <clipPath id={cid}>
          <rect x={-400} y={-h - 120} width={800} height={h + 60} />
        </clipPath>
      </defs>
      <ellipse cx={0} cy={0} rx={300} ry={12} fill="rgba(0,0,0,0.35)" />
      {glow > 0 ? <GlowS x={0} y={-h * 0.7} r={h * 0.45} squash={1.1} color="255,214,140" opacity={0.45 * glow * rise} /> : null}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={-260 + i * 30} y={-20 - i * 20} width={520 - i * 60} height={20} fill={i % 2 ? tone(stone, -0.08) : stone} stroke={rim(0.8)} strokeWidth={1.4} />
      ))}
      <g clipPath={`url(#${cid})`}>
        <g transform={`translate(0 ${(h * (1 - rise)).toFixed(1)})`}>
          <path d={`M -136 -60 L -122 ${ped} L 122 ${ped} L 136 -60 Z`} fill={G} stroke={edge} strokeWidth={2} />
          <rect x={-146} y={-76} width={292} height={18} fill="#C8962E" stroke={edge} strokeWidth={1.2} />
          <rect x={-132} y={ped - 4} width={264} height={16} fill="#C8962E" stroke={edge} strokeWidth={1.2} />
          <line x1={-120} y1={(ped - 60) / 2} x2={120} y2={(ped - 60) / 2} stroke={line} strokeWidth={2.4} />
          {fig}
        </g>
      </g>
    </g>
  );
};

/**
 * The burning fiery furnace (Daniel 3): a massive Babylonian brick kiln with a great arched mouth at ground level and a
 * vent at the top. Person scale: 900 wide, vent at -640; the mouth is 460 wide and 360 tall, so four figures (Person s ≈ 1)
 * walk inside it. `inside` is drawn within the mouth, between the back fire and the low front flames (a Person at x, y = 0
 * stands on the furnace floor; keep |x| < 180). `fire` 0..1; `heat` 0..1 (seven times hotter: flames burst from the vent and
 * lick out over the lintel); `cool` 0..1 is the angel's "moist whistling wind": the flames are driven to the sides and
 * the middle fills with pale gold air; `door` 0..1 swings the iron doors shut.
 */
export const FieryFurnace: React.FC<Base & { fire?: number; heat?: number; cool?: number; door?: number; inside?: React.ReactNode; seed?: string }> = ({
  x,
  y,
  s = 1,
  flip = false,
  fire = 1,
  heat = 0,
  cool = 0,
  door = 0,
  inside,
  seed = "ff",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const cid = useUid("ffc");
  const gid = useUid("ffg");
  const wid = useUid("ffw");
  const brick = ink("#6E4630");
  const mw = 230;
  const mh = 360;
  const mouth = `M ${-mw} 4 L ${-mw} ${-mh * 0.62} Q ${-mw} ${-mh} 0 ${-mh} Q ${mw} ${-mh} ${mw} ${-mh * 0.62} L ${mw} 4 Z`;
  const heatA = fire * (0.6 + 0.4 * heat);
  const back = fire * (1 - cool * 0.75);
  const lowF = fire * (1 - cool * 0.9);
  const outline: Pt[] = [[-450, 0], [-430, -500], [-340, -560], [-200, -610], [-90, -634], [90, -634], [200, -610], [340, -560], [430, -500], [450, 0]];
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <defs>
        <clipPath id={cid}>
          <path d={mouth} />
        </clipPath>
        <linearGradient id={gid} x1="0" y1={-mh} x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mixHex("#7A1A06", "#3A2A20", 1 - fire)} />
          <stop offset="0.45" stopColor={mixHex("#FF7A1E", "#4A3A2A", 1 - fire)} />
          <stop offset="1" stopColor={mixHex("#FFE6A0", "#5A4A3A", 1 - fire)} />
        </linearGradient>
        <radialGradient id={wid}>
          <stop offset="0" stopColor="#FFFDF2" stopOpacity={0.95} />
          <stop offset="0.5" stopColor="#FFF0C8" stopOpacity={0.6} />
          <stop offset="1" stopColor="#FFE8B0" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={0} rx={520} ry={14} fill="rgba(0,0,0,0.4)" />
      <GlowS x={0} y={-mh * 0.5} r={640} squash={0.7} color="255,130,50" opacity={0.55 * heatA} />
      <path d={`${smooth(outline, false, 0.5)} Z`} fill={brick} stroke={rim(1)} strokeWidth={1.8} />
      {Array.from({ length: 24 }, (_, r) => {
        const yy = -r * 26;
        const half = r < 19 ? 440 - r * 1.2 : 440 - (r - 18) * 50;
        if (half < 60) return null;
        return (
          <g key={r}>
            <line x1={-half} y1={yy} x2={half} y2={yy} stroke={tone(brick, -0.32)} strokeWidth={1.2} opacity={0.7} />
            {Array.from({ length: Math.floor((half * 2) / 52) }, (_, j) => {
              const xx = -half + j * 52 + (r % 2) * 26;
              return <line key={j} x1={xx} y1={yy} x2={xx} y2={yy - 26} stroke={tone(brick, -0.32)} strokeWidth={1} opacity={0.5} />;
            })}
          </g>
        );
      })}
      <path d={`M -360 -40 Q -380 -300 -300 -470 M 360 -40 Q 380 -300 300 -470`} stroke={tone(brick, 0.12)} strokeWidth={10} fill="none" opacity={0.35} />
      <GlowS x={0} y={-mh * 0.45} r={mw * 1.9} squash={0.9} color="255,120,40" opacity={0.7 * heatA} />
      <path d={mouth} fill={`url(#${gid})`} />
      <g clipPath={`url(#${cid})`}>
        {flames(f, `${seed}b`, 0, 6, mw * 2.1, mh * 1.05, 9, back, 1 + cool * 1.8)}
        {Array.from({ length: 22 }, (_, i) => {
          const t = mod(f * range(`${seed}es${i}`, 0.006, 0.014) + random(`${seed}e${i}`), 1);
          return <circle key={`e${i}`} cx={range(`${seed}ex${i}`, -mw, mw) + Math.sin(f * 0.05 + i) * 20} cy={-t * mh * 1.1} r={range(`${seed}er${i}`, 1.5, 3.5)} fill="#FFE6A0" opacity={fire * (1 - t)} />;
        })}
        {cool > 0.01 ? (
          <>
            <ellipse cx={0} cy={-mh * 0.42} rx={mw * 0.95} ry={mh * 0.62} fill={`url(#${wid})`} opacity={cool} />
            {Array.from({ length: 9 }, (_, i) => {
              const r0 = 40 + i * 22;
              const off = mod(f * (2 + i * 0.3) + i * 40, 360);
              return (
                <ellipse key={`w${i}`} cx={0} cy={-mh * 0.42} rx={r0 * 1.2} ry={r0 * 0.7} fill="none" stroke={`rgba(255,255,248,${(0.4 * cool).toFixed(3)})`} strokeWidth={2} pathLength={360} strokeDasharray="70 50 30 210" strokeDashoffset={off} />
              );
            })}
          </>
        ) : null}
        <NoScale>{inside}</NoScale>
        {flames(f, `${seed}l`, 0, 6, mw * 2.0, 110, 11, lowF, 1 + cool * 2)}
      </g>
      <path d={mouth} fill="none" stroke={tone(brick, -0.45)} strokeWidth={22} />
      {Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + (i / 12) * Math.PI;
        const cx0 = Math.cos(a) * (mw + 22);
        const cy0 = -mh * 0.62 + Math.sin(a) * (mh * 0.38 + 22);
        return <rect key={`v${i}`} x={cx0 - 14} y={cy0 - 10} width={28} height={20} fill={tone(brick, 0.1)} stroke={rim(0.6)} strokeWidth={1} transform={`rotate(${(a * 180) / Math.PI + 90} ${cx0} ${cy0})`} />;
      })}
      {[-1, 1].map((k) => (
        <rect key={`j${k}`} x={k * (mw + 12) - 14} y={-mh * 0.62} width={28} height={mh * 0.62} fill={tone(brick, 0.1)} stroke={rim(0.6)} strokeWidth={1} />
      ))}
      {door > 0.02
        ? [-1, 1].map((k) => (
            <g key={`d${k}`} transform={`translate(${k * mw} 0) scale(${door.toFixed(3)} 1) translate(${-k * mw} 0)`}>
              <path d={`M ${k * mw} 4 L ${k * mw} ${-mh * 0.62} Q ${k * mw} ${-mh} 0 ${-mh} L 0 4 Z`} fill={ink("#3A3432")} stroke={rim(0.8)} strokeWidth={1.4} />
              {[0.3, 0.6].map((t) => (
                <line key={t} x1={k * mw} y1={-mh * t} x2={0} y2={-mh * t} stroke={ink("#5A524E")} strokeWidth={6} />
              ))}
            </g>
          ))
        : null}
      {door < 0.98
        ? [-1, 1].map((k) => (
            <g key={`ol${k}`} opacity={1 - door}>
              <rect x={k < 0 ? -mw - 90 : mw + 44} y={-mh * 0.86} width={46} height={mh * 0.86} fill={ink("#3A3432")} stroke={rim(0.8)} strokeWidth={1.3} />
              {[0.3, 0.6].map((t) => (
                <line key={t} x1={k < 0 ? -mw - 90 : mw + 44} y1={-mh * t} x2={k < 0 ? -mw - 44 : mw + 90} y2={-mh * t} stroke={ink("#5A524E")} strokeWidth={5} />
              ))}
            </g>
          ))
        : null}
      {flames(f, `${seed}v`, 0, -626, 200, 300, 5, fire * (0.25 + heat * 0.75))}
      {heat > 0.02 ? flames(f, `${seed}h`, 0, -mh + 6, mw * 1.4, 170, 7, heat * fire) : null}
      <GlowS x={0} y={-640} r={220} squash={0.8} color="255,150,60" opacity={0.5 * fire * (0.3 + heat * 0.7)} />
      <Smoke x={0} y={-700} s={2.2} n={10} life={170} rise={1.4} drift={0.3} color="70,60,56" opacity={0.45 * fire} seed={`${seed}sm`} />
      <GlowS x={0} y={-6} r={mw * 2.2} squash={0.12} color="255,160,70" opacity={0.6 * heatA} />
    </g>
  );
};

/**
 * The mouth of the lions' den seen at ground level (Daniel 6:17): a dark pit opening ringed with a stone curb, the great
 * round stone that covers it and the king's seal on cords. Person scale, opening 340 wide; the stone is 380 across and 30
 * thick (top at -34). `cover` 0..1 slides the stone over the mouth (0 = rolled aside to the left); `seal` 0..1 adds the cords
 * and clay seal; `glow` 0..1 lights the pit from inside (the angel, or dawn).
 */
export const LionsDen: React.FC<Base & { w?: number; cover?: number; seal?: number; glow?: number }> = ({ x, y, s = 1, flip = false, w = 340, cover = 1, seal = 0, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const stone = ink("#7A7064");
  const hr = w / 2;
  const sx = lerp(-w * 0.95, 0, cover);
  const curb = (front: boolean) =>
    Array.from({ length: 13 }, (_, i) => {
      const a = (i / 12) * Math.PI;
      const cx = Math.cos(a) * (hr + 14);
      const cy = (front ? 1 : -1) * Math.sin(a) * 40;
      return <ellipse key={`${front}${i}`} cx={cx} cy={cy - 6} rx={22} ry={13} fill={mixHex(stone, tone(stone, -0.25), random(`ldc${front}${i}`))} stroke={rim(0.6)} strokeWidth={1} />;
    });
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      {curb(false)}
      <ellipse cx={0} cy={0} rx={hr} ry={34} fill="#06040A" />
      {glow > 0 ? (
        <>
          <ellipse cx={0} cy={0} rx={hr * 0.9} ry={28} fill={`rgba(255,226,160,${(0.6 * glow).toFixed(3)})`} />
          <GlowS x={0} y={-30} r={hr * 1.6} squash={0.6} color="255,226,160" opacity={0.6 * glow * (1 - cover * 0.8)} />
        </>
      ) : null}
      {curb(true)}
      <g transform={`translate(${sx} 0)`}>
        <ellipse cx={0} cy={4} rx={hr + 30} ry={40} fill="rgba(0,0,0,0.35)" />
        <path d={`M ${-hr - 20} -6 L ${-hr - 20} -34 A ${hr + 20} 40 0 0 1 ${hr + 20} -34 L ${hr + 20} -6 A ${hr + 20} 40 0 0 1 ${-hr - 20} -6 Z`} fill={tone(stone, -0.18)} stroke={rim(0.8)} strokeWidth={1.4} />
        <ellipse cx={0} cy={-34} rx={hr + 20} ry={40} fill={stone} stroke={rim(1)} strokeWidth={1.5} />
        <ellipse cx={-30} cy={-40} rx={hr * 0.6} ry={18} fill={tone(stone, 0.08)} opacity={0.6} />
        {seal > 0.01 ? (
          <g opacity={Math.min(1, seal * 1.5)}>
            <path d={`M ${-hr - 60} 6 Q ${-hr * 0.5} -10 0 -2 Q ${hr * 0.5} -10 ${hr + 60} 6`} stroke={ink("#8A6A40")} strokeWidth={2.6} fill="none" />
            <rect x={-hr - 66} y={-6} width={8} height={16} fill={ink("#5A4030")} />
            <rect x={hr + 58} y={-6} width={8} height={16} fill={ink("#5A4030")} />
            <ellipse cx={0} cy={-2} rx={18} ry={12} fill={ink("#8A3A22")} stroke={rim(0.8)} strokeWidth={1} />
            <circle cx={0} cy={-2} r={6} fill="none" stroke={ink("#E0A060")} strokeWidth={1.4} />
          </g>
        ) : null}
      </g>
    </g>
  );
};

/**
 * A Babylonian throne on a dais of blue glazed brick, two gold lions sitting at its foot. Faces right (flip: left).
 * Person scale, same anchors as PersianThrone: dais top at -36 (the `seat` slot: a Person at x = 0, y = 0 with sit: 1
 * sits on the cushion), back top -250, lions to ±150. `lions` false omits them.
 */
export const LionThrone: React.FC<Base & { seat?: React.ReactNode; lions?: boolean }> = ({ x, y, s = 1, flip = false, seat, lions = true }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const gold = ink("#C8963A");
  const g3 = tone(gold, 0.25);
  const blue = ink("#24447E");
  const Dd = 36;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={190} ry={9} fill="rgba(0,0,0,0.35)" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={-150 + i * 20} y={-12 - i * 12} width={300 - i * 40} height={12} fill={i % 2 ? tone(blue, -0.1) : blue} stroke={rim(0.7)} strokeWidth={1} />
          {Array.from({ length: Math.floor((300 - i * 40) / 20) }, (_, j) => (
            <circle key={j} cx={-140 + i * 20 + j * 20} cy={-6 - i * 12} r={2.4} fill={i === 1 ? g3 : "#E8E0CC"} opacity={0.85} />
          ))}
        </g>
      ))}
      <rect x={-38} y={-Dd - 214} width={14} height={164} fill={gold} stroke={rim(1)} strokeWidth={1.3} />
      <path d={`M -44 ${-Dd - 214} Q -31 ${-Dd - 236} -18 ${-Dd - 214} Z`} fill={g3} stroke={rim(0.8)} strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={-31} cy={-Dd - 190 + i * 36} r={5} fill={i % 2 ? "#E8E0CC" : blue} stroke={g3} strokeWidth={1.2} />
      ))}
      <path d={`M -34 ${-Dd - 50} L -36 ${-Dd} M 30 ${-Dd - 50} L 34 ${-Dd}`} stroke={gold} strokeWidth={7} strokeLinecap="round" />
      <ellipse cx={36} cy={-Dd - 3} rx={9} ry={4} fill={g3} />
      <ellipse cx={-34} cy={-Dd - 3} rx={8} ry={4} fill={g3} />
      <rect x={-40} y={-Dd - 58} width={80} height={10} rx={3} fill={gold} stroke={rim(0.9)} strokeWidth={1.1} />
      <rect x={-36} y={-Dd - 66} width={70} height={9} rx={4} fill={ink("#2A3A6A")} />
      <path d={`M -30 ${-Dd - 92} L 26 ${-Dd - 92}`} stroke={gold} strokeWidth={6} strokeLinecap="round" />
      <path d={`M 22 ${-Dd - 58} L 24 ${-Dd - 92}`} stroke={gold} strokeWidth={5} />
      <circle cx={30} cy={-Dd - 96} r={8} fill={g3} />
      <rect x={42} y={-Dd - 14} width={36} height={14} rx={2} fill={gold} stroke={rim(0.8)} strokeWidth={1} />
      <NoScale>
        {lions ? (
          <>
            <DenLion x={-140} y={0} s={0.5} pose="sit" flip color="#C8963A" seed="lta" />
            <DenLion x={150} y={0} s={0.5} pose="sit" color="#C8963A" seed="ltb" />
          </>
        ) : null}
        <g transform={`translate(0 ${-Dd})`}>{seat}</g>
      </NoScale>
    </g>
  );
};

// ── Idols and altars ─────────────────────────────────────────────────────────────────────

/**
 * A Greek altar (the heathen altar built on God's altar, 1 Maccabees 1:54, 59; the king's altar at Modin): a white marble
 * block with scrolled volutes at the top corners and a garland frieze. Person scale: w = 140, fire base at -110 (volute tops
 * -122). `fire` 0..1 (pair with <Smoke>); `p` 0..1 raises it.
 */
export const HeathenAltar: React.FC<Base & { w?: number; fire?: number; p?: number; seed?: string }> = ({ x, y, s = 1, flip = false, w = 140, fire = 0, p = 1, seed = "ha" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const m = ink("#D6CEC0");
  const hw = w / 2;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s * Math.min(1, p)})`} opacity={Math.min(1, p * 2)}>
      <ellipse cx={0} cy={0} rx={hw + 20} ry={6} fill="rgba(0,0,0,0.35)" />
      {fire > 0 ? <GlowS x={0} y={-130} r={w * 1.2} squash={0.8} color="255,150,60" opacity={0.5 * fire} /> : null}
      <rect x={-hw - 8} y={-14} width={w + 16} height={14} fill={tone(m, -0.12)} stroke={rim(0.8)} strokeWidth={1.2} />
      <rect x={-hw} y={-96} width={w} height={82} fill={m} stroke={rim(1)} strokeWidth={1.3} />
      <rect x={-hw} y={-96} width={w * 0.14} height={82} fill={tone(m, 0.15)} opacity={0.5} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${-hw + 8 + i * ((w - 16) / 3)} -76 Q ${-hw + 8 + (i + 0.5) * ((w - 16) / 3)} -56 ${-hw + 8 + (i + 1) * ((w - 16) / 3)} -76`} stroke={ink("#6A7A3A")} strokeWidth={4} fill="none" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <circle key={`r${i}`} cx={-hw + 8 + i * ((w - 16) / 3)} cy={-78} r={4} fill={ink("#B8964A")} />
      ))}
      <rect x={-hw - 6} y={-110} width={w + 12} height={14} fill={tone(m, 0.06)} stroke={rim(0.9)} strokeWidth={1.2} />
      {[-1, 1].map((k) => (
        <g key={k}>
          <circle cx={k * (hw - 4)} cy={-112} r={11} fill={tone(m, 0.08)} stroke={rim(0.9)} strokeWidth={1.2} />
          <path d={`M ${k * (hw - 4)} -112 m 0 -6 a 6 6 0 1 1 -1 0.1 m 1 3 a 3 3 0 1 0 1 0`} stroke={tone(m, -0.3)} strokeWidth={1.2} fill="none" />
        </g>
      ))}
      {fire > 0 ? flames(f, seed, 0, -110, w * 0.7, 90, 4, fire) : null}
    </g>
  );
};

/**
 * A new altar of whole, unhewn stones (1 Maccabees 4:47) with stone horns at the corners. Person scale: w = 260, fire base
 * at -150; `fire` 0..1; `built` 0..1 lays the courses from the bottom.
 */
export const WholeStoneAltar: React.FC<Base & { w?: number; fire?: number; built?: number; seed?: string }> = ({ x, y, s = 1, flip = false, w = 260, fire = 0, built = 1, seed = "wsa" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const stone = ink("#9C8C70");
  const rows = 5;
  const rh = 30;
  const shown = Math.ceil(rows * Math.min(1, Math.max(0, built)) - 0.001);
  const stones: React.ReactNode[] = [];
  for (let r = 0; r < shown; r++) {
    const rw = w - r * 6;
    let xx = -rw / 2;
    let i = 0;
    while (xx < rw / 2 - 8) {
      const sw = Math.min(rw / 2 - xx, range(`${seed}w${r}${i}`, 36, 70));
      const cx = xx + sw / 2;
      const cy = -r * rh - rh / 2;
      const pts: Pt[] = Array.from({ length: 6 }, (_, j) => {
        const a = (j / 6) * Math.PI * 2 + range(`${seed}o${r}${i}`, 0, 1);
        return [cx + Math.cos(a) * sw * 0.52 * range(`${seed}a${r}${i}${j}`, 0.8, 1.05), cy + Math.sin(a) * rh * 0.58 * range(`${seed}b${r}${i}${j}`, 0.8, 1.05)];
      });
      stones.push(<path key={`${r}-${i}`} d={smooth(pts, true, 0.3)} fill={mixHex(mixHex(stone, "#7A6A54", random(`${seed}c${r}${i}`)), "#B8A888", random(`${seed}d${r}${i}`) * 0.4)} stroke={rim(0.7)} strokeWidth={1.1} />);
      xx += sw;
      i++;
    }
  }
  const top = -rows * rh;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.62} ry={8} fill="rgba(0,0,0,0.35)" />
      {fire > 0 && shown === rows ? <GlowS x={0} y={top - 30} r={w * 0.9} squash={0.7} color="255,150,60" opacity={0.5 * fire} /> : null}
      {stones}
      {shown === rows
        ? [-1, 1].map((k) => <path key={k} d={`M ${k * (w / 2 - 22) - 14} ${top + 6} Q ${k * (w / 2 - 22)} ${top - 34} ${k * (w / 2 - 22) + 14} ${top + 6} Z`} fill={tone(stone, 0.06)} stroke={rim(0.9)} strokeWidth={1.2} />)
        : null}
      {fire > 0 && shown === rows ? flames(f, seed, 0, top + 4, w * 0.7, 110, 6, fire) : null}
    </g>
  );
};

/**
 * The abomination of desolation (1 Maccabees 1:54; 2 Maccabees 6:2, the temple renamed for Olympian Zeus): an ivory and gilt
 * statue of the bearded god enthroned, a small winged Victory on his outstretched hand and a tall sceptre, on a plinth.
 * Faces right (flip: left). Person scale: plinth top -60, head top -252, sceptre top -330. `fall` 0..1 topples it off the
 * plinth edge; `gilt` 0..1 gilds the robe and throne; `p` 0..1 fades it in.
 */
export const OlympianIdol: React.FC<Base & { fall?: number; gilt?: number; p?: number }> = ({ x, y, s = 1, flip = false, fall = 0, gilt = 0.7, p = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  if (p <= 0) return null;
  const ivory = ink("#E6DCCB");
  const goldC = ink("#D0A040");
  const robe = mixHex(ink("#B8AC98"), goldC, gilt);
  const throne = mixHex(ink("#6A4A2E"), goldC, gilt * 0.8);
  const st = ink("#8A8070");
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`} opacity={Math.min(1, p * 1.5)}>
      <ellipse cx={0} cy={0} rx={80} ry={6} fill="rgba(0,0,0,0.35)" />
      <rect x={-70} y={-60} width={140} height={60} fill={st} stroke={rim(0.9)} strokeWidth={1.3} />
      <rect x={-76} y={-68} width={152} height={10} fill={tone(st, 0.1)} stroke={rim(0.8)} strokeWidth={1} />
      <rect x={-76} y={-8} width={152} height={8} fill={tone(st, -0.1)} />
      <g transform={`rotate(${fall * 92} 70 -60)`}>
        <rect x={-54} y={-282} width={16} height={222} fill={throne} stroke={rim(0.9)} strokeWidth={1.2} />
        <circle cx={-46} cy={-288} r={8} fill={goldC} />
        <rect x={-52} y={-130} width={86} height={70} fill={tone(throne, -0.1)} stroke={rim(0.9)} strokeWidth={1.2} />
        <rect x={22} y={-130} width={12} height={70} fill={throne} />
        <path d="M -48 -168 L 22 -168" stroke={throne} strokeWidth={8} strokeLinecap="round" />
        <circle cx={26} cy={-168} r={7} fill={goldC} />
        <line x1={-30} y1={-62} x2={-24} y2={-320} stroke={goldC} strokeWidth={5} strokeLinecap="round" />
        <path d="M -24 -322 l -10 -6 l 10 -8 l 10 8 Z" fill={goldC} />
        <path d="M -12 -210 L -24 -238 L -28 -262" stroke={ivory} strokeWidth={13} strokeLinecap="round" fill="none" />
        <path d={smooth([[-26, -126], [-24, -176], [-18, -212], [10, -216], [16, -184], [10, -140]], true, 0.4)} fill={ivory} stroke={rim(1)} strokeWidth={1.3} />
        <path d="M -20 -212 L 12 -150 L -2 -146 L -24 -196 Z" fill={robe} />
        <path d={smooth([[-34, -122], [-20, -140], [20, -142], [50, -136], [58, -100], [58, -64], [20, -62], [16, -108], [-30, -110]], true, 0.35)} fill={robe} stroke={rim(1)} strokeWidth={1.3} />
        {[-6, 14, 34].map((fx) => (
          <path key={fx} d={`M ${fx} -136 Q ${fx + 10} -118 ${fx + 18} -${fx > 20 ? 66 : 108}`} stroke={tone(robe, -0.22)} strokeWidth={1.6} fill="none" />
        ))}
        <ellipse cx={60} cy={-63} rx={11} ry={4} fill={ivory} />
        <path d="M 6 -206 L 30 -180 L 56 -186" stroke={ivory} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <g transform="translate(58 -190)">
          <path d="M -3 0 L -4 -18 Q 0 -24 4 -18 L 3 0 Z" fill={goldC} />
          <circle cx={0} cy={-22} r={3.4} fill={goldC} />
          <path d="M -2 -16 Q -14 -26 -18 -36 Q -8 -30 0 -20 M 2 -16 Q 14 -26 16 -36 Q 8 -30 0 -20" stroke={goldC} strokeWidth={2.4} fill={goldC} />
        </g>
        <path d={smooth([[-14, -244], [-20, -226], [-16, -212], [-6, -222]], true, 0.5)} fill={tone(ivory, -0.18)} />
        <circle cx={2} cy={-234} r={18} fill={ivory} stroke={rim(1)} strokeWidth={1.3} />
        <path d="M -8 -226 Q -12 -204 4 -198 Q 18 -204 20 -224 Q 12 -220 6 -222 Q -2 -220 -8 -226 Z" fill={tone(ivory, -0.12)} stroke={rim(0.6)} strokeWidth={0.8} />
        <path d="M 18 -236 L 23 -228 L 18 -226" stroke={tone(ivory, -0.3)} strokeWidth={1.4} fill="none" />
        <circle cx={10} cy={-238} r={1.8} fill={tone(ivory, -0.55)} />
        <path d="M -16 -240 Q 2 -258 20 -244" stroke={ink("#7A9A3A")} strokeWidth={4} fill="none" strokeLinecap="round" />
        {[-10, -2, 7, 15].map((lx, i) => (
          <ellipse key={i} cx={lx} cy={-248 - (i === 1 || i === 2 ? 4 : 0)} rx={3.6} ry={2} fill={ink("#9ABA4A")} transform={`rotate(${-30 + i * 20} ${lx} ${-248})`} />
        ))}
      </g>
    </g>
  );
};

/**
 * Bel (Daniel 14), the Babylonian idol: "clay inside and brass outside": a bronze god in a flounced robe with a tall horned
 * crown and a square beard, on a stepped dais. Person scale: dais top at -50, head top -350, crown top -458. `crack` 0..1
 * splits the bronze to show the clay inside; `fall` 0..1 topples it; `glow` lamplit sheen.
 */
export const BelIdol: React.FC<Base & { crack?: number; fall?: number; glow?: number }> = ({ x, y, s = 1, flip = false, crack = 0, fall = 0, glow = 0.3 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const br = ink("#A8783A");
  const dk = tone(br, -0.3);
  const lt = tone(br, 0.25);
  const clay = ink("#B89A72");
  const tiers = 6;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={140} ry={8} fill="rgba(0,0,0,0.35)" />
      {glow > 0 ? <GlowS x={0} y={-240} r={220} squash={1.2} color="255,190,110" opacity={0.4 * glow} /> : null}
      {[0, 1].map((i) => (
        <rect key={i} x={-120 + i * 20} y={-25 - i * 25} width={240 - i * 40} height={25} fill={ink(i ? "#5A4A3A" : "#4A3C30")} stroke={rim(0.8)} strokeWidth={1.2} />
      ))}
      <g transform={`rotate(${fall * 88} 70 -50)`}>
        {Array.from({ length: tiers }, (_, i) => {
          const t0 = i / tiers;
          const yy = lerp(-50, -260, t0);
          const hh = (260 - 50) / tiers;
          const wv = lerp(70, 52, t0);
          return (
            <g key={i}>
              <path d={`M ${-wv} ${yy} L ${-wv + 4} ${yy - hh} L ${wv - 4} ${yy - hh} L ${wv} ${yy} Z`} fill={i % 2 ? br : tone(br, -0.08)} stroke={rim(0.8)} strokeWidth={1.1} />
              {Array.from({ length: 12 }, (_, j) => (
                <path key={j} d={`M ${-wv + j * ((wv * 2) / 12)} ${yy} l ${wv / 12} -8 l ${wv / 12} 8`} stroke={dk} strokeWidth={1.1} fill="none" />
              ))}
            </g>
          );
        })}
        <path d="M -52 -260 L -48 -300 Q 0 -312 48 -300 L 52 -260 Z" fill={br} stroke={rim(0.9)} strokeWidth={1.2} />
        <path d="M -44 -262 Q -60 -230 -30 -214 L 30 -214 Q 60 -230 44 -262" stroke={br} strokeWidth={14} fill="none" strokeLinecap="round" />
        <rect x={-10} y={-232} width={20} height={34} rx={3} fill={lt} stroke={rim(0.8)} strokeWidth={1} />
        <circle cx={0} cy={-246} r={10} fill="none" stroke={lt} strokeWidth={4} />
        <path d="M -30 -344 Q -36 -318 -26 -300 L 26 -300 Q 36 -318 30 -344 Z" fill={dk} />
        <circle cx={0} cy={-328} r={23} fill={br} stroke={rim(1)} strokeWidth={1.3} />
        <path d="M -13 -340 Q 0 -345 13 -340" stroke={dk} strokeWidth={2.6} fill="none" />
        {[-8, 8].map((ex) => (
          <g key={ex}>
            <ellipse cx={ex} cy={-333} rx={4.4} ry={2.6} fill="#EDE2C4" />
            <circle cx={ex} cy={-333} r={1.8} fill="#1A120C" />
          </g>
        ))}
        <path d="M 0 -331 L -3 -321 L 3 -321" stroke={dk} strokeWidth={1.4} fill="none" />
        <path d="M -22 -318 Q -25 -290 -18 -264 L 18 -264 Q 25 -290 22 -318 Q 0 -308 -22 -318 Z" fill={dk} stroke={rim(0.7)} strokeWidth={1} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M -18 ${-306 + i * 9} q 4.5 4 9 0 q 4.5 4 9 0 q 4.5 4 9 0 q 4.5 4 9 0`} stroke={lt} strokeWidth={1.3} fill="none" />
        ))}
        <path d="M -12 -316 Q 0 -309 12 -316" stroke={lt} strokeWidth={2} fill="none" />
        <path d="M -30 -348 L -34 -424 Q 0 -432 34 -424 L 30 -348 Q 0 -342 -30 -348 Z" fill={br} stroke={rim(1)} strokeWidth={1.3} />
        {[0, 1, 2].map((i) => {
          const hy = -364 - i * 20;
          return (
            <g key={i}>
              <path d={`M -32 ${hy} Q -12 ${hy + 12} 0 ${hy + 6} Q 12 ${hy + 12} 32 ${hy}`} stroke={lt} strokeWidth={5} fill="none" strokeLinecap="round" />
              <path d={`M -32 ${hy} q -12 -3 -10 -15 M 32 ${hy} q 12 -3 10 -15`} stroke={lt} strokeWidth={5} fill="none" strokeLinecap="round" />
            </g>
          );
        })}
        <path d="M -30 -350 Q 0 -342 30 -350" stroke={lt} strokeWidth={4} fill="none" />
        <path d="M -24 -428 L -20 -446 L 20 -446 L 24 -428 Z" fill={lt} stroke={rim(0.8)} strokeWidth={1} />
        <circle cx={0} cy={-452} r={6} fill={lt} />
        {crack > 0.01 ? (
          <g opacity={Math.min(1, crack * 1.6)}>
            <path d="M 4 -430 L -6 -380 L 10 -340 L -4 -300 L 14 -250 L -2 -190 L 16 -130 L 2 -60" stroke={clay} strokeWidth={2 + 7 * crack} fill="none" strokeLinejoin="round" />
            <path d="M -2 -190 L -40 -170 M 14 -250 L 46 -236 M 10 -340 L 24 -360" stroke={clay} strokeWidth={1 + 4 * crack} fill="none" />
            {crack > 0.5
              ? [[-50, -150, 30, 26], [40, -220, 26, 30], [-20, -280, 22, 18]].map(([cx, cy, w, h], i) => (
                  <g key={i}>
                    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={clay} />
                    <path d={poly([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2 + 6, cy + h / 2], [cx - w / 2 - 4, cy + h / 2]])} fill={br} stroke={rim(0.7)} strokeWidth={1} transform={`translate(${(i % 2 ? 1 : -1) * 30 * (crack - 0.5)} ${120 * (crack - 0.5) * (crack - 0.5) * 4}) rotate(${(i % 2 ? 40 : -50) * (crack - 0.5)} ${cx} ${cy})`} />
                  </g>
                ))
              : null}
          </g>
        ) : null}
      </g>
    </g>
  );
};

/**
 * The table of Bel's daily provisions (Daniel 14:3): flour cakes, a platter of meat, jars of wine on a linen-draped table.
 * Person scale: w = 340, table top at -88. `eaten` 0..1 empties it (cakes gone, platter bare, jars tipped).
 */
export const BelTable: React.FC<Base & { w?: number; eaten?: number }> = ({ x, y, s = 1, flip = false, w = 340, eaten = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const wood = ink("#5A3E26");
  const hw = w / 2;
  const cakes = Math.round(12 * (1 - eaten));
  const tip = seg(eaten, 0.5, 0.9);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={hw + 30} ry={8} fill="rgba(0,0,0,0.35)" />
      {[-1, 1].map((k) => (
        <path key={k} d={`M ${k * (hw - 24) - 6} -80 L ${k * (hw - 24) - 4} -8 Q ${k * (hw - 24) + 6 * k} 0 ${k * (hw - 24) + 10 * k} -2 L ${k * (hw - 24) + 6} -80 Z`} fill={wood} stroke={rim(0.7)} strokeWidth={1} />
      ))}
      <rect x={-hw} y={-92} width={w} height={10} fill={wood} stroke={rim(0.9)} strokeWidth={1.2} />
      <path d={`M ${-hw - 4} -92 L ${hw + 4} -92 L ${hw} -50 Q ${hw * 0.5} -44 0 -50 Q ${-hw * 0.5} -44 ${-hw} -50 Z`} fill={ink("#E2D8C2")} stroke={rim(0.6)} strokeWidth={1} />
      {Array.from({ length: 24 }, (_, i) => (
        <line key={i} x1={-hw + (i * w) / 23} y1={-50 + Math.sin((i / 23) * Math.PI * 2) * 3} x2={-hw + (i * w) / 23} y2={-42} stroke={ink("#C8A860")} strokeWidth={1.4} />
      ))}
      {Array.from({ length: cakes }, (_, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return <ellipse key={`c${i}`} cx={-hw + 34 + col * 22 + row * 8} cy={-98 - row * 9} rx={14} ry={6} fill={ink("#D8B880")} stroke={rim(0.6)} strokeWidth={0.8} />;
      })}
      <ellipse cx={8} cy={-96} rx={52} ry={9} fill={ink("#B8964A")} stroke={rim(0.8)} strokeWidth={1} />
      {eaten < 0.9 ? (
        <path d={smooth([[-30, -100], [-20, -124], [10, -132], [36, -120], [42, -102]], true, 0.5)} fill={ink("#8A4A2A")} stroke={rim(0.7)} strokeWidth={1} transform={`translate(8 -100) scale(${1 - eaten * 0.9}) translate(-8 100)`} />
      ) : (
        <path d="M -16 -100 L 20 -108 M -4 -98 L 26 -100" stroke={ink("#E2D8C2")} strokeWidth={3} strokeLinecap="round" />
      )}
      {[0, 1, 2].map((i) => {
        const jx = hw - 90 + i * 30;
        return (
          <g key={`j${i}`} transform={`rotate(${tip * (60 + i * 15)} ${jx + 10} -92)`}>
            <path d={`M ${jx - 12} -150 Q ${jx - 18} -124 ${jx - 8} -96 L ${jx + 8} -96 Q ${jx + 18} -124 ${jx + 12} -150 Z M ${jx - 6} -150 L ${jx - 6} -162 L ${jx + 6} -162 L ${jx + 6} -150 Z`} fill={ink(i % 2 ? "#9A5A3A" : "#8A4E30")} stroke={rim(0.8)} strokeWidth={1} />
          </g>
        );
      })}
      {tip > 0.5 ? <ellipse cx={hw - 40} cy={-91} rx={46 * tip} ry={4} fill={ink("#5A1A22")} opacity={0.8} /> : null}
    </g>
  );
};

// ── The temple ───────────────────────────────────────────────────────────────────────────

/**
 * The seven-branched golden lampstand of the temple (relit at the dedication, 1 Maccabees 4:50). Person scale: lamp tops at
 * -h (h = 190), outer arms span ±0.45 h, base 0..-30. `lit` 0..1 lights the lamps one after another from the centre out.
 */
export const TempleMenorah: React.FC<Base & { h?: number; lit?: number; glow?: number }> = ({ x, y, s = 1, h = 190, lit = 1, glow = 1 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const g = ink("#D0A040");
  const g2 = tone(g, 0.3);
  const order = [0, -1, 1, -2, 2, -3, 3];
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={50} ry={5} fill="rgba(0,0,0,0.35)" />
      {lit > 0 ? <GlowS x={0} y={-h - 10} r={h * 0.9} squash={0.55} color="255,200,110" opacity={0.55 * lit * glow} /> : null}
      <path d="M -40 0 L -32 -14 L 32 -14 L 40 0 Z" fill={g} stroke={rim(0.8)} strokeWidth={1.1} />
      <path d="M -28 -14 L -20 -28 L 20 -28 L 28 -14 Z" fill={tone(g, -0.1)} stroke={rim(0.8)} strokeWidth={1.1} />
      <line x1={0} y1={-28} x2={0} y2={-h} stroke={g} strokeWidth={7} strokeLinecap="round" />
      {[1, 2, 3].map((i) => {
        const r = h * 0.15 * i;
        return <path key={i} d={`M ${-r} ${-h} A ${r} ${r} 0 0 0 ${r} ${-h}`} stroke={g} strokeWidth={5} fill="none" strokeLinecap="round" />;
      })}
      {[0.35, 0.55, 0.75].map((t) => (
        <circle key={t} cx={0} cy={lerp(-28, -h, t)} r={6} fill={g2} />
      ))}
      {[1, 2, 3].map((i) =>
        [-1, 1].map((k) => {
          const r = h * 0.15 * i;
          const a = Math.PI / 4;
          return <circle key={`${i}${k}`} cx={k * r * Math.cos(a)} cy={-h + r * Math.sin(a)} r={4.4} fill={g2} />;
        }),
      )}
      {order.map((o, idx) => {
        const lx = o * h * 0.15;
        const a = seg(lit, (idx / 7) * 0.85, (idx / 7) * 0.85 + 0.15);
        const fl = 0.85 + 0.15 * Math.sin(f * 0.37 + idx * 1.3) * Math.sin(f * 0.13 + idx);
        return (
          <g key={o}>
            <path d={`M ${lx - 9} ${-h} L ${lx + 9} ${-h} L ${lx + 6} ${-h + 7} L ${lx - 6} ${-h + 7} Z`} fill={g2} stroke={rim(0.7)} strokeWidth={0.8} />
            {a > 0 ? (
              <>
                <ellipse cx={lx} cy={-h - 10} rx={3.6} ry={9 * fl * a} fill="#FFB050" opacity={0.95} />
                <ellipse cx={lx} cy={-h - 8} rx={1.7} ry={4.4 * a} fill="#FFF2C8" />
              </>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

/**
 * Bronze tablets on stone pillars on Mount Zion (Simon's record, 1 Maccabees 14:26–27, 48). Person scale: pillars 90 tall,
 * tablets from -96 to -320, `n` tablets (default 2), 300 wide for two. `write` 0..1 engraves the lines row by row; `glow`.
 */
export const BronzeTablets: React.FC<Base & { n?: number; write?: number; glow?: number; seed?: string }> = ({ x, y, s = 1, n = 2, write = 1, glow = 0, seed = "bt" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const br = ink("#B07A3A");
  const stone = ink("#9A8E7A");
  const tw = 120;
  const gap = 30;
  const total = n * tw + (n - 1) * gap;
  const rows = 11;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={total * 0.6} ry={7} fill="rgba(0,0,0,0.35)" />
      {glow > 0 ? <GlowS x={0} y={-210} r={total * 0.8} squash={1} color="255,210,140" opacity={0.45 * glow} /> : null}
      {Array.from({ length: n }, (_, i) => {
        const cx = -total / 2 + tw / 2 + i * (tw + gap);
        return (
          <g key={i}>
            <rect x={cx - 34} y={-90} width={68} height={90} fill={stone} stroke={rim(0.8)} strokeWidth={1.2} />
            <rect x={cx - 40} y={-96} width={80} height={10} fill={tone(stone, 0.08)} stroke={rim(0.7)} strokeWidth={1} />
            <path d={`M ${cx - tw / 2} -96 L ${cx - tw / 2} -300 Q ${cx} -330 ${cx + tw / 2} -300 L ${cx + tw / 2} -96 Z`} fill={br} stroke={rim(1)} strokeWidth={1.5} />
            <path d={`M ${cx - tw / 2 + 7} -104 L ${cx - tw / 2 + 7} -296 Q ${cx} -322 ${cx + tw / 2 - 7} -296 L ${cx + tw / 2 - 7} -104 Z`} fill="none" stroke={tone(br, 0.25)} strokeWidth={1.4} />
            {[-1, 1].map((k) =>
              [-290, -110].map((ry) => <circle key={`${k}${ry}`} cx={cx + k * (tw / 2 - 4)} cy={ry} r={2.6} fill={tone(br, 0.35)} />),
            )}
            {Array.from({ length: rows }, (_, r) => {
              const a = seg(write, (r + i * rows) / (rows * n) * 0.9, (r + i * rows) / (rows * n) * 0.9 + 0.1);
              if (a <= 0) return null;
              const ry = -284 + r * 16;
              return (
                <g key={r} opacity={a}>
                  {Array.from({ length: 7 }, (_, j) => {
                    const wl = range(`${seed}${i}${r}${j}`, 6, 12);
                    const xx = cx - tw / 2 + 14 + j * 14;
                    return <line key={j} x1={xx} y1={ry} x2={xx + wl * a} y2={ry} stroke={tone(br, -0.45)} strokeWidth={2} strokeLinecap="round" />;
                  })}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
};

/**
 * Simon's monument at Modin (1 Maccabees 13:27–30): a raised colonnade of polished stone with carved ships and suits of
 * armour, and seven pyramids on top for his father, mother and brothers, "seen of all that sail on the sea". Monumental scale
 * (a man ≈ 40 units): 560 wide, colonnade top -170, pyramid tops up to -282. `built` 0..1 raises the pyramids in turn.
 */
export const ModinMonument: React.FC<Base & { w?: number; built?: number; glow?: number }> = ({ x, y, s = 1, w = 560, built = 1, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const st = ink("#D6CCB6");
  const hw = w / 2;
  const nc = 10;
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={hw + 40} ry={9} fill="rgba(0,0,0,0.3)" />
      {glow > 0 ? <GlowS x={0} y={-200} r={w * 0.7} squash={0.6} color="255,226,170" opacity={0.4 * glow} /> : null}
      <rect x={-hw - 20} y={-18} width={w + 40} height={18} fill={tone(st, -0.1)} stroke={rim(0.8)} strokeWidth={1.2} />
      <rect x={-hw - 8} y={-34} width={w + 16} height={16} fill={tone(st, -0.04)} stroke={rim(0.8)} strokeWidth={1.1} />
      <rect x={-hw} y={-138} width={w} height={104} fill={tone(st, -0.45)} />
      {Array.from({ length: nc }, (_, i) => {
        const cx = -hw + 14 + i * ((w - 28) / (nc - 1));
        return <rect key={i} x={cx - 8} y={-140} width={16} height={106} fill={st} stroke={rim(0.8)} strokeWidth={1} />;
      })}
      <rect x={-hw - 6} y={-172} width={w + 12} height={34} fill={tone(st, 0.04)} stroke={rim(0.9)} strokeWidth={1.2} />
      {Array.from({ length: 8 }, (_, i) => {
        const cx = -hw + 34 + i * ((w - 68) / 7);
        return i % 2 ? (
          <path key={i} d={`M ${cx - 10} -162 L ${cx + 10} -162 L ${cx + 8} -150 Q ${cx} -146 ${cx - 8} -150 Z M ${cx - 4} -166 L ${cx + 4} -166`} stroke={tone(st, -0.35)} strokeWidth={1.4} fill="none" />
        ) : (
          <path key={i} d={`M ${cx - 16} -150 Q ${cx} -144 ${cx + 16} -150 L ${cx + 12} -156 L ${cx - 12} -156 Z M ${cx} -156 L ${cx} -168 L ${cx + 9} -160 Z`} stroke={tone(st, -0.35)} strokeWidth={1.3} fill="none" />
        );
      })}
      {Array.from({ length: 7 }, (_, i) => {
        const a = seg(built, i / 7, (i + 1) / 7);
        if (a <= 0) return null;
        const pw = (w / 7) * 0.97;
        const cx = -hw + (w / 7) * (i + 0.5);
        const ph = (i === 0 || i === 1 ? 112 : 96) * a;
        return (
          <g key={`p${i}`}>
            <path d={`M ${cx - pw / 2} -172 L ${cx} ${-172 - ph} L ${cx + pw / 2} -172 Z`} fill={st} stroke={rim(1)} strokeWidth={1.3} />
            <path d={`M ${cx} ${-172 - ph} L ${cx + pw / 2} -172 L ${cx + pw * 0.12} -172 Z`} fill={tone(st, -0.16)} />
          </g>
        );
      })}
    </g>
  );
};

// ── Job ──────────────────────────────────────────────────────────────────────────────────

/**
 * The ash heap outside the town where Job sat (Job 2:8): a low mound of grey ash and refuse with potsherds, faint embers and
 * smoke. Person scale: w = 320, top at -48 (`seat`: a Person at x = 0, y = 0 with pose sit: 1 sits on the top).
 * `smoke` 0..1, `ember` 0..1.
 */
export const AshHeap: React.FC<Base & { w?: number; seat?: React.ReactNode; smoke?: number; ember?: number; seed?: string }> = ({ x, y, s = 1, flip = false, w = 320, seat, smoke = 0.4, ember = 0.3, seed = "ah" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const ash = ink("#5E5A56");
  const hw = w / 2;
  const top = -48;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={2} rx={hw + 30} ry={10} fill="rgba(0,0,0,0.35)" />
      {smoke > 0 ? <Smoke x={-hw * 0.4} y={top + 10} s={0.9} n={8} life={180} rise={0.6} drift={0.2} color="120,114,108" opacity={0.35 * smoke} seed={`${seed}s`} /> : null}
      <path d={`M ${-hw} 2 Q ${-hw * 0.55} ${top * 0.7} ${-hw * 0.15} ${top} Q ${hw * 0.2} ${top - 6} ${hw * 0.5} ${top * 0.6} Q ${hw * 0.8} ${top * 0.25} ${hw} 2 Z`} fill={ash} stroke={rim(0.7)} strokeWidth={1.3} />
      <path d={`M ${-hw * 0.7} ${top * 0.45} Q ${-hw * 0.2} ${top * 0.95} ${hw * 0.4} ${top * 0.7}`} stroke={tone(ash, 0.18)} strokeWidth={6} fill="none" opacity={0.5} />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={range(`${seed}x${i}`, -hw * 0.85, hw * 0.85)} cy={-range(`${seed}y${i}`, 2, 36) * (1 - Math.pow(range(`${seed}x${i}`, -0.85, 0.85), 2))} r={range(`${seed}r${i}`, 1, 2.6)} fill={i % 3 ? tone(ash, 0.25) : tone(ash, -0.3)} />
      ))}
      {Array.from({ length: 7 }, (_, i) => {
        const px = range(`${seed}px${i}`, -hw * 0.9, hw * 0.9);
        return <path key={`p${i}`} d={`M ${px - 9} -2 Q ${px} -12 ${px + 10} -3 L ${px + 7} 0 Q ${px} -7 ${px - 6} 1 Z`} fill={ink(i % 2 ? "#8A5A3A" : "#9A6A44")} transform={`rotate(${range(`${seed}pr${i}`, -30, 30)} ${px} -4)`} />;
      })}
      {ember > 0
        ? Array.from({ length: 8 }, (_, i) => (
            <circle key={`e${i}`} cx={range(`${seed}ex${i}`, -hw * 0.6, hw * 0.6)} cy={-range(`${seed}ey${i}`, 4, 22)} r={1.8} fill={`rgba(255,${130 + 70 * Math.sin(f * 0.15 + i)},50,${(0.7 * ember).toFixed(3)})`} />
          ))
        : null}
      <NoScale>
        <g transform={`translate(0 ${top + 4})`}>{seat}</g>
      </NoScale>
    </g>
  );
};

// ── Jonah ────────────────────────────────────────────────────────────────────────────────

/**
 * A Phoenician merchant ship of Joppa bound for Tarshish (Jonah 1), facing right, the anchor on the waterline amidships.
 * Person scale, measured from the waterline: len 1400 (bow +700), deck 138 above the water (the bulwark top 14 higher hides
 * the crew's feet), mast top 764 above, keel 54 below (hide it by placing the ship in a water band's children). `sail` 0..1 sets the striped square sail (0 furled on the yard);
 * `storm` 0..1 flaps the sail and tosses the ship (automatic pitch/heave unless `pitch`/`heave` are given; `roll` leans the
 * rig); `cargo` 0..1 jars on deck; `jettison` 0..1 throws four jars overboard; `oars` 0..1 runs out the oars (`row` phase);
 * `crew` stand on deck (a Person at x, y = 0, |x| < 400); `below` is drawn in a cutaway of the hold (a Person at x = 0, y = 0
 * lies on the hold floor; Lying works); `lit` lights a stern lantern.
 */
export const TarshishShip: React.FC<Base & {
  len?: number;
  sail?: number;
  storm?: number;
  pitch?: number;
  heave?: number;
  roll?: number;
  cargo?: number;
  jettison?: number;
  oars?: number;
  row?: number;
  crew?: React.ReactNode;
  below?: React.ReactNode;
  lit?: number;
  seed?: string;
  color?: string;
  sailColor?: string;
}> = ({ x, y, s = 1, flip = false, len = 1400, sail = 1, storm = 0, pitch, heave, roll, cargo = 1, jettison = 0, oars = 0, row, crew, below, lit = 0, seed = "ms", color = "#5A3C26", sailColor = "#6A2A4A" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const clip = useUid("msc");
  const L = len / 2;
  const ph = random(seed) * 6;
  const pt = pitch ?? storm * 6 * Math.sin(f * 0.045 + ph) + 0.6 * Math.sin(f * 0.03 + ph);
  const hv = heave ?? storm * 12 * Math.sin(f * 0.06 + ph) + 1.5 * Math.sin(f * 0.04 + ph);
  const rl = roll ?? storm * 5 * Math.sin(f * 0.037 + ph + 1);
  const wood = ink(color);
  const deck = -104;
  const mastX = L * 0.04;
  const mastTop = -730;
  const yardY = mastTop + 40;
  const yardW = L * 0.46;
  const sailH = 380 * Math.max(0.05, sail);
  const flap = storm * 18;
  const hull: Pt[] = [
    [-0.98 * L, -232], [-0.9 * L, -170], [-0.75 * L, -136], [-0.4 * L, -120], [0, -116], [0.4 * L, -120], [0.75 * L, -138], [0.92 * L, -176], [1.0 * L, -216],
    [0.97 * L, -150], [0.9 * L, -60], [0.78 * L, 10], [0.45 * L, 70], [0, 88], [-0.45 * L, 70], [-0.78 * L, 14], [-0.92 * L, -60], [-0.96 * L, -150],
  ];
  const sheer = (xx: number) => -116 - 60 * Math.pow(Math.abs(xx) / L, 2.4) * (xx < 0 ? 1.1 : 1);
  const sheerPath = (off: number, x0 = -0.93 * L, x1 = 0.95 * L) => {
    const pts: string[] = [];
    for (let i = 0; i <= 24; i++) {
      const xx = lerp(x0, x1, i / 24);
      pts.push(`${i ? "L" : "M"} ${xx.toFixed(1)} ${(sheer(xx) + off).toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const sailPts = (): string => {
    const l = mastX - yardW;
    const r = mastX + yardW;
    const top = yardY + 6;
    const bot = yardY + sailH;
    const bl = Math.sin(f * 0.2 + ph) * flap;
    const br = Math.sin(f * 0.23 + ph + 2) * flap;
    return `M ${l} ${top} L ${r} ${top} Q ${r + 30 + br} ${(top + bot) / 2} ${r + 10 + br} ${bot + br * 0.5} Q ${mastX + 40 * sail} ${bot + 44 * sail + Math.sin(f * 0.17) * flap} ${l - 10 + bl} ${bot + bl * 0.5} Q ${l + 20 + bl} ${(top + bot) / 2} ${l} ${top} Z`;
  };
  const jars = Array.from({ length: Math.round(9 * cargo) }, (_, i) => ({ x: -0.55 * L + i * 40 + (i % 2) * 8, h: 52 + (i % 3) * 8 }));
  const thrown = [0, 1, 2, 3].map((j) => {
    const t = seg(jettison, j * 0.18, j * 0.18 + 0.4);
    return { t, x0: -0.4 * L + j * 60 };
  });
  return (
    <g transform={`translate(${x} ${gy + hv - 34 * s}) scale(${flip ? -s : s} ${s}) rotate(${-pt})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={-0.36 * L} y={deck + 8} width={0.42 * L} height={-deck - 22} rx={6} />
        </clipPath>
      </defs>
      <g transform={`rotate(${rl * 0.6} ${mastX} ${deck})`}>
        <line x1={mastX} y1={deck + 4} x2={mastX} y2={mastTop} stroke={ink("#4A3220")} strokeWidth={12} strokeLinecap="round" />
        <path d={`M ${mastX} ${mastTop} L ${0.98 * L} -212 M ${mastX} ${mastTop} L ${-0.94 * L} -226`} stroke={ink("#8A7458")} strokeWidth={2} fill="none" />
        <path d={`M ${mastX} ${mastTop} L ${mastX - yardW} ${yardY} M ${mastX} ${mastTop} L ${mastX + yardW} ${yardY}`} stroke={ink("#8A7458")} strokeWidth={1.4} fill="none" />
        {sail > 0.05 ? (
          <>
            <path d={sailPts()} fill={ink("#E6DCC4")} stroke={rim(0.9)} strokeWidth={1.4} />
            {Array.from({ length: 6 }, (_, i) => {
              const xx = mastX - yardW + (i + 0.5) * ((yardW * 2) / 6);
              return i % 2 ? null : <path key={i} d={`M ${xx - yardW / 6} ${yardY + 6} L ${xx + yardW / 6} ${yardY + 6} L ${xx + yardW / 6 + 4} ${yardY + sailH * 0.98} L ${xx - yardW / 6 + 2} ${yardY + sailH * 0.98} Z`} fill={ink(sailColor)} opacity={0.85} />;
            })}
            {[0.33, 0.66].map((t) => (
              <path key={t} d={`M ${mastX - yardW} ${yardY + sailH * t} Q ${mastX} ${yardY + sailH * t + 20 * sail} ${mastX + yardW} ${yardY + sailH * t}`} stroke={ink("#8A7458")} strokeWidth={1} fill="none" opacity={0.6} />
            ))}
            <path d={`M ${mastX - yardW - 10} ${yardY + sailH} L ${-0.6 * L} ${deck - 8} M ${mastX + yardW + 10} ${yardY + sailH} L ${0.6 * L} ${deck - 8}`} stroke={ink("#8A7458")} strokeWidth={1.4} fill="none" />
          </>
        ) : (
          <path d={`M ${mastX - yardW} ${yardY + 10} Q ${mastX} ${yardY + 30} ${mastX + yardW} ${yardY + 10}`} stroke={ink("#D8CCB0")} strokeWidth={16} strokeLinecap="round" fill="none" />
        )}
        <line x1={mastX - yardW - 14} y1={yardY + 2} x2={mastX + yardW + 14} y2={yardY + 2} stroke={ink("#4A3220")} strokeWidth={8} strokeLinecap="round" />
        <rect x={mastX - 16} y={mastTop - 18} width={32} height={22} rx={4} fill={ink("#4A3220")} />
      </g>
      {jars.map((j, i) => (
        <path key={`cj${i}`} d={`M ${j.x - 13} ${deck - j.h} Q ${j.x - 19} ${deck - j.h * 0.5} ${j.x - 7} ${deck + 4} L ${j.x + 7} ${deck + 4} Q ${j.x + 19} ${deck - j.h * 0.5} ${j.x + 13} ${deck - j.h} Z`} fill={ink(i % 2 ? "#9A5E3A" : "#A8704A")} stroke={rim(0.7)} strokeWidth={1} />
      ))}
      {cargo > 0 ? <rect x={0.18 * L} y={deck - 44} width={110} height={48} rx={8} fill={ink("#7A6A4A")} stroke={rim(0.7)} strokeWidth={1} /> : null}
      <NoScale>
        <g transform={`translate(0 ${deck})`}>{crew}</g>
      </NoScale>
      <path d={smooth(hull, true, 0.35)} fill={wood} stroke={rim(1)} strokeWidth={1.8} />
      {[12, 30, 50, 72].map((o) => (
        <path key={o} d={sheerPath(o)} stroke={tone(wood, -0.3)} strokeWidth={1.4} fill="none" opacity={0.8} />
      ))}
      <path d={sheerPath(4)} stroke={ink("#B8863A")} strokeWidth={5} fill="none" />
      <path d={sheerPath(-2, -0.9 * L, 0.93 * L)} stroke={tone(wood, 0.25)} strokeWidth={3} fill="none" />
      <path d={`M ${-0.98 * L} -232 Q ${-1.06 * L} -270 ${-1.0 * L} -292 Q ${-0.94 * L} -296 ${-0.95 * L} -276`} stroke={wood} strokeWidth={14} fill="none" strokeLinecap="round" />
      <path d={`M ${1.0 * L} -216 Q ${1.05 * L} -246 ${1.02 * L} -262`} stroke={wood} strokeWidth={14} fill="none" strokeLinecap="round" />
      <circle cx={1.02 * L} cy={-266} r={10} fill={tone(wood, 0.1)} />
      <path d={`M ${0.83 * L} -122 Q ${0.86 * L} -134 ${0.89 * L} -122 Q ${0.86 * L} -112 ${0.83 * L} -122 Z`} fill={ink("#E8E0D0")} />
      <circle cx={0.862 * L} cy={-122} r={4.6} fill={ink("#1A1410")} />
      {below ? (
        <g>
          <rect x={-0.36 * L - 6} y={deck + 2} width={0.42 * L + 12} height={-deck - 10} rx={8} fill={tone(wood, -0.5)} stroke={tone(wood, 0.2)} strokeWidth={2} />
          <g clipPath={`url(#${clip})`}>
            <rect x={-0.36 * L} y={deck + 8} width={0.42 * L} height={-deck - 22} fill="#140C08" />
            {[0.1, 0.35, 0.6, 0.85].map((t) => (
              <line key={t} x1={-0.36 * L + t * 0.42 * L} y1={deck + 8} x2={-0.36 * L + t * 0.42 * L} y2={-14} stroke="rgba(120,80,50,0.35)" strokeWidth={6} />
            ))}
            <GlowS x={-0.3 * L} y={deck + 30} r={160} squash={0.6} color="255,170,90" opacity={0.45} />
            <ellipse cx={-0.3 * L} cy={deck + 26} rx={4} ry={8} fill="#FFB050" />
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M ${-0.02 * L + i * 26 - 10} -16 Q ${-0.02 * L + i * 26 - 14} -40 ${-0.02 * L + i * 26 - 6} -60 L ${-0.02 * L + i * 26 + 6} -60 Q ${-0.02 * L + i * 26 + 14} -40 ${-0.02 * L + i * 26 + 10} -16 Z`} fill="#5A3A26" />
            ))}
            <NoScale>
              <g transform={`translate(${-0.17 * L} -16)`}>{below}</g>
            </NoScale>
          </g>
        </g>
      ) : null}
      <g transform={`rotate(${Math.sin(f * 0.03) * 3 * (1 + storm)} ${-0.8 * L} -150)`}>
        <line x1={-0.78 * L} y1={-170} x2={-0.95 * L} y2={60} stroke={ink("#4A3220")} strokeWidth={9} strokeLinecap="round" />
        <path d={`M ${-0.93 * L} 10 L ${-0.9 * L} 90 L ${-0.99 * L} 96 L ${-0.98 * L} 16 Z`} fill={ink("#4A3220")} />
      </g>
      {oars > 0.01
        ? Array.from({ length: 9 }, (_, i) => {
            const ox = lerp(-0.55 * L, 0.5 * L, i / 8);
            const a = Math.sin((row ?? f * 0.18) + i * 0.15) * 16;
            const by = sheer(ox) + 14;
            const e = [ox + Math.sin((20 + a) * D) * 190 * oars, by + Math.cos((20 + a) * D) * 190 * oars];
            return <line key={`o${i}`} x1={ox} y1={by} x2={e[0]} y2={e[1]} stroke={ink("#7A5A36")} strokeWidth={5} strokeLinecap="round" />;
          })
        : null}
      {thrown.map((j, i) =>
        j.t > 0 && j.t < 1 ? (
          <g key={`th${i}`} transform={`translate(${j.x0 + j.t * 60} ${deck - 70 + j.t * j.t * 300 - j.t * 60}) rotate(${j.t * 160})`}>
            <path d="M -13 -30 Q -19 0 -7 30 L 7 30 Q 19 0 13 -30 Z" fill={ink("#A8704A")} stroke={rim(0.8)} strokeWidth={1} />
          </g>
        ) : null,
      )}
      {lit > 0 ? (
        <>
          <GlowS x={-0.9 * L} y={-250} r={140} color="255,180,90" opacity={0.6 * lit} />
          <circle cx={-0.9 * L} cy={-250} r={7} fill="#FFD27A" opacity={lit} />
        </>
      ) : null}
    </g>
  );
};

/**
 * Jonah's plant (Jonah 4:6–7): a broad-leaved vine that springs up beside the booth, climbs and spreads over it to the left
 * (flip: right), then withers when the worm attacks it at dawn. Person scale: rises h = 290, spreads w = 240.
 * `grow` 0..1; `wither` 0..1 (leaves yellow, droop, shrink and fall); `worm` 0..1 shows the small worm gnawing the stem.
 */
export const Gourd: React.FC<Base & { h?: number; w?: number; grow?: number; wither?: number; worm?: number }> = ({ x, y, s = 1, flip = false, h = 290, w = 240, grow = 1, wither = 0, worm = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  if (grow <= 0) return null;
  const pts: Pt[] = [[0, 0], [4, -0.25 * h], [-2, -0.5 * h], [-0.08 * w, -0.75 * h], [-0.3 * w, -0.93 * h], [-0.6 * w, -1.0 * h], [-0.85 * w, -0.98 * h], [-w, -0.92 * h]];
  const segL = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = segL.reduce((a, b) => a + b, 0);
  const at = (t: number): Pt => {
    let d = t * total;
    for (let i = 0; i < segL.length; i++) {
      if (d <= segL[i]) return [lerp(pts[i][0], pts[i + 1][0], d / segL[i]), lerp(pts[i][1], pts[i + 1][1], d / segL[i])];
      d -= segL[i];
    }
    return pts[pts.length - 1];
  };
  const green = mixHex(mixHex("#46642E", "#9A8A3A", Math.min(1, wither * 1.6)), "#5A4428", Math.max(0, wither * 1.6 - 0.6));
  const leafC = ink(green);
  const stemC = ink(mixHex("#4A6A2A", "#5A4A30", wither));
  const leaf = (r: number) => {
    const lp: Pt[] = [];
    for (let i = 0; i < 14; i++) {
      const a = Math.PI / 2 + (i / 14) * Math.PI * 2;
      const rr = r * (i === 0 ? 0.35 : i % 2 ? 0.8 : 1);
      lp.push([Math.cos(a) * rr * 0.95, Math.sin(a) * rr * 0.9 - r * 0.9]);
    }
    return smooth(lp, true, 0.6);
  };
  const stemD = smooth(pts, false, 0.5);
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const t = 0.1 + i * 0.105;
    const a = seg(grow, t, t + 0.18);
    return { t, a, side: i % 2 ? 1 : -1, r: 34 + (i % 3) * 8 };
  });
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <path d={stemD} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - grow} stroke={stemC} strokeWidth={6} fill="none" strokeLinecap="round" />
      {leaves.map((l, i) => {
        if (l.a <= 0) return null;
        const fallen = wither > 0.65 && i % 3 === 0;
        const p = at(l.t);
        const sway = Math.sin(f * 0.04 + i) * 3 * (1 - wither);
        const droop = wither * 60;
        const sc = l.a * (1 - wither * 0.35);
        if (fallen) {
          const fx = p[0] + l.side * 30;
          return <path key={i} d={leaf(l.r * 0.7)} fill={tone(leafC, -0.1)} transform={`translate(${fx} -4) rotate(${80 * l.side}) scale(0.7 0.3)`} opacity={0.9} />;
        }
        const ang = l.side * (55 + droop) + sway;
        return (
          <g key={i} transform={`translate(${p[0]} ${p[1]}) rotate(${ang}) scale(${sc})`}>
            <line x1={0} y1={0} x2={0} y2={-l.r * 0.72} stroke={stemC} strokeWidth={3} />
            <path d={leaf(l.r)} fill={leafC} stroke={rim(0.6)} strokeWidth={1} transform={`translate(0 ${-l.r * 0.2})`} />
            <path d={`M 0 ${-l.r * 0.76} L 0 ${-l.r * 1.85} M 0 ${-l.r * 0.9} L ${-l.r * 0.62} ${-l.r * 1.5} M 0 ${-l.r * 0.9} L ${l.r * 0.62} ${-l.r * 1.5} M 0 ${-l.r * 0.85} L ${-l.r * 0.8} ${-l.r * 1.0} M 0 ${-l.r * 0.85} L ${l.r * 0.8} ${-l.r * 1.0}`} stroke={tone(leafC, 0.18)} strokeWidth={1.2} />
          </g>
        );
      })}
      {worm > 0.01 ? (
        <g opacity={Math.min(1, worm * 2)}>
          <path d="M 3 -14 L 3 -6" stroke={ink("#2A2016")} strokeWidth={5} opacity={Math.min(1, worm)} />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={12 + i * 5.5} cy={-8 + Math.sin(i * 1.2 + f * 0.2) * 1.4} r={3.4 - i * 0.3} fill={ink("#D8D0A8")} />
          ))}
          <circle cx={8} cy={-9} r={3.6} fill={ink("#8A7A50")} />
        </g>
      ) : null}
    </g>
  );
};

/**
 * Jonah's booth east of Nineveh (Jonah 4:5): two forked poles, a cross pole and a roof of leafy branches and an old cloth.
 * Person scale: w = 280, roof underside at -h (h = 205; a seated Person fits under it). `under` is drawn between the back
 * and front of the booth (a Person at x, y = 0); `wither` 0..1 dries the branches.
 */
export const BranchBooth: React.FC<Base & { w?: number; h?: number; wither?: number; under?: React.ReactNode; seed?: string }> = ({ x, y, s = 1, flip = false, w = 280, h = 205, wither = 0, under, seed = "bb" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const wood = ink("#5A4430");
  const leafC = ink(mixHex("#4A5A2E", "#7A6838", wither));
  const hw = w / 2;
  const blobs = Array.from({ length: 16 }, (_, i) => ({ x: range(`${seed}x${i}`, -hw - 20, hw + 20), y: -h - range(`${seed}y${i}`, 4, 34), r: range(`${seed}r${i}`, 14, 26) * (1 - wither * 0.3) }));
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={hw + 40} ry={7} fill="rgba(0,0,0,0.3)" />
      <line x1={-hw + 30} y1={0} x2={-hw + 36} y2={-h - 10} stroke={tone(wood, -0.3)} strokeWidth={8} />
      <line x1={hw + 20} y1={0} x2={hw + 14} y2={-h - 10} stroke={tone(wood, -0.3)} strokeWidth={8} />
      <NoScale>{under}</NoScale>
      <path d={`M ${-hw - 30} ${-h + 4} L ${hw + 34} ${-h - 8} L ${hw + 20} ${-h + 46} Q ${hw * 0.3} ${-h + 30} ${-hw * 0.2} ${-h + 52} Q ${-hw * 0.7} ${-h + 34} ${-hw - 26} ${-h + 40} Z`} fill={ink("#8A7A5E")} stroke={rim(0.7)} strokeWidth={1} opacity={0.95} />
      {blobs.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={i % 3 ? leafC : tone(leafC, -0.2)} />
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const bx = -hw - 20 + i * ((w + 40) / 8);
        return <path key={`b${i}`} d={`M ${bx} ${-h - 10} q ${10 - i * 2} -20 ${20 - i * 3} -34`} stroke={wood} strokeWidth={2} fill="none" />;
      })}
      <line x1={-hw - 36} y1={-h} x2={hw + 40} y2={-h - 12} stroke={wood} strokeWidth={7} strokeLinecap="round" />
      <path d={`M ${-hw} 0 L ${-hw + 4} ${-h - 4} M ${-hw + 4} ${-h - 4} l -8 -14 M ${-hw + 4} ${-h - 4} l 8 -14`} stroke={wood} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d={`M ${hw} 0 L ${hw - 4} ${-h - 14} M ${hw - 4} ${-h - 14} l -8 -14 M ${hw - 4} ${-h - 14} l 8 -14`} stroke={wood} strokeWidth={9} fill="none" strokeLinecap="round" />
    </g>
  );
};

// ── Baruch ───────────────────────────────────────────────────────────────────────────────

/**
 * An unrolled reading scroll on two wooden rollers (Baruch reads the book, Baruch 1:3), centred at (x, y) — in a band, give
 * y explicitly (a reader's hands are near ridgeY - 95 * s * k for a standing Person with arms forward). Person scale:
 * w = 150 open width, h = 96. `open` 0..1 unrolls it; `write` 0..1 reveals the lines; `tilt` degrees; `glow` 0..1.
 */
export const UnrolledScroll: React.FC<{ x: number; y?: number; s?: number; w?: number; h?: number; open?: number; write?: number; tilt?: number; glow?: number; seed?: string }> = ({
  x,
  y,
  s = 1,
  w = 150,
  h = 96,
  open = 1,
  write = 1,
  tilt = 0,
  glow = 0,
  seed = "us",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const hw = (w / 2) * Math.max(0.08, open);
  const parch = ink("#E8DCC0");
  const wood = ink("#5A3A22");
  const rows = 7;
  return (
    <g transform={`translate(${x} ${gy}) rotate(${tilt}) scale(${s})`}>
      {glow > 0 ? <GlowS x={0} y={0} r={w * 0.9} squash={0.7} color="255,226,170" opacity={0.5 * glow} /> : null}
      <path d={`M ${-hw} ${-h / 2} Q 0 ${-h / 2 - 5} ${hw} ${-h / 2} L ${hw} ${h / 2} Q 0 ${h / 2 + 5} ${-hw} ${h / 2} Z`} fill={parch} stroke={rim(0.8)} strokeWidth={1} />
      {open > 0.3
        ? Array.from({ length: rows }, (_, r) => {
            const a = seg(write, r / rows * 0.9, r / rows * 0.9 + 0.12);
            if (a <= 0) return null;
            const ry = -h / 2 + 14 + r * ((h - 26) / (rows - 1));
            return (
              <g key={r} opacity={a}>
                {[-1, 1].map((col) =>
                  Array.from({ length: 4 }, (_, j) => {
                    const wl = range(`${seed}${r}${col}${j}`, 5, 11) * Math.min(1, open);
                    const xx = col * (hw * 0.08) + (col < 0 ? -hw + 10 : hw * 0.12) + j * (hw * 0.21);
                    return <line key={`${col}${j}`} x1={xx} y1={ry} x2={xx + wl} y2={ry} stroke={ink("#3A2A1E")} strokeWidth={1.6} strokeLinecap="round" />;
                  }),
                )}
              </g>
            );
          })
        : null}
      {[-1, 1].map((k) => (
        <g key={k}>
          <rect x={k * hw - 7} y={-h / 2 - 4} width={14} height={h + 8} rx={6} fill={ink("#D8CCAE")} stroke={rim(0.7)} strokeWidth={1} />
          <line x1={k * hw} y1={-h / 2 - 16} x2={k * hw} y2={h / 2 + 16} stroke={wood} strokeWidth={4} strokeLinecap="round" />
          <circle cx={k * hw} cy={-h / 2 - 17} r={4} fill={wood} />
          <circle cx={k * hw} cy={h / 2 + 17} r={4} fill={wood} />
        </g>
      ))}
    </g>
  );
};

/**
 * A weeping willow by the rivers of Babylon with lyres hung on its branches (Psalm 137 mood, Baruch). Person scale: crown top
 * at -380, branches trail to about -40. `harps` 0..3 lyres; branches sway gently.
 */
export const WillowHarps: React.FC<Base & { harps?: number; seed?: string }> = ({ x, y, s = 1, flip = false, harps = 2, seed = "wh" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const bark = ink("#4A3A2A");
  const leaf = ink("#5A6A3A");
  const crown: Pt[] = [[-150, -250], [-90, -340], [10, -370], [110, -332], [160, -240]];
  const canopy = Array.from({ length: 14 }, (_, i) => {
    const c = crown[i % crown.length];
    return { x: c[0] + range(`${seed}cx${i}`, -50, 50), y: c[1] + range(`${seed}cy${i}`, -20, 40), r: range(`${seed}cr${i}`, 34, 56) };
  });
  const lyre = (lx: number, ly: number, key: string) => {
    const sw = Math.sin(f * 0.04 + lx) * 3;
    return (
      <g key={key} transform={`rotate(${sw} ${lx} ${ly})`}>
        <line x1={lx} y1={ly} x2={lx} y2={ly + 30} stroke={ink("#8A7458")} strokeWidth={1} />
        <g transform={`translate(${lx} ${ly + 74})`}>
          <path d="M -12 0 Q -18 -24 -9 -44 M 12 0 Q 20 -24 13 -46" stroke={ink("#8A5A30")} strokeWidth={3.6} fill="none" strokeLinecap="round" />
          <line x1={-12} y1={-42} x2={16} y2={-45} stroke={ink("#8A5A30")} strokeWidth={3} strokeLinecap="round" />
          <path d="M -14 -2 Q 0 8 14 -2 Z" fill={ink("#8A5A30")} />
          {[-6, -3, 0, 3, 6].map((o) => (
            <line key={o} x1={o} y1={-1} x2={o * 1.2 + 1.5} y2={-43} stroke="rgba(240,226,190,0.8)" strokeWidth={0.7} />
          ))}
        </g>
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={90} ry={7} fill="rgba(0,0,0,0.3)" />
      <path d="M -18 0 Q -24 -120 -4 -220 L 14 -220 Q 6 -110 20 0 Z" fill={bark} stroke={rim(0.8)} strokeWidth={1.3} />
      {crown.map((c, i) => (
        <path key={`bo${i}`} d={`M 4 -214 Q ${c[0] * 0.5} ${c[1] + 40} ${c[0]} ${c[1]}`} stroke={bark} strokeWidth={6 - Math.abs(i - 2)} fill="none" strokeLinecap="round" />
      ))}
      {canopy.map((b, i) => (
        <ellipse key={`cn${i}`} cx={b.x} cy={b.y} rx={b.r * 1.1} ry={b.r * 0.8} fill={i % 2 ? tone(leaf, -0.18) : tone(leaf, -0.08)} opacity={0.92} />
      ))}
      {Array.from({ length: 64 }, (_, i) => {
        const c = crown[i % crown.length];
        const bx = c[0] + range(`${seed}bx${i}`, -60, 60);
        const by = c[1] + range(`${seed}by${i}`, 0, 40);
        const len = range(`${seed}l${i}`, 150, 290);
        const sw = Math.sin(f * 0.03 + i * 0.7) * 10;
        return <path key={i} d={`M ${bx} ${by} Q ${bx + sw * 0.5 + (bx > 0 ? 18 : -18)} ${by + len * 0.4} ${bx + sw} ${by + len}`} stroke={i % 3 ? leaf : tone(leaf, 0.18)} strokeWidth={3.2} fill="none" opacity={0.9} strokeLinecap="round" />;
      })}
      {harps > 0 ? lyre(-110, -280, "h0") : null}
      {harps > 1 ? lyre(96, -300, "h1") : null}
      {harps > 2 ? lyre(-10, -340, "h2") : null}
    </g>
  );
};

// ── Crowds ───────────────────────────────────────────────────────────────────────────────

const CROWD_ROBES = ["#5E4432", "#4E5634", "#34465E", "#7A5A2A", "#5A2234", "#5A5650", "#2E5050", "#6A4A3A"];
const SACK_ROBES = ["#4E4638", "#5A5040", "#463E32", "#524A3C"];

/**
 * A crowd as small silhouettes (monumental scale: `size` 40 = a man), cheaper than Person: robed men and veiled women in
 * loose rows. Faces right (flip: left). `bow` 0..1 makes them kneel and bow to the ground in a ripple (Daniel 3:7);
 * `kneel` 0..1 kneels upright; `arms` 0..1 lifts their hands in prayer or praise; `sack` 0..1 dresses them in sackcloth
 * (Nineveh, Jonah 3:5); `march` 0..1 walks them; `p` 0..1 reveals them from the leading edge; `veils` share of women.
 */
export const Populace: React.FC<{
  x0: number;
  x1: number;
  n?: number;
  rows?: number;
  seed?: string;
  size?: number;
  bow?: number;
  kneel?: number;
  arms?: number;
  sack?: number;
  march?: number;
  p?: number;
  flip?: boolean;
  veils?: number;
  colors?: string[];
}> = ({ x0, x1, n = 20, rows = 2, seed = "pq", size = 40, bow = 0, kneel = 0, arms = 0, sack = 0, march = 0, p = 1, flip = false, veils = 0.35, colors = CROWD_ROBES }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const k = band.k;
  const d = flip ? -1 : 1;
  if (p <= 0) return null;
  const skin = ink("#5A3E2C");
  const figs: React.ReactNode[] = [];
  for (let r = rows - 1; r >= 0; r--) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5 * (r % 2) + range(`${seed}j${r}${i}`, -0.25, 0.25)) / n;
      const lead = flip ? 1 - t : t;
      if (lead > p) continue;
      const xx = x0 + (x1 - x0) * t;
      const H = range(`${seed}h${r}${i}`, 0.88, 1.06) * size * k;
      const ph = f * 0.28 + i * 1.7 + r;
      const yy = band.gy(xx) - r * 0.18 * size * k + (march > 0 ? -Math.abs(Math.sin(ph)) * 0.04 * H * march : 0);
      const delay = random(`${seed}d${r}${i}`) * 0.3;
      const bw = seg(bow, delay, delay + 0.7);
      const kb = Math.max(bw, seg(kneel, delay, delay + 0.7));
      const woman = random(`${seed}w${r}${i}`) < veils;
      const base = colors[Math.floor(random(`${seed}c${r}${i}`) * colors.length)];
      const sk = SACK_ROBES[(i + r) % SACK_ROBES.length];
      const col = mixHex(mixHex(ink(mixHex(base, sk, sack)), "#000000", r * 0.16), "#000000", 0);
      const th = bw * 80;
      const hipY = yy - H * lerp(0.46, 0.2, kb);
      const hip: Pt = [xx, hipY];
      const T = H * 0.34;
      const S: Pt = [xx + d * Math.sin(th * D) * T, hipY - Math.cos(th * D) * T];
      const hr = H * 0.085;
      const Hc: Pt = [S[0] + d * Math.sin(th * D) * hr * 1.25, S[1] - Math.cos(th * D) * hr * 1.25];
      const sw = march > 0 ? Math.sin(ph) * 0.06 * H * march : 0;
      const stand: Pt[] = [[xx - d * H * 0.1, hipY], [xx + d * H * 0.1, hipY], [xx + d * H * 0.14 + sw, yy - H * 0.02], [xx - d * H * 0.14 - sw, yy - H * 0.02]];
      const kn: Pt[] = [[xx - d * H * 0.08, hipY + H * 0.02], [xx + d * H * 0.08, hipY - H * 0.02], [xx + d * H * 0.2, yy - H * 0.03], [xx - d * H * 0.22, yy - H * 0.01]];
      const low = mixPts(stand, kn, kb);
      const px = Math.cos(th * D) * H * 0.1;
      const py = d * Math.sin(th * D) * H * 0.1;
      const torso: Pt[] = [[hip[0] - px, hip[1] - py], [hip[0] + px, hip[1] + py], [S[0] + px * 1.1, S[1] + py * 1.1], [S[0] - px * 1.1, S[1] - py * 1.1]];
      const rest = lerp(10, 58, bw);
      const ra = Math.min(1, arms * 1.5);
      const phi = arms > 0 ? lerp(rest, 168, ra) : rest;
      const phi2 = arms > 0 ? lerp(rest - 14, 146, ra) : rest - 14;
      const aL = H * (0.25 - 0.04 * bw);
      const ae: Pt = [S[0] + d * Math.sin(phi * D) * aL, S[1] + Math.cos(phi * D) * aL];
      const ae2: Pt = [S[0] + d * Math.sin(phi2 * D) * aL, S[1] + Math.cos(phi2 * D) * aL];
      const cap = random(`${seed}hd${r}${i}`);
      figs.push(
        <g key={`${r}-${i}`}>
          <line x1={S[0]} y1={S[1]} x2={ae2[0]} y2={ae2[1]} stroke={tone(col, -0.3)} strokeWidth={H * 0.055} strokeLinecap="round" />
          <path d={poly(low)} fill={tone(col, -0.08)} stroke={rim(0.3)} strokeWidth={0.7} />
          <path d={poly(torso)} fill={col} stroke={rim(0.35)} strokeWidth={0.8} />
          <line x1={S[0]} y1={S[1]} x2={ae[0]} y2={ae[1]} stroke={tone(col, -0.12)} strokeWidth={H * 0.06} strokeLinecap="round" />
          <circle cx={Hc[0]} cy={Hc[1]} r={hr} fill={skin} />
          {woman ? (
            <path d={`M ${Hc[0] - hr * 1.2} ${Hc[1] + hr * 1.6} Q ${Hc[0] - hr * 1.4} ${Hc[1] - hr * 1.4} ${Hc[0] + d * hr * 0.4} ${Hc[1] - hr * 1.2} Q ${Hc[0] + d * hr * 1.1} ${Hc[1] - hr * 0.6} ${Hc[0] + d * hr * 0.7} ${Hc[1]} Z`} fill={tone(col, 0.12)} />
          ) : cap < 0.45 ? (
            <ellipse cx={Hc[0]} cy={Hc[1] - hr * 0.6} rx={hr * 1.15} ry={hr * 0.7} fill={ink(sack > 0.5 ? "#6A6050" : "#D8CCB0")} />
          ) : cap < 0.8 ? (
            <path d={`M ${Hc[0] + d * hr} ${Hc[1] - hr * 0.3} Q ${Hc[0]} ${Hc[1] - hr * 1.5} ${Hc[0] - d * hr * 1.1} ${Hc[1] - hr * 0.2} L ${Hc[0] - d * hr * 1.3} ${Hc[1] + hr * 1.4} L ${Hc[0] - d * hr * 0.4} ${Hc[1] + hr * 0.5} Z`} fill={tone(col, 0.18)} />
          ) : null}
          {!woman && random(`${seed}b${r}${i}`) > 0.4 ? <path d={`M ${Hc[0] + d * hr * 0.5} ${Hc[1] + hr * 0.3} Q ${Hc[0] + d * hr * 0.9} ${Hc[1] + hr * 1.5} ${Hc[0] - d * hr * 0.1} ${Hc[1] + hr * 1.2} Z`} fill={ink("#1A120C")} /> : null}
        </g>,
      );
    }
  }
  return <g>{figs}</g>;
};
