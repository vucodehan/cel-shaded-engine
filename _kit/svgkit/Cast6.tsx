import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { Dust, Glow, GlowS, Tint, useUid } from "./Atmos";
import { Pt, add, ease, lerp, mixPt, mod, polyline, range, rot, seg, shake, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { Svg } from "./Film";
import { Fire, GoldLine, Lightning, Smoke, StarField } from "./Fx";
import { useLayout } from "./layout";
import { Look, Person, Pose } from "./Person";
import { Rock } from "./Plants";
import { CaveMouth } from "./Props3";
import { Skyline } from "./Props4";
import {
  FOUNDATION_STONES, GoldTrumpet, GoldWings, GoldenBowl, GoldenCenser, GoldenLampstand, GoldenSickle, HeavenDoor, HeavenThrone, LambStanding,
  LivingCreature, PoseRig, RainbowHalo, RiverOfLife, Scroll7, SeaOfGlass, SevenStars, SevenTorches, TreeOfLife, WhiteHorse, aimArm, crownPath, poseRig, sparkleStar, starPath5,
} from "./Props7";
import { Band, NoScale, Sky, Stage, Water, ridgeY, useBand, useBandK, useCam, useLandGeo } from "./Stage";
import { fonts } from "./theme";

/**
 * Recurring figures and places for Revelation (films 90–100), so every film draws the visions the same way: dark ink skies,
 * gold line art, warm glow, god-rays. Looks (plain Person looks) carry fixed colours across films; the figure components
 * (SonOfMan, CrownedElder, RevAngel, SunWoman, BabylonWoman, FaithfulRider, HeavenArmy, PalmMultitude) add what a Look
 * cannot: white hair, a golden sash about the chest, shining eyes and face, wings, trumpets, castable crowns, palm branches.
 * They take the same x / y / s / flip / pose as Person (feet at y = 0 on the band's ground). Sets are listed with their
 * coordinates in their doc comments. God the Father is never drawn as a figure: only as light on the throne.
 */

const GOLD = "#E8C060";
const D2R = Math.PI / 180;
const f1 = (n: number) => n.toFixed(1);
const clamp1 = (t: number) => Math.min(1, Math.max(0, t));
type CamT = ReturnType<typeof useCam>;
type SkyP = React.ComponentProps<typeof Sky>;
type SetP = { cam: CamT; seed: string; tod?: number; near?: React.ReactNode; mid?: React.ReactNode; far?: React.ReactNode; front?: React.ReactNode; fx?: React.ReactNode; sky?: SkyP; storm?: number };

// ── Looks ────────────────────────────────────────────────────────────────────────────────

/** Skin tones for the multitude "from every nation and tribe and people and tongue". */
const SKINS = ["#6A4632", "#8A5A3C", "#3A2418", "#A87A5A", "#5A3A28", "#C89A78", "#7A4E34", "#4A2E20"];

/** John on Patmos: the aged apostle, sage-green robe, a deep red hooded cloak, a long white beard. Hold "scroll" to write. */
export const JOHN_PATMOS: Look = { robe: "#4E5A46", head: "hood", mantle: "#7A3A2A", sash: "#5A3A2A", beard: "white", skin: "#7A5440" };
/** The glorified Christ of Revelation 1 as a plain Person look (shining white robe, bare head, white beard, strong glow).
 *  Use SonOfMan for the full vision: white hair, golden sash about the chest, eyes of fire, feet of bronze, seven stars. */
export const SON_OF_MAN: Look = { robe: "#F6F2E8", head: "bare", beard: "white", glow: 1, skin: "#C89A70" };
/** The twenty-four elders: white robes in slightly different whites, golden crowns, white beards, gold sashes. */
export const ELDER24 = (i = 0): Look => ({ robe: ["#F2EEE4", "#ECE6D8", "#F4F0EA", "#E8E2D4"][i % 4], head: "crown", beard: "white", sash: GOLD, glow: 0.25 });
/** Bright angels in clean linen with golden sashes (15:6); RevAngel adds wings and a trumpet. */
export const ANGEL_REV = (i = 0): Look => ({ robe: ["#F4EEDF", "#EEF0F6", "#F6EEDC", "#EEEAF2"][i % 4], head: "hair", mantle: "#FFF6DE", sash: GOLD, glow: 0.85 });
/** The great multitude in white robes (7:9), every nation: varied skin, hair, veils. PalmMultitude adds the palm branches. */
export const MULTITUDE = (i = 0): Look => ({
  robe: ["#F4F0E6", "#EEEAE0", "#F6F2EA", "#ECE8DE"][i % 4],
  head: (["hair", "veil", "hair", "cloth", "veil", "bare"] as const)[i % 6],
  mantle: ["#FFFFFF", "#F2EEE4", "#F8F4EA"][i % 3],
  skin: SKINS[(i * 5) % SKINS.length],
  beard: i % 3 === 0,
  glow: 0.3,
});
/** The two witnesses, prophesying in sackcloth (11:3): coarse dark goat-hair robes, hoods, staffs. */
export const WITNESS = (i = 0): Look => ({ robe: ["#5E5444", "#54493C"][i % 2], head: i % 2 ? "cloth" : "hood", mantle: ["#4E463A", "#5A5040"][i % 2], beard: i % 2 ? "white" : "wild", hairy: true, staff: "staff" });
/** Michael the archangel (12:7): white linen, gilded scale armour, a silver helmet, a spear; RevAngel adds wings. */
export const MICHAEL: Look = { robe: "#EEEAE0", head: "helmet", armor: "#C8A050", sash: GOLD, short: true, hold: "spear", glow: 0.55 };
/** The woman clothed with the sun (12:1) as a plain look: robe of sun-gold, a white veil. SunWoman adds sun, moon, stars. */
export const WOMAN_SUN: Look = { robe: "#E2B254", head: "veil", mantle: "#FFF6E4", sash: "#FFF0C0", glow: 0.3 };
/** The woman of chapter 17, dignified and fully robed: royal purple robe, a scarlet veil, gold sash and circlet. BabylonWoman
 *  adds the golden cup, pearls and the name on her forehead. */
export const BABYLON_WOMAN: Look = { robe: "#4E1C5E", head: "veil", mantle: "#9A1A26", sash: GOLD, diadem: GOLD, skin: "#9A6A4C" };
/** The rider called Faithful and True (19:11–13) as a plain look: a deep crimson robe with gold, white hair cloth. */
export const RIDER_FAITHFUL: Look = { robe: "#8A1A24", head: "hair", mantle: "#F4EEE0", sash: GOLD, beard: true, skin: "#B88A68" };
/** The armies of heaven, in fine linen, white and pure (19:14). */
export const ARMY_HEAVEN = (i = 0): Look => ({ robe: ["#F2EEE4", "#EEEAE2", "#F6F2EA"][i % 3], head: i % 3 === 1 ? "helmet" : "hair", sash: i % 2 ? GOLD : "#D8D0C0", beard: i % 2 === 0, skin: SKINS[(i * 3) % SKINS.length], glow: 0.3 });

// ── Figure helper: a Person with drawing under and over it, in the Person's own units ─────

type FigP = { x: number; y?: number; s?: number; flip?: boolean; pose?: Pose; look: Look; opacity?: number; shadow?: boolean; under?: (r: PoseRig) => React.ReactNode; over?: (r: PoseRig) => React.ReactNode };
const Fig: React.FC<FigP> = ({ x, y, s = 1, flip = false, pose = {}, look, opacity = 1, shadow = true, under, over }) => {
  const band = useBand();
  const gy = y ?? band.gy(x);
  const sc = s * band.k * (1 - 0.36 * (look.child ?? 0));
  if (opacity <= 0.001) return null;
  const r = poseRig(pose, look.child ?? 0);
  const T = `translate(${f1(x)} ${f1(gy)}) scale(${flip ? -sc : sc} ${sc})`;
  return (
    <g opacity={Math.min(1, opacity)}>
      {under ? (
        <g transform={T}>
          <NoScale>{under(r)}</NoScale>
        </g>
      ) : null}
      <Person x={x} y={gy} s={s} flip={flip} pose={pose} look={look} shadow={shadow} />
      {over ? (
        <g transform={T}>
          <NoScale>{over(r)}</NoScale>
        </g>
      ) : null}
    </g>
  );
};

const HT = (r: PoseRig, pts: Pt[]) => pts.map((q) => add(r.Hc, rot(q, r.tilt)));
/** Long hair falling behind the shoulders (drawn under the Person). */
const hairBack = (r: PoseRig, color: string, long = true) => {
  const h = r.hr;
  const pts: Pt[] = long
    ? [[h * 0.8, -h * 0.7], [0, -h * 1.36], [-h * 1.1, -h * 0.4], [-h * 1.45, h * 1.4], [-h * 1.25, h * 3.6], [-h * 0.3, h * 3.1], [-h * 0.4, h * 1.2], [-h * 0.2, 0]]
    : [[h * 0.8, -h * 0.62], [0, -h * 1.3], [-h * 1.05, -h * 0.3], [-h * 1.15, h * 0.7], [-h * 0.55, h * 0.95], [-h * 0.25, 0]];
  return <path d={smooth(HT(r, pts), true, 0.45)} fill={color} stroke="rgba(255,246,226,0.7)" strokeWidth={1} />;
};
/** The hair cap over the crown of the head (drawn over the Person). */
const hairCap = (r: PoseRig, color: string) => {
  const h = r.hr;
  return <path d={smooth(HT(r, [[h * 0.92, -h * 0.45], [h * 0.2, -h * 1.4], [-h * 1.02, -h * 0.5], [-h * 0.2, -h * 0.62]]), true, 0.5)} fill={color} />;
};
/** A golden sash about the chest (1:13; 15:6). */
const chestSash = (r: PoseRig, color = GOLD) => {
  const a = add(r.S, rot([-10.5, 15], r.lean));
  const b = add(r.S, rot([10.5, 13], r.lean));
  return (
    <g>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={6} strokeLinecap="round" />
      <line x1={a[0]} y1={a[1] - 1.6} x2={b[0]} y2={b[1] - 1.6} stroke="#FFF2C4" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
    </g>
  );
};
/** A palm branch held up in the front hand. */
const palmFrond = (hx: number, hy: number, sway: number, key?: string | number) => {
  const tip: Pt = [hx + 10 + sway, hy - 74];
  const ctrl: Pt = [hx + 2 + sway * 0.4, hy - 40];
  const pts = Array.from({ length: 9 }, (_, i) => {
    const t = 0.2 + i * 0.09;
    const u = 1 - t;
    return [u * u * hx + 2 * u * t * ctrl[0] + t * t * tip[0], u * u * (hy + 6) + 2 * u * t * ctrl[1] + t * t * tip[1]] as Pt;
  });
  return (
    <g key={key}>
      <path d={`M ${hx} ${hy + 6} Q ${f1(ctrl[0])} ${f1(ctrl[1])} ${f1(tip[0])} ${f1(tip[1])}`} stroke="#7A8A3A" strokeWidth={2} fill="none" />
      {pts.map((q, i) => {
        const L = 16 - i * 1.2;
        return (
          <g key={i}>
            <path d={`M ${f1(q[0])} ${f1(q[1])} q ${f1(-L * 0.6)} ${f1(L * 0.2)} ${f1(-L)} ${f1(L * 0.75)}`} stroke="#5E8A3A" strokeWidth={2.2} fill="none" strokeLinecap="round" />
            <path d={`M ${f1(q[0])} ${f1(q[1])} q ${f1(L * 0.6)} ${f1(L * 0.2)} ${f1(L)} ${f1(L * 0.75)}`} stroke="#6E9A44" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
};

// ── Figures ──────────────────────────────────────────────────────────────────────────────

/**
 * The one like a Son of Man among the lampstands (Revelation 1:13–16): a long shining robe, a golden sash about the chest,
 * head and hair white as wool, eyes like blazing fire, face like the sun, feet like burnished bronze, a gold nimbus with
 * the cross, rays and a strong glow. Person anchors (feet at y = 0). `stars` 0..1 puts the seven stars in His right (front)
 * hand, `sword` 0..1 the sharp two-edged sword of light from His mouth, `crown` a golden crown and `sickle` a golden sickle
 * (14:14), `keys` the keys of Death and Hades in the back hand, `glow` 0..1 the radiance.
 */
export const SonOfMan: React.FC<{ x: number; y?: number; s?: number; flip?: boolean; pose?: Pose; p?: number; glow?: number; stars?: number; sword?: number; crown?: boolean; sickle?: boolean; keys?: boolean; look?: Look; shadow?: boolean }> = ({
  x,
  y,
  s = 1,
  flip = false,
  pose = { arm: [64, 30], arm2: [-10, 16] },
  p = 1,
  glow = 1,
  stars = 1,
  sword = 0,
  crown = false,
  sickle = false,
  keys = false,
  look,
  shadow = true,
}) => {
  const f = useCurrentFrame();
  const gid = useUid("som");
  const lk = look ?? SON_OF_MAN;
  const standing = (pose.kneel ?? 0) < 0.5 && (pose.sit ?? 0) < 0.5;
  const rg = poseRig(pose);
  return (
    <Fig
      x={x}
      y={y}
      s={s}
      flip={flip}
      pose={pose}
      look={lk}
      opacity={p}
      shadow={shadow}
      under={(r) => (
        <g>
          {glow > 0 ? (
            <>
              <defs>
                <radialGradient id={gid} gradientUnits="userSpaceOnUse" cx={rg.Hc[0]} cy={rg.Hc[1]} r={300}>
                  <stop offset="0" stopColor="rgb(255,244,214)" stopOpacity={0.42} />
                  <stop offset="0.4" stopColor="rgb(255,236,190)" stopOpacity={0.12} />
                  <stop offset="1" stopColor="rgb(255,226,170)" stopOpacity={0} />
                </radialGradient>
              </defs>
              <GlowS x={0} y={-96} r={300} squash={0.85} color="255,236,200" opacity={0.5 * glow} />
              <g style={{ mixBlendMode: "screen" }} opacity={glow}>
                {Array.from({ length: 36 }, (_, i) => {
                  const a = (i / 36) * Math.PI * 2 + f * 0.002 + random(`soma${i}`) * 0.08;
                  const L = 170 + 130 * random(`som${i}`);
                  const w = 2 + 4 * random(`somw${i}`);
                  const e: Pt = [r.Hc[0] + Math.cos(a) * L, r.Hc[1] + Math.sin(a) * L];
                  return <path key={i} d={`M ${f1(r.Hc[0])} ${f1(r.Hc[1])} L ${f1(e[0] - Math.sin(a) * w)} ${f1(e[1] + Math.cos(a) * w)} L ${f1(e[0] + Math.sin(a) * w)} ${f1(e[1] - Math.cos(a) * w)} Z`} fill={`url(#${gid})`} />;
                })}
              </g>
            </>
          ) : null}
          <circle cx={r.Hc[0]} cy={r.Hc[1]} r={r.hr * 2.15} fill="rgba(255,226,150,0.28)" stroke={GOLD} strokeWidth={2} />
          {[0, 90, -90].map((a) => {
            const q0 = add(r.Hc, rot([0, -r.hr * 1.05], r.tilt + a));
            const q1 = add(r.Hc, rot([0, -r.hr * 2.1], r.tilt + a));
            return <line key={a} x1={q0[0]} y1={q0[1]} x2={q1[0]} y2={q1[1]} stroke={GOLD} strokeWidth={3.4} strokeLinecap="round" />;
          })}
          {hairBack(r, "#FBF8F2", true)}
        </g>
      )}
      over={(r) => (
        <g>
          {hairCap(r, "#FBF8F2")}
          {chestSash(r)}
          <GlowS x={r.Hc[0] + 2} y={r.Hc[1]} r={r.hr * 2.6} color="255,252,236" opacity={0.75 * glow} />
          <GlowS x={r.eye[0]} y={r.eye[1]} r={7} color="255,160,70" opacity={0.95} />
          <circle cx={r.eye[0]} cy={r.eye[1]} r={1.9} fill="#FFE6A0" />
          {standing
            ? r.feet.map((q, i) => (
                <g key={i}>
                  <GlowS x={q[0] + 3} y={q[1]} r={14} color="255,170,80" opacity={0.7} />
                  <ellipse cx={q[0] + 3} cy={q[1]} rx={8} ry={3.2} fill="#D8984A" stroke="#FFD27A" strokeWidth={0.8} />
                </g>
              ))
            : null}
          {stars > 0 ? <SevenStars x={r.hand[0]} y={r.hand[1] - 2} r={17} size={2.3} p={stars} /> : null}
          {sword > 0 ? (
            <g style={{ mixBlendMode: "screen" }}>
              <GlowS x={r.mouth[0] + 30 * sword} y={r.mouth[1]} r={30 * sword} squash={0.35} color="255,246,220" opacity={0.8} />
              <path d={`M ${f1(r.mouth[0] + 2)} ${f1(r.mouth[1] - 2.2)} L ${f1(r.mouth[0] + 2 + 58 * sword)} ${f1(r.mouth[1])} L ${f1(r.mouth[0] + 2)} ${f1(r.mouth[1] + 2.2)} Z`} fill="#FFFDF4" />
            </g>
          ) : null}
          {crown ? <path d={crownPath(r.top[0], r.top[1] + 3, 26, 3, 13)} fill={GOLD} stroke="#FFF0C0" strokeWidth={0.9} /> : null}
          {sickle ? <GoldenSickle x={r.hand[0]} y={r.hand[1]} s={0.8} ang={10} /> : null}
          {keys ? (
            <g>
              {[0, 1].map((i) => (
                <g key={i} transform={`translate(${f1(r.hand2[0] + i * 3)} ${f1(r.hand2[1] + 2 + i * 2)}) rotate(${70 + i * 14})`}>
                  <circle cx={0} cy={0} r={3.6} fill="none" stroke={GOLD} strokeWidth={1.6} />
                  <line x1={3.6} y1={0} x2={22} y2={0} stroke={GOLD} strokeWidth={1.8} />
                  <path d="M 18 0 L 18 4 M 21 0 L 21 4" stroke={GOLD} strokeWidth={1.6} />
                </g>
              ))}
            </g>
          ) : null}
        </g>
      )}
    />
  );
};

/**
 * One of the twenty-four elders (4:4, 10; 5:8) with a castable crown and white hair. `cast` 0..1: he lifts his crown off and
 * lays it down before him as he falls to his knees (it lands at `target`, Person units in front of his feet, default
 * [62, -4]). `seated` sits him (on an elder's throne: seat height 44), `harp` gives him a harp, `bowl` a golden bowl of
 * incense. Person anchors.
 */
export const CrownedElder: React.FC<{ x: number; y?: number; s?: number; flip?: boolean; i?: number; pose?: Pose; cast?: number; target?: Pt; seated?: boolean; harp?: boolean; bowl?: boolean; p?: number; worship?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  i = 0,
  pose,
  cast = 0,
  target,
  seated = false,
  harp = false,
  bowl = false,
  p = 1,
  worship,
}) => {
  const c = clamp1(cast);
  const w = clamp1(worship ?? ease.inOut(seg(c, 0.3, 0.95)));
  const base: Pose = pose ?? (seated ? { sit: 1, arm: harp ? [60, 60] : bowl ? [70, 10] : [30, 40], arm2: [20, 50] } : { arm: harp ? [60, 60] : [20, 30] });
  const P0: Pose = {
    ...base,
    sit: (base.sit ?? 0) * (1 - w),
    kneel: Math.max(base.kneel ?? 0, w),
    lean: (base.lean ?? 0) + 28 * w,
    head: (base.head ?? 0) + 12 * w,
  };
  const r0 = poseRig(P0);
  const headTop: Pt = add(r0.top, [0, 3]);
  const lift: Pt = add(headTop, [12, -14]);
  const tgt = target ?? [62, -4];
  let crownAt = headTop;
  let handT: Pt | null = null;
  if (c > 0 && c < 0.35) {
    const u = ease.inOut(c / 0.35);
    crownAt = mixPt(headTop, lift, u);
    handT = add(crownAt, [2, 5]);
  } else if (c >= 0.35) {
    const u = ease.inOut((c - 0.35) / 0.65);
    const ctrl: Pt = [(lift[0] + tgt[0]) / 2 + 14, Math.min(lift[1], tgt[1]) - 24];
    crownAt = mixPt(mixPt(lift, ctrl, u), mixPt(ctrl, tgt, u), u);
    handT = u < 0.75 ? add(crownAt, [2, 5]) : add(tgt, [0, -6]);
  }
  const pose2: Pose = handT ? { ...P0, arm: aimArm(P0, handT) } : P0;
  const lk: Look = { ...ELDER24(i), head: "bare", hold: harp ? "harp" : null };
  const r = poseRig(pose2);
  return (
    <Fig
      x={x}
      y={y}
      s={s}
      flip={flip}
      pose={pose2}
      look={lk}
      opacity={p}
      under={(rr) => hairBack(rr, "#F2EEE6", false)}
      over={(rr) => (
        <g>
          {hairCap(rr, "#F2EEE6")}
          {bowl ? <GoldenBowl x={r.hand[0] + 2} y={r.hand[1] - 4} s={0.45} incense /> : null}
          <GlowS x={crownAt[0]} y={crownAt[1] - 6} r={18} color="255,214,130" opacity={0.6} />
          <path d={crownPath(crownAt[0], crownAt[1], 24, 3, 13)} fill={GOLD} stroke="#FFF0C0" strokeWidth={0.9} transform={c >= 0.35 ? `rotate(${f1(-18 * Math.sin(Math.PI * clamp1((c - 0.35) / 0.65)))} ${f1(crownAt[0])} ${f1(crownAt[1])})` : undefined} />
          <circle cx={crownAt[0]} cy={crownAt[1] - 13} r={1.6} fill="#FFF6E0" />
        </g>
      )}
    />
  );
};

/**
 * A bright angel of Revelation with gold-outline wings (7:1; 8:2; 14:6; 15:6). `i` picks the robe, or pass `look` (e.g.
 * MICHAEL). `trumpet` 0..1 raises a gold trumpet to the lips (0 holds it down), `blow` 0..1 sounds it; `censer` 0..1 swings a
 * golden censer with incense (8:3), `bowl` 0..1 tips and pours a golden bowl (16:1), `sickle` holds a golden sickle up
 * (14:17), `wings` 0..1 draws the wings on, `open` 0..1 spreads them, `fly` lifts him off the ground (units) without a shadow.
 * Person anchors.
 */
export const RevAngel: React.FC<{
  x: number; y?: number; s?: number; flip?: boolean; i?: number; look?: Look; pose?: Pose; p?: number;
  wings?: number; open?: number; trumpet?: number; blow?: number; censer?: number; fire?: number; bowl?: number; sickle?: boolean; fly?: number; sash?: boolean;
}> = ({ x, y, s = 1, flip = false, i = 0, look, pose, p = 1, wings = 1, open = 1, trumpet, blow = 0, censer, fire = 0, bowl, sickle = false, fly = 0, sash = true }) => {
  const f = useCurrentFrame();
  const band = useBand();
  const gy = (y ?? band.gy(x)) - fly * s * band.k;
  const lk = look ?? ANGEL_REV(i);
  let P0: Pose = pose ?? { arm: [16, 24], arm2: [-8, 14] };
  let tr: { a: Pt; ang: number } | null = null;
  if (trumpet !== undefined) {
    const u = ease.inOut(clamp1(trumpet));
    P0 = { ...P0, head: (P0.head ?? 0) - 10 * u };
    const r0 = poseRig(P0);
    const ang = lerp(-78, -18, u);
    const d: Pt = [Math.cos(ang * D2R), Math.sin(ang * D2R)];
    const rest: Pt = add(r0.S, [16, 62]);
    const lips: Pt = add(r0.mouth, [d[0] * 30, d[1] * 30]);
    const handT = mixPt(rest, lips, u);
    P0 = { ...P0, arm: aimArm(P0, handT) };
    tr = { a: [handT[0] - d[0] * 28, handT[1] - d[1] * 28], ang };
  } else if (censer !== undefined) {
    P0 = { ...P0, arm: P0.arm ?? [70, 20] };
    if (!pose) P0 = { ...P0, arm: [74, 18] };
  } else if (bowl !== undefined) {
    if (!pose) P0 = { ...P0, arm: [84, -8] };
  } else if (sickle) {
    if (!pose) P0 = { ...P0, arm: [150, -10] };
  }
  const r = poseRig(P0);
  return (
    <Fig
      x={x}
      y={gy}
      s={s}
      flip={flip}
      pose={P0}
      look={lk}
      opacity={p}
      shadow={fly <= 0}
      under={(rr) => (
        <g>
          <GlowS x={0} y={-110} r={200} squash={0.9} color="255,240,210" opacity={0.35 * (lk.glow ?? 0.8)} />
          {wings > 0 ? <GoldWings x={rr.S[0] - 4} y={rr.S[1] + 6} s={1} p={wings} open={open} rot={Math.sin(f * 0.05 + i) * 3} fill={0.22} /> : null}
        </g>
      )}
      over={(rr) => (
        <g>
          {sash ? chestSash(rr) : null}
          {tr ? <GoldTrumpet x={tr.a[0]} y={tr.a[1]} s={0.85} ang={tr.ang} blow={blow} /> : null}
          {censer !== undefined ? <GoldenCenser x={r.hand[0]} y={r.hand[1]} s={0.75} swing={Math.sin(f * 0.06) * 14} smoke={censer} fire={fire} /> : null}
          {bowl !== undefined ? <GoldenBowl x={r.hand[0] + 10} y={r.hand[1] - 6} s={0.85} tip={Math.min(1, bowl * 2)} pour={clamp1(bowl * 2 - 0.6)} len={420} /> : null}
          {sickle ? <GoldenSickle x={r.hand[0]} y={r.hand[1]} s={0.85} ang={-10} /> : null}
          {/* front hand redrawn over the trumpet so the grip reads */}
          {tr ? <circle cx={rr.hand[0]} cy={rr.hand[1]} r={4.2} fill={mixHex(lk.skin ?? "#6A4632", "#F0E2CC", lk.glow ?? 0)} /> : null}
        </g>
      )}
    />
  );
};

/**
 * The great multitude in white robes with palm branches in their hands (7:9): rows of people of every skin and dress, palms
 * raised and waving. Band component: spread from x0 to x1 on the band's ground, `rows` deep (back rows smaller and higher),
 * `n` per row. `toward` an x they face (default: all face right), `wave` 0..1 how high the palms are lifted, `p` reveals.
 */
export const PalmMultitude: React.FC<{ x0: number; x1: number; n?: number; rows?: number; s?: number; seed?: string; toward?: number; wave?: number; p?: number; dy?: number }> = ({ x0, x1, n = 9, rows = 2, s = 1, seed = "pm", toward, wave = 1, p = 1, dy = 34 }) => {
  const f = useCurrentFrame();
  const band = useBand();
  const k = band.k;
  if (p <= 0) return null;
  const out: React.ReactNode[] = [];
  for (let rw = rows - 1; rw >= 0; rw--) {
    const sc = s * (1 - rw * 0.12);
    const m = n + rw;
    for (let j = 0; j < m; j++) {
      const idx = rw * 31 + j;
      const xx = lerp(x0, x1, (j + 0.5 + (rw % 2) * 0.5) / (m + 0.5)) + range(`${seed}x${idx}`, -12, 12);
      const yy = band.gy(xx) - rw * dy * k;
      const flip = toward !== undefined ? toward < xx : false;
      const ph = random(`${seed}p${idx}`) * 6.28;
      const lift = wave * (0.7 + 0.3 * Math.sin(f * 0.07 + ph));
      const pose: Pose = { arm: [lerp(40, 158, lift), lerp(30, 6, lift)], arm2: [-8 + 30 * lift * (idx % 3 === 0 ? 1 : 0), 14], head: -8 * lift };
      out.push(
        <Fig
          key={`${rw}-${j}`}
          x={xx}
          y={yy}
          s={sc * range(`${seed}s${idx}`, 0.92, 1.06)}
          flip={flip}
          pose={pose}
          look={MULTITUDE(idx)}
          opacity={p * (1 - rw * 0.08)}
          over={(r) => palmFrond(r.hand[0], r.hand[1], Math.sin(f * 0.08 + ph) * 6 * wave)}
        />,
      );
    }
  }
  return <g>{out}</g>;
};

/**
 * The woman clothed with the sun, the moon under her feet, on her head a crown of twelve stars (12:1). Person anchors: her
 * feet stand on the crescent moon at y = 0. `sun`, `moon`, `stars` 0..1 bring in each sign; `child` gives her the child
 * (12:5); `wings` 0..1 the two wings of the great eagle (12:14). Never sexualized: a full robe and veil, clothed in light.
 */
export const SunWoman: React.FC<{ x: number; y?: number; s?: number; flip?: boolean; pose?: Pose; p?: number; sun?: number; moon?: number; stars?: number; child?: boolean; wings?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  pose,
  p = 1,
  sun = 1,
  moon = 1,
  stars = 1,
  child = false,
  wings = 0,
}) => {
  const f = useCurrentFrame();
  const P0: Pose = pose ?? (child ? { arm: [60, 70], arm2: [30, 70], head: 10 } : { arm: [30, 40], arm2: [-10, 30], head: -6 });
  return (
    <Fig
      x={x}
      y={y}
      s={s}
      flip={flip}
      pose={P0}
      look={{ ...WOMAN_SUN, hold: child ? "baby" : null }}
      opacity={p}
      shadow={false}
      under={(r) => (
        <g>
          {wings > 0 ? <GoldWings x={r.S[0] - 6} y={r.S[1] + 4} s={1.45} p={wings} kind="eagle" fill={0.3} w={2.4} glow={0.9} /> : null}
          {sun > 0 ? (
            <g opacity={sun}>
              <GlowS x={0} y={-92} r={260} color="255,200,100" opacity={0.6} />
              <ellipse cx={0} cy={-92} rx={78} ry={104} fill="rgba(255,190,90,0.32)" stroke="rgba(255,226,150,0.85)" strokeWidth={2.4} />
              {Array.from({ length: 40 }, (_, i) => {
                const a = (i / 40) * Math.PI * 2 + f * 0.002;
                const rx0 = 84;
                const ry0 = 110;
                const ext = 30 + (i % 2) * 26 + 6 * Math.sin(f * 0.05 + i);
                const b0: Pt = [Math.cos(a - 0.035) * rx0, -92 + Math.sin(a - 0.035) * ry0];
                const b1: Pt = [Math.cos(a + 0.035) * rx0, -92 + Math.sin(a + 0.035) * ry0];
                const t: Pt = [Math.cos(a) * (rx0 + ext), -92 + Math.sin(a) * (ry0 + ext)];
                return <path key={i} d={`M ${f1(b0[0])} ${f1(b0[1])} L ${f1(t[0])} ${f1(t[1])} L ${f1(b1[0])} ${f1(b1[1])} Z`} fill="rgba(255,210,110,0.8)" />;
              })}
            </g>
          ) : null}
        </g>
      )}
      over={(r) => (
        <g>
          {moon > 0 ? (
            <g opacity={moon}>
              <GlowS x={0} y={4} r={80} squash={0.4} color="210,224,255" opacity={0.8} />
              <path d="M -56 -4 Q -50 22 0 24 Q 50 22 56 -4 Q 40 12 0 12 Q -40 12 -56 -4 Z" fill="#E8ECF6" stroke="#FFFFFF" strokeWidth={1} />
            </g>
          ) : null}
          {stars > 0
            ? Array.from({ length: 12 }, (_, i) => {
                const a = (-172 + (i * 164) / 11) * D2R;
                const q = add(r.Hc, rot([Math.cos(a) * r.hr * 2.05, Math.sin(a) * r.hr * 2.05], 0));
                const vis = clamp1(stars * 12 - i);
                return vis > 0 ? (
                  <g key={i} opacity={vis}>
                    <GlowS x={q[0]} y={q[1]} r={7} color="255,240,200" opacity={0.9} />
                    <path d={starPath5(q[0], q[1], 3.6)} fill="#FFF6D8" />
                  </g>
                ) : null;
              })
            : null}
        </g>
      )}
    />
  );
};

/**
 * The woman of Revelation 17 (restrained and dignified, never sexualized): fully robed in purple, a scarlet veil, gold and
 * pearls, the golden cup held up, and on her forehead the gold band of her name. Seat her on SeaBeast kind "scarlet" with
 * `seated` (pass as its rider at x = 0, y = 0). `cup` 0..1 raises the cup. Person anchors.
 */
export const BabylonWoman: React.FC<{ x: number; y?: number; s?: number; flip?: boolean; pose?: Pose; p?: number; cup?: number; seated?: boolean; shadow?: boolean }> = ({ x, y, s = 1, flip = false, pose, p = 1, cup = 1, seated = false, shadow }) => {
  const u = clamp1(cup);
  const P0: Pose = pose ?? { sit: seated ? 1 : 0, arm: [lerp(30, 112, u), lerp(40, -24, u)], arm2: [20, 50], head: -4 };
  return (
    <Fig
      x={x}
      y={y}
      s={s}
      flip={flip}
      pose={P0}
      look={BABYLON_WOMAN}
      opacity={p}
      shadow={shadow ?? !seated}
      over={(r) => {
        const pearls = HT(r, Array.from({ length: 9 }, (_, i) => {
          const t = i / 8;
          return [r.hr * lerp(0.9, -0.6, t), r.hr * lerp(-0.4, 1.6, t * t)] as Pt;
        }));
        const neck = Array.from({ length: 6 }, (_, i) => add(r.S, rot([lerp(-6, 8, i / 5), 6 + Math.sin((i / 5) * Math.PI) * 4], r.lean)));
        const [hx, hy] = r.hand;
        return (
          <g>
            {pearls.map((q, i) => (
              <circle key={`p${i}`} cx={q[0]} cy={q[1]} r={1.3} fill="#FFFFFF" opacity={0.9} />
            ))}
            {neck.map((q, i) => (
              <circle key={`n${i}`} cx={q[0]} cy={q[1]} r={1.6} fill={i % 2 ? "#FFFFFF" : GOLD} />
            ))}
            <GlowS x={hx + 1} y={hy - 12} r={20} color="255,214,130" opacity={0.6} />
            <path d={`M ${hx - 7} ${hy - 20} L ${hx + 7} ${hy - 20} Q ${hx + 6} ${hy - 10} ${hx + 1.4} ${hy - 7} L ${hx + 1.4} ${hy - 1} L ${hx + 5} ${hy + 1} L ${hx - 5} ${hy + 1} L ${hx - 1.4} ${hy - 1} L ${hx - 1.4} ${hy - 7} Q ${hx - 6} ${hy - 10} ${hx - 7} ${hy - 20} Z`} fill={GOLD} stroke="#FFF0C0" strokeWidth={0.7} />
            <circle cx={hx} cy={hy - 14} r={1.6} fill="#9A1E3A" />
            <circle cx={hx} cy={hy} r={4} fill={mixHex("#9A6A4C", "#000000", 0)} />
            {(() => {
              const [a, b] = HT(r, [[r.hr * 0.5, -r.hr * 0.66], [r.hr * 0.1, -r.hr * 0.8]]);
              return <path d={`M ${f1(a[0])} ${f1(a[1])} L ${f1(b[0])} ${f1(b[1])}`} stroke="#3A1010" strokeWidth={0.9} strokeDasharray="1.2 1" />;
            })()}
          </g>
        );
      }}
    />
  );
};

/**
 * The rider called Faithful and True on a white horse (19:11–16): a radiant rider in a crimson robe (the robe dipped in blood
 * is shown only as its colour), many royal crowns stacked on His head, eyes like blazing fire, His name KING OF KINGS AND
 * LORD OF LORDS on a gold band on His robe at the thigh, the horse royally decked. Built on WhiteHorse (same anchors and
 * scale: horse withers -150). `run` / `walk` phases, `glow`, `name` 0..1 shows the written name, `sword` 0..1 the sword of
 * light from His mouth, `crowns` how many stacked diadems (default 3).
 */
export const FaithfulRider: React.FC<{ x: number; y?: number; s?: number; flip?: boolean; run?: number; walk?: number; p?: number; glow?: number; name?: number; sword?: number; crowns?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  run,
  walk,
  p = 1,
  glow = 1,
  name = 1,
  sword = 0,
  crowns = 3,
}) => {
  const pose: Pose = { sit: 1, lean: run !== undefined ? 6 : 0, arm: [56, 34], arm2: [36, 46], head: -2 };
  const r = poseRig(pose);
  const drape = "M -21 -42 Q 5 -44 27 -32 Q 33 -14 25 6 Q 19 14 11 14 L -3 10 Q -7 -12 -21 -26 Z";
  return (
    <WhiteHorse
      x={x}
      y={y}
      s={s}
      flip={flip}
      color="white"
      run={run}
      walk={walk}
      p={p}
      glow={glow}
      tack="royal"
      rider={
        <g>
          <GlowS x={r.Hc[0]} y={r.Hc[1] + 30} r={150} color="255,244,220" opacity={0.55 * glow} />
          {hairBack(r, "#F4F0EA", true)}
          <Person x={0} y={0} s={1} look={{ ...RIDER_FAITHFUL, head: "bare", beard: "white" }} pose={pose} shadow={false} />
          {hairCap(r, "#F4F0EA")}
          <GlowS x={r.top[0]} y={r.top[1] - 6} r={26} color="255,220,140" opacity={0.7} />
          {Array.from({ length: Math.max(1, Math.round(crowns)) }, (_, i) => (
            <path key={i} d={crownPath(r.top[0], r.top[1] + 3 - i * 4.4, 26 - i * 2.6, 3 + (i % 2), 7.5)} fill={i % 2 ? "#F2CC6A" : GOLD} stroke="#FFF0C0" strokeWidth={0.7} />
          ))}
          <GlowS x={r.eye[0]} y={r.eye[1]} r={7} color="255,150,60" opacity={0.95} />
          <circle cx={r.eye[0]} cy={r.eye[1]} r={1.8} fill="#FFE6A0" />
          {sword > 0 ? <path d={`M ${f1(r.mouth[0] + 2)} ${f1(r.mouth[1] - 2)} L ${f1(r.mouth[0] + 2 + 56 * sword)} ${f1(r.mouth[1])} L ${f1(r.mouth[0] + 2)} ${f1(r.mouth[1] + 2)} Z`} fill="#FFFDF4" /> : null}
          <path d={drape} fill="#8A1A24" stroke="rgba(255,226,170,0.7)" strokeWidth={1} />
          <ellipse cx={17} cy={16} rx={8} ry={3.4} fill="#B88A68" />
          {name > 0 ? (
            <g opacity={name}>
              <path d="M 6 -38 Q 18 -34 24 -24 L 18 8 L 8 6 Q 10 -14 0 -30 Z" fill={GOLD} opacity={0.9} />
              <text x={0} y={0} transform="translate(13 -18) rotate(78)" textAnchor="middle" fontFamily={fonts.display} fontSize={4.2} fontWeight={700} fill="#5A1010">
                KING OF KINGS
              </text>
            </g>
          ) : null}
        </g>
      }
    />
  );
};

/**
 * The armies of heaven following on white horses, dressed in fine linen, white and pure (19:14). Band component: riders
 * spread from x0 to x1 on the band's ground (or `y`), `rows` deep (back rows smaller, higher and paler), `n` per row; `run` a
 * shared gallop phase, `cloud` a bank of cloud beneath them, `flip` to ride left.
 */
export const HeavenArmy: React.FC<{ x0: number; x1: number; y?: number; n?: number; rows?: number; s?: number; run?: number; walk?: number; seed?: string; flip?: boolean; cloud?: boolean; p?: number; dy?: number }> = ({
  x0,
  x1,
  y,
  n = 5,
  rows = 3,
  s = 1,
  run,
  walk,
  seed = "ha",
  flip = false,
  cloud = true,
  p = 1,
  dy = 60,
}) => {
  const band = useBand();
  const k = band.k;
  const f = useCurrentFrame();
  const cid = useUid("hac");
  if (p <= 0) return null;
  const out: React.ReactNode[] = [
    <defs key="d">
      <radialGradient id={cid}>
        <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} />
        <stop offset="0.6" stopColor="#EEF0F6" stopOpacity={0.45} />
        <stop offset="1" stopColor="#E2E6F0" stopOpacity={0} />
      </radialGradient>
    </defs>,
  ];
  for (let rw = rows - 1; rw >= 0; rw--) {
    const sc = s * (1 - rw * 0.16);
    for (let j = 0; j < n; j++) {
      const idx = rw * 17 + j;
      const xx = lerp(x0, x1, (j + 0.5 + (rw % 2) * 0.4) / n) + range(`${seed}x${idx}`, -20, 20);
      const yy = (y ?? band.gy(xx)) - rw * dy * k;
      const lk = ARMY_HEAVEN(idx);
      out.push(
        <g key={`${rw}-${j}`} opacity={p * (1 - rw * 0.14)}>
          <WhiteHorse
            x={xx}
            y={yy}
            s={sc}
            flip={flip}
            run={run !== undefined ? run + idx * 0.7 : undefined}
            walk={walk !== undefined ? walk + idx * 0.9 : undefined}
            glow={0.35}
            tack="plain"
            cloth="#F2EEE4"
            drape={lk.robe ?? "#F2EEE4"}
            rider={<Person x={0} y={0} s={1} look={lk} pose={{ sit: 1, lean: run !== undefined ? 6 : 0, arm: [50, 40], arm2: [30, 50] }} shadow={false} />}
          />
        </g>,
      );
    }
    if (cloud) {
      out.push(
        <g key={`c${rw}`}>
          {Array.from({ length: 22 }, (_, i) => {
            const cx = lerp(x0 - 120, x1 + 120, i / 21) + range(`${seed}cx${rw}${i}`, -30, 30) + Math.sin(f * 0.02 + i) * 6;
            const cy = (y ?? band.gy(cx)) - rw * dy * k + range(`${seed}cy${rw}${i}`, 0, 22) * sc * k;
            const rr = range(`${seed}cr${rw}${i}`, 40, 76) * sc * k;
            return <ellipse key={i} cx={cx} cy={cy} rx={rr * 1.5} ry={rr * 0.7} fill={`url(#${cid})`} />;
          })}
        </g>,
      );
    }
  }
  return <g>{out}</g>;
};

// ── Places ───────────────────────────────────────────────────────────────────────────────

/** A cave opening in a hillside face (band coordinates, the mouth's sill at (x, y)): an overhanging lip of rock, a dark
 *  irregular mouth with a faint inner glow, boulders at the sill. About 220 wide and 150 tall at s = 1. */
const HillCave: React.FC<{ x: number; y: number; s?: number; glow?: number; seed: string }> = ({ x, y, s = 1, glow = 0, seed }) => {
  const band = useBand();
  const k = s * band.k;
  const id = useUid("hc");
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${k})`}>
      <defs>
        <radialGradient id={id} cx="0.5" cy="0.75" r="0.7">
          <stop offset="0" stopColor={glow > 0 ? "#3A2414" : "#16100C"} />
          <stop offset="1" stopColor="#050304" />
        </radialGradient>
      </defs>
      <path d="M -120 6 Q -128 -60 -96 -110 Q -40 -170 30 -158 Q 104 -140 124 -70 Q 132 -24 118 6 Z" fill="#4A4038" />
      <path d="M -74 2 Q -84 -54 -52 -92 Q -10 -116 34 -102 Q 70 -86 74 -40 Q 76 -14 70 2 Z" fill={`url(#${id})`} />
      {glow > 0 ? <GlowS x={0} y={-30} r={70} color="255,170,90" opacity={0.5 * glow} /> : null}
      <path d="M -112 -84 Q -60 -150 20 -146 Q 86 -138 118 -80 Q 72 -118 10 -122 Q -56 -124 -112 -84 Z" fill="#6E6256" stroke="rgba(255,210,160,0.45)" strokeWidth={1.6} />
      <path d="M -74 2 Q -84 -54 -52 -92 Q -10 -116 34 -102 Q 70 -86 74 -40 Q 76 -14 70 2" fill="none" stroke="rgba(255,210,160,0.35)" strokeWidth={1.4} />
      {[[-96, 4, 26, 16], [88, 6, 30, 18], [-50, 8, 18, 10], [40, 9, 16, 9]].map(([bx, by, rx, ry], i) => (
        <ellipse key={i} cx={bx + range(`${seed}${i}`, -4, 4)} cy={by - ry * 0.6} rx={rx} ry={ry} fill={i % 2 ? "#5A5048" : "#4E463E"} stroke="rgba(255,210,160,0.35)" strokeWidth={1.2} />
      ))}
    </g>
  );
};

/**
 * Patmos (1:9): a rocky island in a wide sea at dawn. A rugged headland rises on the left (mid band) with the cave in its
 * side (`cave`, at `cx`), the sea runs wide to distant islands on the right, and John stands on the rocky shore of the near
 * band (Person s ≈ 1 at ridgeY(useLandGeo("hills", seed).near, x)). `voice` 0..1 opens a light behind him with rays (the
 * loud voice like a trumpet, 1:10) at (vx, vy).
 */
export const PatmosSet: React.FC<SetP & { cave?: boolean; cx?: number; voice?: number; vx?: number; vy?: number }> = ({ cam, seed, tod = 0.29, near, mid, far, front, fx, sky, storm = 0, cave = true, cx, voice = 0, vx, vy }) => {
  const { p, W, H, hz } = useLayout();
  const K = useBandK();
  const f = useCurrentFrame();
  const geo = useLandGeo("hills", seed);
  const night = tod > 0.78 || tod < 0.2;
  const peakX = p(330, 190);
  const cliffX = p(820, 560);
  const head = (x: number) => {
    const t = (x - peakX) / p(430, 300);
    const hill = Math.exp(-t * t * 1.4) * p(230, 300) + Math.exp(-Math.pow((x - peakX + p(260, 160)) / p(300, 200), 2)) * p(60, 80);
    const rough = 10 * Math.sin(x * 0.05 + 1) + 5 * Math.sin(x * 0.13) + 3 * Math.sin(x * 0.31);
    const yy = hz + p(70, 80) - hill + rough;
    if (x <= cliffX) return yy;
    const u = (x - cliffX) / 70;
    return yy + u * u * 220;
  };
  const caveX = cx ?? p(470, 290);
  const sun = { x: p(1560, 860), y: hz - p(40, 60), size: 1.2, a: night ? 0 : 1 };
  const vX = vx ?? p(1420, 760);
  const vY = vy ?? p(420, 860);
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} storm={storm} clouds={0.35} stars={night ? 1 : 0.2} sun={night ? null : sun} seed={`${seed}s`} {...sky} />
      <Band depth={0.1} ridge={{ base: hz - 4, amp: 26, seed: `${seed}f` }} peaks fill="#5A6478" haze={0.62} edge={0.3} k={K.far}>
        {far}
      </Band>
      <Water depth={0.25} y={hz + 2} haze={0.2} k={K.mid} color="#2A4A60" rough={0.1} shine={{ x: sun.x, a: night ? 0.2 : 0.9 }} />
      <Band depth={0.45} shape={head} fill="#5A5046" fill2="#221C18" haze={0.2} edge={0.6} k={K.mid}>
        {Array.from({ length: 16 }, (_, i) => {
          const xx = lerp(-260, cliffX - 30, i / 15) + range(`${seed}sx${i}`, -20, 20);
          const dy = range(`${seed}sy${i}`, 30, 180);
          return <path key={i} d={`M ${f1(xx)} ${f1(head(xx) + dy)} l ${p(50, 34)} ${p(14, 10)} l ${p(44, 28)} ${-p(6, 5)} l ${p(30, 20)} ${p(8, 6)}`} stroke="rgba(24,18,14,0.4)" strokeWidth={1.8} fill="none" />;
        })}
        {Array.from({ length: 6 }, (_, i) => {
          const xx = lerp(-100, cliffX - 80, i / 5) + range(`${seed}bx${i}`, -30, 30);
          return <path key={`sh${i}`} d={`M ${f1(xx)} ${f1(head(xx) + 4)} q ${p(10, 8)} ${-p(14, 12)} ${p(22, 16)} 0 q ${p(8, 6)} ${-p(10, 8)} ${p(16, 12)} 0`} fill="#3E4A2E" opacity={0.85} />;
        })}
        <path d={`M ${cliffX - p(10, 6)} ${f1(head(cliffX - p(10, 6)))} L ${cliffX + p(30, 20)} ${f1(head(cliffX) + p(140, 160))} L ${cliffX + p(60, 40)} ${f1(head(cliffX) + p(320, 360))}`} stroke="rgba(255,206,150,0.4)" strokeWidth={2} fill="none" />
        {cave ? <HillCave x={caveX} y={head(caveX) + p(118, 140)} s={p(0.62, 0.66)} seed={`${seed}cv`} /> : null}
        <Rock x={cliffX - p(30, 20)} y={head(cliffX - p(30, 20)) + 20} s={1.4} color="#4E463E" seed={`${seed}r1`} />
        {mid}
      </Band>
      <Band depth={0.8} ridge={{ ...geo.near, amp: 12 }} fill="#4A4038" fill2="#1E1A16" haze={0.05} edge={0.5} k={K.near}>
        {Array.from({ length: 9 }, (_, i) => {
          const xx = lerp(-100, W + 100, i / 8) + range(`${seed}rx${i}`, -60, 60);
          return <Rock key={i} x={xx} s={range(`${seed}rs${i}`, 0.7, 1.5)} color={i % 2 ? "#5A5048" : "#4A423A"} seed={`${seed}nr${i}`} w={70} h={34} />;
        })}
        {near}
      </Band>
      <Band depth={1} ridge={geo.front} fill="#1E1A16" haze={0} edge={0.3} k={K.front}>
        {front}
      </Band>
      {voice > 0 ? (
        <>
          <Glow x={vX} y={vY} size={p(1100, 900)} color="255,226,170" opacity={0.45 * voice} />
          <Glow x={vX} y={vY} size={p(220, 200)} color="255,250,236" opacity={0.9 * voice} />
          <Svg style={{ mixBlendMode: "screen" }}>
            <defs>
              <radialGradient id={`${seed}vg`} gradientUnits="userSpaceOnUse" cx={vX} cy={vY} r={p(700, 600)}>
                <stop offset="0" stopColor="rgb(255,240,206)" stopOpacity={0.4 * voice} />
                <stop offset="0.45" stopColor="rgb(255,230,180)" stopOpacity={0.1 * voice} />
                <stop offset="1" stopColor="rgb(255,226,170)" stopOpacity={0} />
              </radialGradient>
            </defs>
            {Array.from({ length: 36 }, (_, i) => {
              const a = (i / 36) * Math.PI * 2 + f * 0.002 + random(`${seed}va${i}`) * 0.1;
              const L = p(700, 600) * (0.6 + 0.4 * random(`${seed}v${i}`));
              const w = 0.012 + 0.02 * random(`${seed}vw${i}`);
              return <path key={i} d={`M ${vX} ${vY} L ${f1(vX + Math.cos(a - w) * L)} ${f1(vY + Math.sin(a - w) * L)} L ${f1(vX + Math.cos(a + w) * L)} ${f1(vY + Math.sin(a + w) * L)} Z`} fill={`url(#${seed}vg)`} />;
            })}
            {[0, 1, 2].map((i) => {
              const t = mod(f * 0.02 + i / 3, 1);
              return <circle key={`r${i}`} cx={vX} cy={vY} r={60 + t * p(380, 320)} fill="none" stroke={`rgba(255,236,190,${(0.5 * (1 - t) * voice).toFixed(3)})`} strokeWidth={3 * (1 - t) + 0.6} />;
            })}
          </Svg>
        </>
      ) : null}
      {fx}
    </Stage>
  );
};

/** Layout of LampstandsSet for the current orientation: ring centre (cx, cy), radii, lampstand scale `ls` and the Son of
 *  Man's scale `ss` (the set's band has k = 1). John falls at His feet at about (cx + 140·dir, cy + 60). */
export const useLampRing = () => {
  const { p, W } = useLayout();
  return { cx: W / 2, cy: p(820, 1360), rx: p(660, 390), ry: p(120, 110), ls: p(1.25, 1.3), ss: p(1.7, 1.9) };
};

/**
 * The vision of Revelation 1:12–20: seven golden lampstands standing in a ring in a dark, star-dusted space, on a dark floor
 * that mirrors their flames, and among them the Son of Man (`son`: true draws SonOfMan with the seven stars; or pass your own
 * node in band coordinates; false for none). `lit` 0..1 lights the lamps one by one, `stars` the stars in His hand, `glow`.
 * Extra figures (John) go in `children`, drawn in front of the ring at the band's ground y = cy (use useLampRing()).
 */
export const LampstandsSet: React.FC<{ cam: CamT; seed?: string; lit?: number; son?: boolean | React.ReactNode; stars?: number; sword?: number; glow?: number; children?: React.ReactNode; fx?: React.ReactNode }> = ({
  cam,
  seed = "ls",
  lit = 1,
  son = true,
  stars = 1,
  sword = 0,
  glow = 1,
  children,
  fx,
}) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const L = useLampRing();
  const floorTop = L.cy - L.ry * 2.6;
  const lamps = Array.from({ length: 7 }, (_, i) => {
    const th = (-90 + (i * 360) / 7) * D2R;
    const depth = Math.sin(th);
    return { i, x: L.cx + Math.cos(th) * L.rx, y: L.cy + depth * L.ry, s: L.ls * (1 + 0.2 * depth), depth };
  }).sort((a, b) => a.depth - b.depth);
  const back = lamps.filter((l) => l.depth < 0.05);
  const front = lamps.filter((l) => l.depth >= 0.05);
  const lamp = (l: (typeof lamps)[number]) => {
    const a = clamp1(lit * 7 - l.i);
    return (
      <g key={l.i}>
        <rect x={l.x - 4 * l.s} y={l.y + 4} width={8 * l.s} height={150 * l.s} fill={`url(#${seed}rf)`} opacity={0.35 + 0.65 * a} />
        <ellipse cx={l.x} cy={l.y + 2} rx={34 * l.s} ry={6 * l.s} fill={`rgba(255,200,120,${(0.18 * a).toFixed(3)})`} />
        <GoldenLampstand x={l.x} y={l.y} s={l.s} lit={a} seed={`${seed}${l.i}`} />
      </g>
    );
  };
  return (
    <Stage cam={cam} tod={0.5} night={0} rim="255,214,150" rimA={0.75}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${p(1300, 1000)}px ${p(800, 1200)}px at 50% ${p(58, 56)}%, #241C30 0%, #0E0C18 45%, #040409 100%)` }} />
      <StarField n={p(380, 420)} p={1} seed={`${seed}sf`} area={{ x: 0, y: 0, w: W, h: floorTop }} big={20} />
      <Glow x={L.cx} y={L.cy - 200 * L.ss * 0.6} size={p(1500, 1300)} color="255,214,150" opacity={0.28 * glow} />
      <Band depth={0.5} k={1}>
        <defs>
          <linearGradient id={`${seed}fl`} gradientUnits="userSpaceOnUse" x1={0} y1={floorTop} x2={0} y2={H}>
            <stop offset="0" stopColor="#0A0810" stopOpacity={0} />
            <stop offset="0.25" stopColor="#14101C" />
            <stop offset="1" stopColor="#1C1622" />
          </linearGradient>
          <linearGradient id={`${seed}rf`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(226,184,80)" stopOpacity={0.55} />
            <stop offset="1" stopColor="rgb(226,184,80)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect x={-500} y={floorTop} width={W + 1000} height={H - floorTop + 600} fill={`url(#${seed}fl)`} />
        {[0.5, 0.8, 1.15, 1.6].map((k, i) => (
          <ellipse key={i} cx={L.cx} cy={L.cy} rx={L.rx * k} ry={L.ry * k} fill="none" stroke={`rgba(232,192,96,${(0.12 - i * 0.02).toFixed(3)})`} strokeWidth={1.2} />
        ))}
        {back.map(lamp)}
        {son === true ? <SonOfMan x={L.cx} y={L.cy} s={L.ss} stars={stars} sword={sword} glow={glow} /> : son || null}
        {front.map(lamp)}
        {children}
      </Band>
      <Dust count={50} seed={`${seed}d`} opacity={0.5} vy={-0.2} />
      {fx}
    </Stage>
  );
};

/** Layout of HeavenThroneSet for the current orientation (the set's band has k = 1): throne base (dais front) at (cx, base),
 *  its scale `ts`, the Lamb's anchor `seat`, the light of the One seated at `glory`, the elders' horseshoe radii, the sea of
 *  glass, the seven torches' row, the four creatures' centres and the emerald halo. */
export const useThroneRoom = () => {
  const { p, W } = useLayout();
  const cx = W / 2;
  const base = p(640, 1190);
  const ts = p(0.74, 0.8);
  return {
    cx,
    base,
    ts,
    seat: base - 126 * ts,
    glory: base - 212 * ts,
    ring: { rx: p(820, 430), ry: p(170, 150) },
    elderS: p(0.5, 0.42),
    sea: { y: p(850, 1405), rx: p(480, 420), ry: p(84, 70) },
    torches: { y: p(712, 1272), w: p(560, 470) },
    halo: { y: base - 196 * ts, r: p(300, 270) },
    creatures: [
      { kind: "lion" as const, x: cx - p(420, 330), y: base - p(300, 360) },
      { kind: "ox" as const, x: cx + p(420, 330), y: base - p(300, 360) },
      { kind: "man" as const, x: cx - p(330, 300), y: base - p(80, 80) },
      { kind: "eagle" as const, x: cx + p(330, 300), y: base - p(80, 80) },
    ],
    creatureS: p(0.44, 0.36),
  };
};

/** A small throne of white and gold for an elder: seat 44, back 132 at s = 1 (band coordinates, base y = 0). */
const ElderSeat: React.FC<{ x: number; y: number; s: number; flip?: boolean }> = ({ x, y, s, flip = false }) => (
  <g transform={`translate(${f1(x)} ${f1(y)}) scale(${flip ? -s : s} ${s})`}>
    <ellipse cx={0} cy={0} rx={40} ry={4} fill="rgba(0,0,0,0.3)" />
    <path d="M -30 -40 L -38 -128 Q -38 -140 -30 -140 Q -22 -140 -22 -130 L -18 -40 Z" fill="#C8B490" stroke={GOLD} strokeWidth={1.4} />
    <path d="M -33 -60 L -21 -60 M -35 -96 L -22 -96" stroke={GOLD} strokeWidth={1.4} />
    <circle cx={-30} cy={-144} r={4} fill={GOLD} />
    <rect x={-32} y={-48} width={58} height={8} rx={2} fill={GOLD} />
    <path d="M -28 -40 L -28 0 M 20 -40 L 20 0" stroke="#B8A27A" strokeWidth={6} strokeLinecap="round" />
    <path d="M -28 -16 L 20 -16" stroke="#B8A27A" strokeWidth={3} />
  </g>
);

/**
 * The throne room of Revelation 4–5: the throne in heaven with the One seated as light (jasper and carnelian), an emerald
 * rainbow round it, seven torches before it, the sea of glass like crystal, the twenty-four elders on their thrones in a
 * horseshoe with golden crowns, the four living creatures, lightning. Every part has a 0..1 control: `presence`, `rainbow`,
 * `torches`, `sea` (`fire` mixes fire into it, 15:2), `elders`, `creatures`; `cast` makes the elders cast their crowns before
 * the throne and fall down (4:10), `worship` makes them fall down only; `harps` gives them harps and bowls (5:8); `lamb` 0..1
 * stands the Lamb in the centre of the throne (5:6); `scroll` shows the sealed scroll at the right hand of the One seated
 * (`broken` seals 0..7); `host` 0..1 rings of angels beyond (5:11); `bolts` frames for lightning; `door` 0..1 opens the door
 * in heaven in front of it all (4:1: 0 shut, 0.6 open, 1 passed through). Coordinates: useThroneRoom().
 */
export const HeavenThroneSet: React.FC<{
  cam: CamT; seed?: string; presence?: number; rainbow?: number; sea?: number; fire?: number; torches?: number; elders?: number; cast?: number; worship?: number; harps?: boolean;
  creatures?: number; lamb?: number; scroll?: number; broken?: number; host?: number; bolts?: number[]; door?: number; children?: React.ReactNode; fx?: React.ReactNode;
}> = ({ cam, seed = "ht", presence = 1, rainbow = 1, sea = 1, fire = 0, torches = 1, elders = 1, cast = 0, worship, harps = false, creatures = 1, lamb = 0, scroll = 0, broken = 0, host = 0, bolts = [], door, children, fx }) => {
  const { p, W, H, v } = useLayout();
  const f = useCurrentFrame();
  const R = useThroneRoom();
  const elderList = elders > 0
    ? Array.from({ length: 24 }, (_, i) => {
        const side = i < 12 ? -1 : 1;
        const j = i % 12;
        const thL = (252 - (j * 124) / 11) * D2R;
        const sn = Math.sin(thL);
        const x = R.cx + (side < 0 ? Math.cos(thL) : -Math.cos(thL)) * R.ring.rx;
        const y = R.base + sn * R.ring.ry;
        return { i, side, x, y, s: R.elderS * (1 + 0.3 * sn), depth: sn };
      }).sort((a, b) => a.depth - b.depth)
    : [];
  const elder = (e: (typeof elderList)[number]) => {
    const a = clamp1(elders * 24 - (e.i % 12) * 2 - (e.side > 0 ? 1 : 0));
    if (a <= 0) return null;
    return (
      <g key={`e${e.i}`} opacity={a}>
        <ElderSeat x={e.x} y={e.y} s={e.s} flip={e.side > 0} />
        <CrownedElder x={e.x} y={e.y} s={e.s} flip={e.side > 0} i={e.i} seated cast={cast} worship={worship} harp={harps && e.i % 2 === 0} bowl={harps && e.i % 2 === 1} target={[58, 0]} />
      </g>
    );
  };
  const backE = elderList.filter((e) => e.depth < 0);
  const frontE = elderList.filter((e) => e.depth >= 0);
  const cr = R.creatures;
  const creature = (c: (typeof cr)[number], i: number) => <LivingCreature key={c.kind} kind={c.kind} x={c.x} y={c.y} s={R.creatureS} p={clamp1(creatures * 4 - i)} flip={i % 2 === 1} />;
  const doorO = door === undefined ? 1 : door;
  const wall = door === undefined ? 0 : 1 - ease.inOut(seg(door, 0.55, 1));
  const dW = p(560, 640);
  const dH = p(800, 1160);
  const dY = p(1020, 1560);
  return (
    <Stage cam={cam} tod={0.5} night={0} rim="255,226,170" rimA={0.8}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${p(1500, 1100)}px ${p(1000, 1500)}px at 50% ${(R.glory / H) * 100}%, #3A3050 0%, #1A1830 38%, #0A0A18 72%, #05050C 100%)` }} />
      {host > 0 ? (
        <Svg style={{ mixBlendMode: "screen" }}>
          {Array.from({ length: 5 }, (_, ring) =>
            Array.from({ length: 34 + ring * 10 }, (_, j) => {
              const n = 34 + ring * 10;
              const a = Math.PI + (j / (n - 1)) * Math.PI;
              const rx = p(620, 420) + ring * p(110, 70);
              const ry = p(360, 420) + ring * p(70, 60);
              const x = R.cx + Math.cos(a) * rx;
              const y = R.glory + Math.sin(a) * ry * 0.9 + p(40, 60);
              const vis = clamp1(host * 5 - ring);
              const tw = 0.6 + 0.4 * Math.sin(f * 0.08 + j + ring);
              return vis > 0 ? (
                <g key={`${ring}-${j}`} opacity={vis * tw * (1 - ring * 0.12)}>
                  <circle cx={x} cy={y} r={4.6 - ring * 0.5} fill="#FFF6DE" />
                  <path d={`M ${f1(x - 9 + ring)} ${f1(y - 6)} Q ${f1(x)} ${f1(y - 1)} ${f1(x + 9 - ring)} ${f1(y - 6)}`} stroke="rgba(255,226,160,0.8)" strokeWidth={1.2} fill="none" />
                </g>
              ) : null;
            }),
          )}
        </Svg>
      ) : null}
      <Glow x={R.cx} y={R.glory} size={p(1700, 1400)} color="255,206,140" opacity={0.3 * presence} />
      <Glow x={R.cx} y={R.glory} size={p(700, 620)} color="255,236,200" opacity={0.35 * presence} />
      <Band depth={0.5} k={1}>
        {backE.map(elder)}
        {creature(cr[0], 0)}
        {creature(cr[1], 1)}
        <RainbowHalo x={R.cx} y={R.halo.y} rx={R.halo.r} ry={R.halo.r * 1.04} p={rainbow} width={p(26, 24)} />
        <HeavenThrone
          x={R.cx}
          y={R.base}
          s={R.ts}
          presence={presence}
          glow={presence}
          seat={lamb > 0 ? <LambStanding x={0} y={0} s={1.35} p={lamb} /> : null}
        />
        {scroll > 0 ? (
          <g opacity={scroll}>
            <Scroll7 x={R.cx + 92 * R.ts} y={R.base - 214 * R.ts} s={R.ts * 0.72} broken={broken} glow={0.8} rot={-4} />
          </g>
        ) : null}
        <SevenTorches x={R.cx} y={R.torches.y} w={R.torches.w} s={p(0.9, 0.8)} lit={torches} arc={p(26, 20)} seed={`${seed}t`} />
        {creature(cr[2], 2)}
        {creature(cr[3], 3)}
        <SeaOfGlass x={R.cx} y={R.sea.y} rx={R.sea.rx} ry={R.sea.ry} p={sea} fire={fire} seed={`${seed}sg`} />
        {frontE.map(elder)}
        {children}
      </Band>
      <Dust count={70} seed={`${seed}d`} color="255,236,200" opacity={0.55} vy={-0.25} />
      {bolts.map((b, i) => (
        <Lightning key={i} at={b} x={R.cx + (i % 2 ? 1 : -1) * p(220 + 60 * (i % 3), 160)} y={R.glory - p(40, 60)} seed={`${seed}lt${i}`} dur={12} />
      ))}
      {wall > 0 ? (
        <Svg>
          <defs>
            <mask id={`${seed}dm`}>
              <rect x={0} y={0} width={W} height={H} fill="white" />
              <path d={`M ${W / 2 - dW / 2} ${dY} L ${W / 2 - dW / 2} ${dY - dH + dW / 2} A ${dW / 2} ${dW / 2} 0 0 1 ${W / 2 + dW / 2} ${dY - dH + dW / 2} L ${W / 2 + dW / 2} ${dY} Z`} fill="black" />
            </mask>
            <linearGradient id={`${seed}dg`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0A0E22" />
              <stop offset="1" stopColor="#1A1A30" />
            </linearGradient>
          </defs>
          <g opacity={wall} mask={`url(#${seed}dm)`}>
            <rect x={0} y={0} width={W} height={H} fill={`url(#${seed}dg)`} />
            {Array.from({ length: 160 }, (_, i) => (
              <circle key={i} cx={random(`${seed}ws${i}`) * W} cy={random(`${seed}wy${i}`) * H} r={range(`${seed}wr${i}`, 0.5, 1.8)} fill={`rgba(232,238,255,${(0.3 + 0.5 * random(`${seed}wa${i}`)).toFixed(2)})`} />
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse key={`c${i}`} cx={range(`${seed}cx${i}`, 0, W)} cy={range(`${seed}cy${i}`, H * 0.55, H)} rx={range(`${seed}crx${i}`, 300, 600)} ry={range(`${seed}cry${i}`, 50, 90)} fill="rgba(150,150,190,0.12)" />
            ))}
          </g>
          <g opacity={wall}>
            <HeavenDoor x={W / 2} y={dY} w={dW} h={dH} open={ease.inOut(seg(doorO, 0, 0.6))} glow={0.5} />
          </g>
        </Svg>
      ) : null}
      {fx}
    </Stage>
  );
};

// ── The seven churches ───────────────────────────────────────────────────────────────────

/** The seven cities in the order of the letters (Revelation 2–3), lon/lat, with label offsets [dx, dy] in label heights. */
export const CHURCHES: { name: string; lon: number; lat: number; dx: number; dy: number }[] = [
  { name: "EPHESUS", lon: 27.34, lat: 37.94, dx: -0.2, dy: 1.6 },
  { name: "SMYRNA", lon: 27.14, lat: 38.42, dx: 0.4, dy: 1.6 },
  { name: "PERGAMUM", lon: 27.18, lat: 39.12, dx: 0, dy: -2.4 },
  { name: "THYATIRA", lon: 27.84, lat: 38.92, dx: 0.6, dy: -2.4 },
  { name: "SARDIS", lon: 28.04, lat: 38.49, dx: 0.4, dy: 1.6 },
  { name: "PHILADELPHIA", lon: 28.52, lat: 38.35, dx: 0.9, dy: -2.4 },
  { name: "LAODICEA", lon: 29.11, lat: 37.84, dx: 0.2, dy: 1.6 },
];
const PATMOS: [number, number] = [26.55, 37.32];
const COAST: [number, number][] = [
  [26.2, 42.6], [26.2, 41.0], [26.3, 40.3], [26.15, 40.0], [26.07, 39.48], [26.35, 39.48], [26.7, 39.55], [27.0, 39.57], [26.85, 39.45], [26.7, 39.34], [26.75, 39.2], [26.88, 39.07],
  [26.95, 38.95], [26.96, 38.82], [26.82, 38.75], [26.74, 38.66], [26.88, 38.58], [27.0, 38.48], [27.14, 38.43], [27.0, 38.4], [26.88, 38.37], [26.75, 38.37], [26.62, 38.45], [26.55, 38.58],
  [26.5, 38.66], [26.38, 38.55], [26.37, 38.42], [26.3, 38.32], [26.38, 38.22], [26.55, 38.2], [26.78, 38.18], [26.9, 38.08], [27.12, 37.98], [27.27, 37.93], [27.25, 37.85], [27.2, 37.72],
  [27.05, 37.66], [27.2, 37.58], [27.3, 37.52], [27.22, 37.42], [27.25, 37.35], [27.4, 37.3], [27.55, 37.25], [27.45, 37.15], [27.3, 37.05], [27.42, 37.0], [27.6, 36.95], [28.0, 36.85],
  [28.4, 36.7], [29.0, 36.6], [35, 36.6], [35, 42.6],
];
const ISLES: { c: [number, number]; rx: number; ry: number; a: number }[] = [
  { c: [26.25, 39.15], rx: 0.48, ry: 0.22, a: -18 },
  { c: [26.0, 38.38], rx: 0.16, ry: 0.3, a: 8 },
  { c: [26.8, 37.73], rx: 0.27, ry: 0.09, a: -6 },
  { c: [26.2, 37.6], rx: 0.2, ry: 0.06, a: -14 },
  { c: [26.55, 37.32], rx: 0.05, ry: 0.07, a: 20 },
  { c: [26.85, 37.15], rx: 0.07, ry: 0.06, a: 0 },
  { c: [27.15, 36.86], rx: 0.24, ry: 0.06, a: -10 },
  { c: [25.4, 38.55], rx: 0.12, ry: 0.08, a: 10 },
];
const RIVERS: [number, number][][] = [
  [[28.9, 38.75], [28.4, 38.6], [28.0, 38.6], [27.6, 38.62], [27.2, 38.62], [26.95, 38.6]],
  [[28.2, 38.15], [27.8, 38.1], [27.5, 38.0], [27.3, 37.95]],
  [[29.3, 37.85], [28.8, 37.9], [28.3, 37.9], [27.8, 37.7], [27.5, 37.6], [27.3, 37.55]],
  [[27.8, 39.3], [27.5, 39.15], [27.2, 39.05], [26.95, 38.98]],
];

/** Where ChurchesMap puts a lon/lat on screen for the current orientation, and each city's screen position. */
export const useChurchMap = () => {
  const { p, W } = useLayout();
  const lat0 = p(38.3, 38.25);
  const lon0 = p(27.75, 27.7);
  const sc = p(300, 318);
  const cy = p(700, 1150);
  const cx = W / 2 + p(60, 0);
  const k = Math.cos(lat0 * D2R);
  const to = (lon: number, lat: number): Pt => [cx + (lon - lon0) * k * sc, cy - (lat - lat0) * sc];
  return { to, cities: CHURCHES.map((c) => to(c.lon, c.lat)), patmos: to(PATMOS[0], PATMOS[1]), sc };
};

/**
 * The seven churches of Asia on a stylized map in gold line art (Revelation 1:11; 2–3): the Aegean with Patmos, the coast of
 * Asia, rivers, and the seven cities each with a small golden lampstand and its name. `p` 0..1 draws the coast on, `cities`
 * 0..7 brings in the cities in letter order, `lamps` 0..7 lights their lampstands, `active` highlights one city (index,
 * -1 none), `route` 0..1 draws the messenger's road from Patmos round the seven, `labels`. Screen positions: useChurchMap().
 */
export const ChurchesMap: React.FC<{ cam?: CamT; p?: number; cities?: number; lamps?: number; active?: number; route?: number; labels?: boolean; seed?: string; fx?: React.ReactNode }> = ({
  cam,
  p: draw = 1,
  cities = 7,
  lamps = 7,
  active = -1,
  route = 0,
  labels = true,
  seed = "cm",
  fx,
}) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const M = useChurchMap();
  const zoom = cam?.zoom ?? 1;
  const ox = W / 2 - (cam?.x ?? 0);
  const oy = H * 0.62 - (cam?.y ?? 0);
  const T = `translate(${f1(ox)} ${f1(oy)}) scale(${zoom.toFixed(4)}) translate(${f1(-W / 2)} ${f1(-H * 0.62)})`;
  const coast = COAST.map(([lo, la]) => M.to(lo, la));
  const coastLine = smooth(coast.slice(0, COAST.length - 2), false, 0.4);
  const land = polyline(coast, true);
  const isle = (c: (typeof ISLES)[number], i: number) => {
    const pts = Array.from({ length: 12 }, (_, j) => {
      const a = (j / 12) * Math.PI * 2;
      const rr = 1 + range(`${seed}i${i}${j}`, -0.18, 0.12);
      const q: Pt = [Math.cos(a) * c.rx * rr, Math.sin(a) * c.ry * rr];
      const r2 = rot(q, c.a);
      return M.to(c.c[0] + r2[0], c.c[1] + r2[1]);
    });
    return smooth(pts, true, 0.5);
  };
  const lbl = p(24, 28);
  const routePts = [M.patmos, ...M.cities];
  const routeD = polyline(routePts, false);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 45% 60%, #142236 0%, #0A1424 55%, #050A14 100%)" }} />
      <Svg>
        <defs>
          <linearGradient id={`${seed}ld`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3A2E22" />
            <stop offset="1" stopColor="#22190F" />
          </linearGradient>
        </defs>
        <g transform={T}>
          {Array.from({ length: 22 }, (_, i) => {
            const yy = i * (H / 20) + ((f * 0.2) % (H / 20));
            return <path key={i} d={`M -200 ${yy} q 60 -6 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0`} stroke="rgba(120,160,200,0.06)" strokeWidth={1.4} fill="none" />;
          })}
          <path d={land} fill={`url(#${seed}ld)`} opacity={draw} />
          {ISLES.map((c, i) => (
            <path key={i} d={isle(c, i)} fill={`url(#${seed}ld)`} opacity={draw} />
          ))}
          {RIVERS.map((r, i) => (
            <path key={i} d={smooth(r.map(([lo, la]) => M.to(lo, la)), false)} stroke="rgba(120,170,210,0.45)" strokeWidth={1.8} fill="none" opacity={draw} />
          ))}
          {Array.from({ length: 26 }, (_, i) => {
            const q = M.to(range(`${seed}mx${i}`, 27.6, 30.2), range(`${seed}my${i}`, 37.3, 39.6));
            return <path key={i} d={`M ${f1(q[0] - 7)} ${f1(q[1] + 3)} L ${f1(q[0])} ${f1(q[1] - 6)} L ${f1(q[0] + 7)} ${f1(q[1] + 3)}`} stroke="rgba(232,192,96,0.35)" strokeWidth={1.4} fill="none" opacity={draw} />;
          })}
          <GoldLine d={coastLine} p={draw} w={2.2} glow={0.6} />
          {ISLES.map((c, i) => (
            <GoldLine key={i} d={isle(c, i)} p={draw} w={1.6} glow={0.5} />
          ))}
          {route > 0 ? (
            <g>
              <defs>
                <mask id={`${seed}rm`}>
                  <path d={routeD} stroke="white" strokeWidth={30} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - route} strokeLinecap="round" />
                </mask>
              </defs>
              <g mask={`url(#${seed}rm)`}>
                <path d={routeD} stroke="rgba(255,226,160,0.22)" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d={routeD} stroke="rgba(255,232,170,0.95)" strokeWidth={2.6} fill="none" strokeDasharray="3 9" strokeLinecap="round" />
              </g>
            </g>
          ) : null}
          <g opacity={draw}>
            {sparkleStar(M.patmos[0], M.patmos[1], 3, 0.9, "pt")}
            {labels ? (
              <text x={M.patmos[0] - lbl * 0.6} y={M.patmos[1] + lbl * 1.5} textAnchor="end" fontFamily={fonts.display} fontSize={lbl * 0.8} fontWeight={600} letterSpacing={3} fill="rgba(220,226,240,0.8)">
                PATMOS
              </text>
            ) : null}
          </g>
          {CHURCHES.map((c, i) => {
            const a = clamp1(cities - i);
            if (a <= 0) return null;
            const q = M.cities[i];
            const on = clamp1(lamps - i);
            const act = active === i ? 1 : 0;
            return (
              <g key={c.name} opacity={a}>
                <GlowS x={q[0]} y={q[1] - 20} r={60 + 50 * act} color="255,214,140" opacity={0.3 + 0.4 * on + 0.3 * act} />
                <NoScale>
                  <GoldenLampstand x={q[0]} y={q[1]} s={p(0.34, 0.36) * (1 + 0.25 * act)} lit={on} seed={`${seed}l${i}`} />
                </NoScale>
                <circle cx={q[0]} cy={q[1]} r={4} fill="#FFE8A8" />
                {labels ? (
                  <text x={q[0] + c.dx * lbl * 2} y={q[1] + c.dy * lbl} textAnchor="middle" fontFamily={fonts.display} fontSize={lbl * (1 + 0.15 * act)} fontWeight={700} letterSpacing={3} fill={act ? "#FFF0C8" : "#F2D488"} style={{ paintOrder: "stroke" }} stroke="rgba(6,8,14,0.85)" strokeWidth={4}>
                    {c.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </Svg>
      {fx}
    </AbsoluteFill>
  );
};

// ── The sixth seal ───────────────────────────────────────────────────────────────────────

/**
 * The sixth seal (6:12–14), restrained: the sun black as sackcloth, the whole moon like blood, the stars falling like unripe
 * figs, the sky receding like a scroll being rolled up (it parts at the centre and rolls back to both sides, showing the
 * light beyond), every mountain moved. `dark` 0..1 darkens the sun, `moon` 0..1 reddens the moon, `fall` 0..1 brings stars
 * down, `roll` 0..1 rolls the sky away, `quake` 0..1 shakes the land. `near` takes figures on the land (kings hiding in the
 * rocks: Person s ≈ 1 on ridgeY(useLandGeo("mountains", seed).near, x)).
 */
export const CosmicSky: React.FC<{ cam: CamT; seed?: string; dark?: number; moon?: number; fall?: number; roll?: number; quake?: number; near?: React.ReactNode; fx?: React.ReactNode; land?: boolean }> = ({
  cam,
  seed = "cs",
  dark = 1,
  moon = 1,
  fall = 0.6,
  roll = 0,
  quake = 0,
  near,
  fx,
  land = true,
}) => {
  const { p, W, H, hz } = useLayout();
  const f = useCurrentFrame();
  const id = useUid("cs");
  const K = useBandK();
  const geo = useLandGeo("mountains", seed);
  const sh = quake > 0 ? shake(f, 0, 100000, 6 * quake, `${seed}q`) : { x: 0, y: 0 };
  const sun = { x: p(300, 250), y: p(380, 860), r: p(66, 60) };
  const mo = { x: p(1640, 840), y: p(330, 820), r: p(52, 48) };
  const sunC = mixHex("#FFF2C8", "#0A080C", dark);
  const moonC = mixHex("#E8ECF6", "#8A1C16", moon);
  const gap = ease.inOut(clamp1(roll)) * W * 0.56;
  const rw = p(44, 40) * (1 + roll * 0.6);
  const cxs = W / 2;
  const stars = Array.from({ length: 260 }, (_, i) => ({ x: random(`${seed}x${i}`) * W, y: Math.pow(random(`${seed}y${i}`), 1.2) * hz, r: range(`${seed}r${i}`, 0.5, 2) }));
  const falling = Array.from({ length: 26 }, (_, i) => {
    const t = mod(f * 0.008 * range(`${seed}fs${i}`, 0.7, 1.3) + random(`${seed}ft${i}`), 1);
    const x0 = random(`${seed}fx${i}`) * W;
    const y0 = random(`${seed}fy${i}`) * hz * 0.6;
    const x = x0 - t * p(160, 100);
    const y = y0 + t * (hz + 60 - y0);
    return { x, y, t, i };
  });
  const half = (side: -1 | 1) => {
    const x0 = side < 0 ? -100 : cxs + gap / 2;
    const x1 = side < 0 ? cxs - gap / 2 : W + 100;
    return { x0, x1 };
  };
  const skyContent = (
    <g>
      <rect x={-100} y={-100} width={W + 200} height={hz + 300} fill={`url(#${id}g)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={`rgba(232,238,255,${(0.35 + 0.4 * Math.sin(f * 0.05 + i)).toFixed(3)})`} />
      ))}
      <circle cx={sun.x} cy={sun.y} r={sun.r * 1.5} fill={`rgba(255,220,160,${(0.25 * (1 - dark)).toFixed(3)})`} />
      <circle cx={sun.x} cy={sun.y} r={sun.r} fill={sunC} stroke={`rgba(200,170,130,${(0.35 * dark).toFixed(3)})`} strokeWidth={3} />
      {dark > 0.4
        ? Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1={sun.x - sun.r * 0.8} y1={sun.y - sun.r * 0.7 + i * sun.r * 0.15} x2={sun.x + sun.r * 0.8} y2={sun.y - sun.r * 0.7 + i * sun.r * 0.15 + 2} stroke="rgba(60,50,46,0.4)" strokeWidth={1} opacity={dark} />
          ))
        : null}
      <circle cx={mo.x} cy={mo.y} r={mo.r * 2.2} fill={`rgba(160,40,30,${(0.18 * moon).toFixed(3)})`} />
      <circle cx={mo.x} cy={mo.y} r={mo.r} fill={moonC} />
      <circle cx={mo.x - mo.r * 0.3} cy={mo.y - mo.r * 0.2} r={mo.r * 0.22} fill="rgba(0,0,0,0.12)" />
      <circle cx={mo.x + mo.r * 0.25} cy={mo.y + mo.r * 0.3} r={mo.r * 0.15} fill="rgba(0,0,0,0.1)" />
      {fall > 0
        ? falling.map((s) => (
            <g key={s.i} opacity={fall * Math.sin(Math.PI * s.t)}>
              <line x1={s.x} y1={s.y} x2={s.x + p(30, 22)} y2={s.y - p(80, 60)} stroke="rgba(255,236,200,0.5)" strokeWidth={2} />
              <circle cx={s.x} cy={s.y} r={2.6} fill="#FFF4DC" />
            </g>
          ))
        : null}
    </g>
  );
  return (
    <Stage cam={cam} tod={0.9} night={0.7}>
      <AbsoluteFill style={{ background: "#06050C" }} />
      <Svg>
        <defs>
          <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={hz + 100}>
            <stop offset="0" stopColor="#05060F" />
            <stop offset="0.6" stopColor="#141230" />
            <stop offset="1" stopColor={mixHex("#3A2440", "#5A1E1A", moon * 0.5)} />
          </linearGradient>
          <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2A1C0E" />
            <stop offset="0.3" stopColor="#8A6A36" />
            <stop offset="0.5" stopColor="#D8B46A" />
            <stop offset="0.7" stopColor="#8A6A36" />
            <stop offset="1" stopColor="#2A1C0E" />
          </linearGradient>
          <linearGradient id={`${id}gl`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgb(255,206,130)" stopOpacity={0.55} />
            <stop offset="0.5" stopColor="rgb(255,252,240)" stopOpacity={0.95} />
            <stop offset="1" stopColor="rgb(255,206,130)" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id={`${id}sh`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000000" stopOpacity={0} />
            <stop offset="1" stopColor="#000000" stopOpacity={0.55} />
          </linearGradient>
          {([-1, 1] as const).map((sd) => {
            const hh = half(sd);
            return (
              <clipPath key={sd} id={`${id}c${sd < 0 ? "l" : "r"}`}>
                <rect x={hh.x0} y={-200} width={Math.max(0, hh.x1 - hh.x0)} height={H + 400} />
              </clipPath>
            );
          })}
        </defs>
        {roll > 0 ? <rect x={cxs - gap / 2 - 4} y={-40} width={gap + 8} height={hz + 200} fill={`url(#${id}gl)`} opacity={Math.min(1, roll * 2.5)} /> : null}
        <g clipPath={`url(#${id}cl)`}>{skyContent}</g>
        <g clipPath={`url(#${id}cr)`}>{skyContent}</g>
        {roll > 0
          ? ([-1, 1] as const).map((sd) => {
              const ex = sd < 0 ? cxs - gap / 2 : cxs + gap / 2;
              const x = ex - rw * 0.5;
              const shX = sd < 0 ? x - 90 : x + rw;
              return (
                <g key={sd}>
                  <rect x={shX} y={-40} width={90} height={hz + 200} fill={`url(#${id}sh)`} transform={sd > 0 ? `translate(${f1(2 * shX + 90)} 0) scale(-1 1)` : undefined} />
                  <rect x={x} y={-40} width={rw} height={hz + 200} fill={`url(#${id}r)`} />
                  {[0.22, 0.4, 0.6, 0.78].map((u) => (
                    <line key={u} x1={x + rw * u} y1={-40} x2={x + rw * u} y2={hz + 160} stroke="rgba(40,26,10,0.45)" strokeWidth={1} />
                  ))}
                  <line x1={sd < 0 ? x + rw : x} y1={-40} x2={sd < 0 ? x + rw : x} y2={hz + 160} stroke="#FFE6A8" strokeWidth={2.4} />
                  <line x1={sd < 0 ? x : x + rw} y1={-40} x2={sd < 0 ? x : x + rw} y2={hz + 160} stroke="rgba(232,192,96,0.6)" strokeWidth={1.4} />
                </g>
              );
            })
          : null}
      </Svg>
      {land ? (
        <div style={{ position: "absolute", inset: 0, transform: `translate(${f1(sh.x)}px, ${f1(sh.y)}px)` }}>
          <Band depth={0.15} ridge={geo.far} peaks fill="#1E1A28" haze={0.2} edge={0.4} k={K.far} />
          <Band depth={0.5} ridge={geo.mid} fill="#16141C" haze={0.1} edge={0.45} k={K.mid} />
          <Band depth={0.85} ridge={geo.near} fill="#100E14" fill2="#06050A" haze={0} edge={0.5} k={K.near}>
            {near}
          </Band>
        </div>
      ) : null}
      {roll > 0 ? (
        <>
          <Glow x={cxs} y={p(380, 780)} size={Math.max(gap * 2.2, p(600, 500))} squash={1.4} color="255,226,170" opacity={0.55 * Math.min(1, roll * 2)} />
          <Glow x={cxs} y={p(380, 780)} size={Math.max(gap * 0.9, 200)} squash={1.6} color="255,250,236" opacity={0.6 * Math.min(1, roll * 2)} />
        </>
      ) : null}
      {moon > 0 ? <Tint color="#5A0E0A" opacity={0.1 * moon} blend="soft-light" /> : null}
      {fx}
    </Stage>
  );
};

// ── Babylon burning, seen from the sea ───────────────────────────────────────────────────

/** A merchant ship on the water (band coordinates, waterline at y = 0): round hull, swan-neck stern, one square sail; about
 *  300 long, masthead -250 at s = 1. `lit` warms the sail from the burning city on its right (or left with flip). */
const MerchantShip: React.FC<{ x: number; y?: number; s?: number; flip?: boolean; lit?: number; sail?: string }> = ({ x, y, s = 1, flip = false, lit = 0.6, sail = "#D8C8A8" }) => {
  const band = useBand();
  const f = useCurrentFrame();
  const gy = (y ?? band.gy(x)) + 12 * s * band.k;
  const k = s * band.k;
  const rk = Math.sin(f * 0.04 + x * 0.01) * 1.5;
  return (
    <g transform={`translate(${f1(x)} ${f1(gy)}) scale(${flip ? -k : k} ${k}) rotate(${f1(rk)})`}>
      <path d="M -150 -30 Q -120 20 0 22 Q 120 20 140 -36 L 120 -34 Q 0 -24 -130 -32 Z" fill="#3A2A1E" stroke="rgba(255,190,120,0.5)" strokeWidth={1.4} />
      <path d="M -130 -32 Q 0 -24 120 -34" stroke="#6A4A30" strokeWidth={4} fill="none" />
      <path d="M -150 -30 Q -176 -60 -160 -92 Q -150 -102 -142 -94 Q -156 -70 -136 -36 Z" fill="#3A2A1E" stroke="rgba(255,190,120,0.5)" strokeWidth={1.2} />
      <line x1={4} y1={-30} x2={0} y2={-250} stroke="#4A3626" strokeWidth={5} />
      <line x1={-90} y1={-232} x2={92} y2={-236} stroke="#4A3626" strokeWidth={4} />
      <path d="M -86 -230 Q -90 -150 -80 -70 L 86 -72 Q 92 -150 88 -234 Z" fill={mixHex(sail, "#FFB060", lit * 0.35)} stroke="rgba(255,200,140,0.6)" strokeWidth={1.2} />
      <path d="M 40 -230 Q 46 -150 40 -72 L 86 -72 Q 92 -150 88 -234 Z" fill={`rgba(255,150,70,${(0.35 * lit).toFixed(3)})`} />
      {[-40, 0, 40].map((sx) => (
        <line key={sx} x1={sx} y1={-232} x2={sx * 1.05} y2={-72} stroke="rgba(120,90,60,0.35)" strokeWidth={1} />
      ))}
      <path d="M 0 -250 L -150 -36 M 0 -250 L 136 -38" stroke="rgba(60,44,30,0.6)" strokeWidth={1} />
    </g>
  );
};

/**
 * Babylon the great, burning, seen from far off across the sea (18:9–19): the city's skyline on the far shore with fire along
 * its roofs and a great column of smoke, a red glow on the sky and the water, merchant ships standing off with sails lit by
 * the fire, and a stone quay in the near band where kings, merchants and sailors stand watching (Person s ≈ 1 on
 * ridgeY(useLandGeo("plain", seed).near, x)). `burn` 0..1, `smoke` 0..1, `ships` 0–4, `cargo` bales and jars on the quay.
 */
export const CitySeaSet: React.FC<SetP & { burn?: number; smoke?: number; ships?: number; cargo?: boolean; cityX?: number }> = ({ cam, seed, tod = 0.8, near, mid, far, front, fx, sky, storm = 0, burn = 1, smoke = 1, ships = 3, cargo = true, cityX }) => {
  const { p, W, hz } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const geo = useLandGeo("plain", seed);
  const cx = cityX ?? p(1180, 600);
  const cityBase = hz + p(6, 8);
  const cs = p(0.85, 0.72);
  const shipList = [
    { x: p(420, 160), s: p(0.55, 0.5), flip: false },
    { x: p(1600, 900), s: p(0.42, 0.38), flip: true },
    { x: p(860, 420), s: p(0.32, 0.3), flip: false },
    { x: p(1880, 1040), s: p(0.6, 0.5), flip: true },
  ].slice(0, ships);
  const halfW = 600 * cs * K.far;
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} storm={storm} clouds={0.25} stars={0.6} seed={`${seed}s`} {...sky} />
      <Glow x={cx} y={cityBase - p(80, 100)} size={p(2000, 1500)} color="255,100,40" opacity={0.55 * burn} squash={0.55} />
      <Glow x={cx} y={cityBase - p(40, 50)} size={p(900, 700)} color="255,170,80" opacity={0.45 * burn} squash={0.45} />
      <Band depth={0.1} ridge={{ base: hz - 6, amp: 14, seed: `${seed}f` }} fill="#3A3440" haze={0.5} edge={0.25} k={K.far}>
        {far}
      </Band>
      <Band depth={0.16} ridge={{ base: cityBase, amp: 3, seed: `${seed}c` }} fill="#2A2228" haze={0.3} edge={0.3} k={K.far}>
        <Skyline x={cx} s={cs} kind="babylon" lit={0.3 + 0.5 * burn} seed={`${seed}sk`} palms={false} />
        {burn > 0
          ? Array.from({ length: 11 }, (_, i) => {
              const u = i / 10 - 0.5;
              const fx0 = cx + u * halfW * 1.6;
              return <Fire key={i} x={fx0} y={cityBase - range(`${seed}fy${i}`, 40, 150) * cs * K.far} s={cs * K.far * (1.3 + random(`${seed}fs${i}`)) * burn} n={3} seed={`${seed}fi${i}`} w={26} />;
            })
          : null}
        {smoke > 0 ? (
          <g>
            <Smoke x={cx - halfW * 0.3} y={cityBase - 140 * cs * K.far} s={2.8 * cs * K.far * 1.6} n={18} rise={1.4} drift={0.5} color="70,60,62" opacity={0.75 * smoke} seed={`${seed}sm1`} />
            <Smoke x={cx + halfW * 0.25} y={cityBase - 120 * cs * K.far} s={2.4 * cs * K.far * 1.6} n={16} rise={1.2} drift={0.6} color="80,66,64" opacity={0.6 * smoke} seed={`${seed}sm2`} />
          </g>
        ) : null}
        {mid}
      </Band>
      <Water depth={0.3} y={cityBase + 2} haze={0.15} k={K.mid} color="#1E2A3A" deep="#05080E" rough={0.08} shine={{ x: cx, a: 0.9 * burn }}>
        {shipList.map((sh, i) => (
          <MerchantShip key={i} x={sh.x} s={sh.s} flip={sh.flip} lit={burn} />
        ))}
      </Water>
      <Svg style={{ mixBlendMode: "screen" }}>
        {Array.from({ length: 30 }, (_, i) => {
          const yy = cityBase + 8 + Math.pow(i / 30, 1.4) * p(260, 300);
          const ww = (40 + i * 10) * (0.7 + 0.3 * Math.sin(f * 0.1 + i));
          const xx = cx + Math.sin(f * 0.05 + i * 1.7) * 20;
          return <line key={i} x1={xx - ww} y1={yy} x2={xx + ww} y2={yy} stroke={`rgba(255,140,60,${(0.4 * burn * (1 - i / 30)).toFixed(3)})`} strokeWidth={2} />;
        })}
      </Svg>
      <Band depth={0.8} ridge={{ ...geo.near, amp: 4 }} fill="#4A4038" fill2="#1A1612" haze={0.04} edge={0.5} k={K.near}>
        {(() => {
          const pts: string[] = [];
          for (let xx = -300; xx <= W + 300; xx += 40) pts.push(`${xx === -300 ? "M" : "L"} ${xx} ${f1(ridgeY({ ...geo.near, amp: 4 }, xx) + 14)}`);
          return <path d={pts.join(" ")} stroke="rgba(255,170,100,0.25)" strokeWidth={2} fill="none" />;
        })()}
        {Array.from({ length: Math.ceil((W + 400) / 90) }, (_, i) => {
          const xx = -200 + i * 90;
          const yy = ridgeY({ ...geo.near, amp: 4 }, xx);
          return <line key={i} x1={xx} y1={yy + 2} x2={xx - 6} y2={yy + 40} stroke="rgba(20,14,10,0.35)" strokeWidth={1.4} />;
        })}
        {cargo ? (
          <g>
            {[p(160, 80), p(230, 150), p(1760, 960)].map((xx, i) => {
              const yy = ridgeY({ ...geo.near, amp: 4 }, xx);
              const k = K.near;
              return i < 2 ? (
                <g key={i}>
                  <path d={`M ${xx - 22 * k} ${yy} Q ${xx - 28 * k} ${yy - 30 * k} ${xx - 14 * k} ${yy - 46 * k} L ${xx + 14 * k} ${yy - 46 * k} Q ${xx + 28 * k} ${yy - 30 * k} ${xx + 22 * k} ${yy} Z`} fill="#8A5A36" stroke="rgba(255,190,120,0.5)" strokeWidth={1.2} />
                  <path d={`M ${xx - 8 * k} ${yy - 46 * k} L ${xx - 8 * k} ${yy - 54 * k} L ${xx + 8 * k} ${yy - 54 * k} L ${xx + 8 * k} ${yy - 46 * k}`} fill="#7A4A2A" />
                </g>
              ) : (
                <g key={i}>
                  <rect x={xx - 40 * k} y={yy - 40 * k} width={80 * k} height={40 * k} rx={6 * k} fill="#6A5A44" stroke="rgba(255,190,120,0.45)" strokeWidth={1.2} />
                  <rect x={xx - 30 * k} y={yy - 72 * k} width={60 * k} height={32 * k} rx={5 * k} fill="#5A2A4A" stroke="rgba(255,190,120,0.45)" strokeWidth={1.2} />
                  <path d={`M ${xx - 40 * k} ${yy - 20 * k} L ${xx + 40 * k} ${yy - 20 * k} M ${xx - 30 * k} ${yy - 56 * k} L ${xx + 30 * k} ${yy - 56 * k}`} stroke="rgba(30,20,14,0.5)" strokeWidth={2} />
                </g>
              );
            })}
          </g>
        ) : null}
        {near}
      </Band>
      <Band depth={1} ridge={geo.front} fill="#1A1410" haze={0} edge={0.3} k={K.front}>
        {front}
      </Band>
      <Dust count={40} seed={`${seed}em`} color="255,160,80" opacity={0.5 * burn} vy={-0.6} size={[0.8, 2.2]} />
      {fx}
    </Stage>
  );
};

// ── The new Jerusalem ────────────────────────────────────────────────────────────────────

type V3 = [number, number, number];
const proj3 = (q: V3, yaw: number, pitch: number, R: number, cx: number, cy: number, persp = 6) => {
  const x1 = q[0] * Math.cos(yaw) + q[2] * Math.sin(yaw);
  const z1 = -q[0] * Math.sin(yaw) + q[2] * Math.cos(yaw);
  const y2 = q[1] * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = q[1] * Math.sin(pitch) + z1 * Math.cos(pitch);
  const k = persp / (persp - z2);
  return { x: cx + x1 * R * k, y: cy + y2 * R * k, z: z2 };
};
const SIDES3: { a: V3; b: V3 }[] = [
  { a: [-1, 0, 1], b: [1, 0, 1] },
  { a: [1, 0, 1], b: [1, 0, -1] },
  { a: [1, 0, -1], b: [-1, 0, -1] },
  { a: [-1, 0, -1], b: [-1, 0, 1] },
];
const GATE3: [number, number][] = [[-0.06, 0], [-0.06, 0.52], [-0.046, 0.68], [0, 0.8], [0.046, 0.68], [0.06, 0.52], [0.06, 0]];

/**
 * The holy city, the new Jerusalem (Revelation 21–22), for film 100. view "city": the square city coming down out of heaven
 * onto a great high mountain of the new earth (no sea anywhere), its wall of jasper with twelve gates — THREE PEARL GATES ON
 * EACH SIDE, an angel above each — the twelve foundations of precious stones in bands under the wall, streets of gold clear
 * as glass, the river of the water of life flowing from the throne at the centre out through the near gate, the tree of life
 * on both banks with twelve kinds of fruit, and no sun: the city is lit by the glory of God, a pillar of light at the throne.
 * view "street": down the main street of gold toward the throne of God and of the Lamb, the river down its middle, trees of
 * life on both banks, walls of translucent gold; people (the nations) walk in its light in the near band (`children`, Person
 * s ≈ 1 at y = useLayout().H * p(0.86, 0.8)). Controls 0..1: `descend` (city view), `glory`, `gates`, `angels`, `foundations`,
 * `river`, `trees`, `cube` (a faint glass cube for "its length and width and height are equal").
 */
export const NewJerusalemSet: React.FC<{
  cam?: CamT; seed?: string; view?: "city" | "street"; descend?: number; glory?: number; gates?: number; angels?: number; foundations?: number; river?: number; trees?: number; cube?: number; lamb?: boolean; children?: React.ReactNode; fx?: React.ReactNode;
}> = ({ cam, seed = "nj", view = "city", descend = 1, glory = 1, gates = 1, angels = 1, foundations = 1, river = 1, trees = 1, cube = 0, lamb = true, children, fx }) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const zoom = cam?.zoom ?? 1;
  const T = `translate(${f1(W / 2 - (cam?.x ?? 0))} ${f1(H * 0.62 - (cam?.y ?? 0))}) scale(${zoom.toFixed(4)}) translate(${f1(-W / 2)} ${f1(-H * 0.62)})`;
  if (view === "street") {
    const vp = { x: W / 2, y: p(560, 1000) };
    const g0 = H + 40;
    const depthY = (z: number) => vp.y + (g0 - vp.y) / z;
    const halfRiver = (z: number) => p(200, 150) / z;
    const halfStreet = (z: number) => p(1100, 700) / z;
    const treeZ = [1.25, 1.65, 2.2, 3, 4.2, 6, 9];
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ background: `linear-gradient(180deg, #FFF0C8 0%, #F6D48A ${p(30, 32)}%, #E8B860 ${p(52, 52)}%, #B8862F 100%)` }} />
        <Glow x={vp.x} y={vp.y - p(60, 80)} size={p(1600, 1400)} color="255,252,240" opacity={0.95 * glory} />
        <Svg>
          <g transform={T}>
            {[-1, 1].map((d) => {
              const zs = [1, 1.4, 2, 3, 5, 9, 18];
              return (
                <g key={d}>
                  {zs.slice(0, -1).map((z, i) => {
                    const z2 = zs[i + 1];
                    const x1 = vp.x + d * halfStreet(z);
                    const x2 = vp.x + d * halfStreet(z2);
                    const top1 = depthY(z) - p(900, 1100) / z;
                    const top2 = depthY(z2) - p(900, 1100) / z2;
                    return (
                      <g key={i}>
                        <path d={`M ${f1(x1)} ${f1(depthY(z))} L ${f1(x2)} ${f1(depthY(z2))} L ${f1(x2)} ${f1(top2)} L ${f1(x1)} ${f1(top1)} Z`} fill={`rgba(255,226,150,${(0.18 + i * 0.05).toFixed(3)})`} stroke="rgba(255,240,200,0.7)" strokeWidth={1.4} />
                        <path d={`M ${f1(lerp(x1, x2, 0.25))} ${f1(lerp(depthY(z), depthY(z2), 0.25))} L ${f1(lerp(x1, x2, 0.25))} ${f1(lerp(top1, top2, 0.25) + (depthY(z) - top1) * 0.3)} Q ${f1(lerp(x1, x2, 0.5))} ${f1(lerp(top1, top2, 0.5) + (depthY(z) - top1) * 0.12)} ${f1(lerp(x1, x2, 0.75))} ${f1(lerp(top1, top2, 0.75) + (depthY(z2) - top2) * 0.3)} L ${f1(lerp(x1, x2, 0.75))} ${f1(lerp(depthY(z), depthY(z2), 0.75))}`} fill="rgba(255,250,236,0.35)" stroke="rgba(232,192,96,0.8)" strokeWidth={1.2} />
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <path d={`M ${f1(vp.x - halfStreet(1) * 1.5)} ${g0} L ${f1(vp.x)} ${f1(vp.y)} L ${f1(vp.x + halfStreet(1) * 1.5)} ${g0} Z`} fill="rgba(240,190,90,0.55)" />
            {Array.from({ length: 16 }, (_, i) => {
              const z = 1 + i * 0.7 + i * i * 0.08;
              const yy = depthY(z);
              return <line key={i} x1={vp.x - halfStreet(z) * 1.5} y1={yy} x2={vp.x + halfStreet(z) * 1.5} y2={yy} stroke="rgba(255,240,200,0.35)" strokeWidth={Math.max(0.6, 2 / z)} />;
            })}
            {Array.from({ length: 11 }, (_, i) => {
              const u = (i / 10 - 0.5) * 3;
              return <line key={i} x1={vp.x + u * halfStreet(1)} y1={g0} x2={vp.x} y2={vp.y} stroke="rgba(255,240,200,0.22)" strokeWidth={1} />;
            })}
            {Array.from({ length: 18 }, (_, i) => {
              const z = range(`${seed}gz${i}`, 1.1, 6);
              const xx = vp.x + range(`${seed}gx${i}`, -1.4, 1.4) * halfStreet(z);
              return <ellipse key={`g${i}`} cx={xx} cy={depthY(z)} rx={30 / z} ry={70 / z} fill="rgba(255,255,240,0.18)" />;
            })}
            <g transform={`translate(${vp.x} ${vp.y + p(14, 16)})`}>
              <NoScale>
                <HeavenThrone x={0} y={0} s={p(0.36, 0.4)} presence={glory} glow={glory} seat={lamb ? <LambStanding x={0} y={0} s={0.9} /> : null} />
              </NoScale>
            </g>
            <RiverOfLife pts={[[vp.x, vp.y + p(4, 6)], [vp.x, depthY(4)], [vp.x, depthY(1.8)], [vp.x, g0]]} w0={4} w1={halfRiver(1) * 2} p={river} banks={river} seed={`${seed}rv`} />
            {treeZ.slice().reverse().map((z, i) =>
              [-1, 1].map((d) => (
                <g key={`${i}${d}`}>
                  <NoScale>
                    <TreeOfLife x={vp.x + d * (halfRiver(z) + p(150, 110) / z)} y={depthY(z)} s={p(1.6, 1.4) / z} grow={trees} fruit={trees} leaves={z < 2 ? 0.6 : 0} seed={`${seed}t${i}${d}`} flip={d > 0} />
                  </NoScale>
                </g>
              )),
            )}
            {children}
          </g>
        </Svg>
        <Dust count={80} seed={`${seed}sd`} color="255,252,236" opacity={0.6} vy={-0.2} />
        {fx}
      </AbsoluteFill>
    );
  }
  // City view.
  const L = { cy: p(600, 1140), R: p(330, 300), hz: p(660, 1220), mountY: p(700, 1290) };
  const land = ease.inOut(clamp1(descend));
  const cy = lerp(L.cy - p(820, 1100), L.cy, land);
  const yaw = Math.PI / 4 + Math.sin(f * 0.006) * 0.025;
  const pitch = -0.56;
  const hW = 0.4;
  const P3 = (q: V3) => proj3(q, yaw, pitch, L.R, W / 2, cy, 7);
  const at = (si: number, u: number, v: number): V3 => {
    const sd = SIDES3[si];
    return [lerp(sd.a[0], sd.b[0], u), -hW * v, lerp(sd.a[2], sd.b[2], u)];
  };
  const centre = P3([0, 0, 0]);
  const nearSide = SIDES3.map((_, si) => P3(at(si, 0.5, 0)).z > centre.z);
  const poly = (pts: { x: number; y: number }[]) => pts.map((q, i) => `${i ? "L" : "M"} ${f1(q.x)} ${f1(q.y)}`).join(" ") + " Z";
  const frontGate = P3(at(0, 0.5, 0));
  const riverPts: Pt[] = [[centre.x, centre.y], [lerp(centre.x, frontGate.x, 0.5) + 6, lerp(centre.y, frontGate.y, 0.5)], [frontGate.x, frontGate.y]];
  const riverOut: Pt[] = [[frontGate.x, frontGate.y], [frontGate.x - p(40, 30), frontGate.y + p(120, 140)], [W / 2 - p(60, 40), H + 40]];
  const wall = (si: number, outer: boolean) => {
    const quad = [at(si, 0, 0), at(si, 1, 0), at(si, 1, 1), at(si, 0, 1)].map(P3);
    const strata = outer ? 12 : 0;
    const fH = 0.42;
    return (
      <g key={`w${si}`}>
        <path d={poly(quad)} fill={outer ? "rgba(180,236,206,0.55)" : "rgba(200,240,220,0.22)"} stroke="rgba(246,212,136,0.85)" strokeWidth={1.4} />
        {Array.from({ length: strata }, (_, j) => {
          const a = clamp1(foundations * 12 - j);
          if (a <= 0) return null;
          const v0 = (j / 12) * fH;
          const v1 = ((j + 1) / 12) * fH;
          const qd = [at(si, 0, v0), at(si, 1, v0), at(si, 1, v1), at(si, 0, v1)].map(P3);
          return <path key={j} d={poly(qd)} fill={FOUNDATION_STONES[j]} opacity={0.9 * a} />;
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((u) => {
          const a = P3(at(si, u, 0));
          const b = P3(at(si, u, 1));
          return <line key={u} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />;
        })}
        {(() => {
          const a = P3(at(si, 0, 1));
          const b = P3(at(si, 1, 1));
          return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#F8D488" strokeWidth={2.4} />;
        })()}
        {[0.25, 0.5, 0.75].map((c, g) => {
          const lit = clamp1(gates * 12 - (si * 3 + g));
          const pts = GATE3.map(([du, v]) => P3(at(si, c + du, v)));
          const ang = P3(at(si, c, 1.22));
          const al = clamp1(angels * 12 - (si * 3 + g));
          return (
            <g key={g}>
              <path d={poly(pts)} fill={`rgba(255,252,246,${(0.25 + 0.7 * lit).toFixed(3)})`} stroke="#FFF6E4" strokeWidth={1.3} style={{ filter: lit > 0 ? `drop-shadow(0 0 ${f1(6 * lit)}px rgba(255,248,236,0.95))` : undefined }} />
              {al > 0 ? (
                <g opacity={al}>
                  <GlowS x={ang.x} y={ang.y} r={16} color="255,248,230" opacity={0.9} />
                  <path d={`M ${f1(ang.x - 9)} ${f1(ang.y - 5)} Q ${f1(ang.x - 3)} ${f1(ang.y - 1)} ${f1(ang.x)} ${f1(ang.y + 1)} Q ${f1(ang.x + 3)} ${f1(ang.y - 1)} ${f1(ang.x + 9)} ${f1(ang.y - 5)}`} stroke="rgba(255,226,160,0.95)" strokeWidth={1.4} fill="none" />
                  <circle cx={ang.x} cy={ang.y} r={2.6} fill="#FFFDF6" />
                </g>
              ) : null}
            </g>
          );
        })}
      </g>
    );
  };
  const sq = (yy: number) => ([[-1, yy, -1], [1, yy, -1], [1, yy, 1], [-1, yy, 1]] as V3[]).map(P3);
  const trees3 = Array.from({ length: 14 }, (_, i) => {
    const t = 0.16 + Math.floor(i / 2) * 0.118;
    const side = i % 2 ? 1 : -1;
    return { q: [side * 0.085, 0, t] as V3, i };
  }).sort((a, b) => P3(a.q).z - P3(b.q).z);
  const mountain = (() => {
    const l = P3([-1.25, 0.28, -1.25]);
    const r = P3([1.25, 0.28, 1.25]);
    const fr = P3([-1.25, 0.28, 1.25]);
    const bk = P3([1.25, 0.28, -1.25]);
    const lo = Math.min(l.x, fr.x) - p(80, 60);
    const ro = Math.max(r.x, bk.x) + p(80, 60);
    return `M -60 ${L.hz + 30} C ${f1(W * 0.2)} ${L.hz} ${f1(lo - p(60, 40))} ${f1(l.y + 40)} ${f1(l.x)} ${f1(l.y + 20)} L ${f1(fr.x)} ${f1(fr.y + 14)} L ${f1(r.x)} ${f1(r.y + 20)} C ${f1(ro + p(60, 40))} ${f1(r.y + 40)} ${f1(W * 0.8)} ${L.hz} ${W + 60} ${L.hz + 30} L ${W + 60} ${H + 60} L -60 ${H + 60} Z`;
  })();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, #0A1030 0%, #22305E ${(L.hz / H) * 45}%, #7A6A88 ${(L.hz / H) * 80}%, #F2DCA8 ${(L.hz / H) * 100}%, #F2DCA8 100%)` }} />
      <StarField n={180} p={1 - 0.5 * glory} seed={`${seed}st`} area={{ x: 0, y: 0, w: W, h: L.hz * 0.7 }} big={12} />
      <Glow x={centre.x} y={centre.y - p(80, 100)} size={p(1700, 1500)} color="255,220,160" opacity={0.25 + 0.4 * glory} />
      <Svg>
        <g transform={T}>
          <defs>
            <linearGradient id={`${seed}ne`} gradientUnits="userSpaceOnUse" x1={0} y1={L.hz} x2={0} y2={H}>
              <stop offset="0" stopColor="#5A7A4A" />
              <stop offset="0.45" stopColor="#2E4A2A" />
              <stop offset="1" stopColor="#0E1A0E" />
            </linearGradient>
            <radialGradient id={`${seed}gs`} cx="50%" cy="50%" r="60%">
              <stop offset="0" stopColor="rgba(255,244,210,0.9)" />
              <stop offset="1" stopColor="rgba(232,184,90,0.55)" />
            </radialGradient>
          </defs>
          <path d={`M -60 ${L.hz} Q ${W * 0.25} ${L.hz - p(26, 30)} ${W * 0.5} ${L.hz - 8} T ${W + 60} ${L.hz} L ${W + 60} ${H + 60} L -60 ${H + 60} Z`} fill="#6A8A5A" opacity={0.9} />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M ${-60 + i * W * 0.22} ${L.hz + 20 + i * 6} q ${W * 0.12} ${-p(30, 36)} ${W * 0.24} 0`} fill="#56784A" opacity={0.7} />
          ))}
          <path d={mountain} fill={`url(#${seed}ne)`} stroke="rgba(255,226,170,0.5)" strokeWidth={1.6} opacity={land} />
          {river > 0 && land > 0.98 ? <RiverOfLife pts={riverOut} w0={6} w1={p(90, 80)} p={river} glow={1} seed={`${seed}ro`} /> : null}
          {SIDES3.map((_, si) => (!nearSide[si] ? wall(si, false) : null))}
          <path d={poly(sq(0))} fill={`url(#${seed}gs)`} stroke="rgba(255,236,190,0.85)" strokeWidth={1.4} />
          {[-0.5, 0, 0.5].map((t) => {
            const a = P3([t, 0, -1]);
            const b = P3([t, 0, 1]);
            const c = P3([-1, 0, t]);
            const d = P3([1, 0, t]);
            return (
              <g key={t} stroke="rgba(255,244,210,0.4)" strokeWidth={1}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
              </g>
            );
          })}
          {river > 0 ? <RiverOfLife pts={riverPts} w0={5} w1={p(26, 26)} p={river} glow={1} seed={`${seed}ri`} /> : null}
          {trees3.map((t) => {
            const q = P3(t.q);
            const a = clamp1(trees * 14 - t.i);
            return a > 0 ? (
              <g key={t.i} transform={`translate(${f1(q.x)} ${f1(q.y)}) scale(${(p(0.075, 0.078) * a * (1 + q.z * 0.15)).toFixed(3)})`}>
                <NoScale>
                  <TreeOfLife x={0} y={0} s={1} glow={0} leaves={0} seed={`${seed}tr${t.i}`} />
                </NoScale>
              </g>
            ) : null;
          })}
          {cube > 0
            ? (() => {
                const top = sq(-2);
                const bot = sq(0);
                return (
                  <g opacity={cube}>
                    <path d={poly(top)} fill="rgba(255,236,190,0.06)" stroke="rgba(255,236,190,0.5)" strokeWidth={1.2} />
                    {bot.map((b, i) => (
                      <line key={i} x1={b.x} y1={b.y} x2={top[i].x} y2={top[i].y} stroke="rgba(255,236,190,0.4)" strokeWidth={1.2} />
                    ))}
                  </g>
                );
              })()
            : null}
          {SIDES3.map((_, si) => (nearSide[si] ? wall(si, true) : null))}
        </g>
      </Svg>
      <div style={{ position: "absolute", left: centre.x - 80, width: 160, top: -40, height: Math.max(0, centre.y + 40), background: "linear-gradient(90deg, rgba(255,240,215,0), rgba(255,244,225,0.55), rgba(255,240,215,0))", filter: "blur(12px)", opacity: glory }} />
      <div style={{ position: "absolute", left: centre.x - 3, width: 6, top: -40, height: Math.max(0, centre.y + 40), background: "rgba(255,252,240,0.95)", opacity: glory }} />
      <Glow x={centre.x} y={centre.y} size={300} color="255,244,220" opacity={0.6 + 0.4 * glory} />
      <Glow x={centre.x} y={centre.y} size={70} color="255,255,252" opacity={glory} />
      {land < 1 ? (
        <Svg>
          {Array.from({ length: 10 }, (_, i) => {
            const side = i % 2 ? 1 : -1;
            const xx = W / 2 + side * (p(380, 300) + land * p(600, 400) + i * 30);
            return <ellipse key={i} cx={xx} cy={cy + p(120, 140) + (i % 3) * 30} rx={p(320, 260)} ry={p(60, 60)} fill="rgba(240,242,250,0.35)" opacity={1 - land} />;
          })}
        </Svg>
      ) : null}
      <Dust count={90} seed={`${seed}d`} color="255,248,230" opacity={0.6} vy={-0.25} />
      {fx}
    </AbsoluteFill>
  );
};
