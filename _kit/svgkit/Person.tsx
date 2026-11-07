import React from "react";
import { useCurrentFrame } from "remotion";
import { Pt, add, lerp, mixPt, rot, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { GlowS, useUid } from "./Atmos";
import { useBand, useInk, useRim, useStage } from "./Stage";

/**
 * A robed figure in profile, facing right (flip to face left). Feet at y = 0, crown near y = -174 at s = 1.
 * Pose angles are degrees measured from hanging straight down, positive toward the facing direction.
 */
export type Pose = {
  lean?: number;
  head?: number;
  arm?: [number, number];
  arm2?: [number, number];
  kneel?: number;
  sit?: number;
  walk?: number;
  stride?: number;
  /** 0..1 reclining at a low table (the Last Supper): hips on the floor, legs stretched out behind, the torso propped
   *  up on the back elbow and leaning toward the facing direction (adds lean 50; the head is kept upright). The
   *  figure is about 80 units tall and reaches 110 units behind x. `lean`, `head`, `arm`, `arm2` still apply. */
  recline?: number;
};

export type Hold =
  | "jar" | "bundle" | "wood" | "knife" | "lamb" | "torch" | "cup" | "basket" | "bowl" | "scroll" | "baby" | "hoe" | "stone" | "coat"
  | "sword" | "spear" | "shofar" | "timbrel" | "censer" | "tablets" | "sickle" | "jartorch" | "sandal" | "mallet" | "jawbone"
  | "harp" | "sling" | "bow" | "bowdraw" | "oilhorn" | "shield" | "cloth"
  /** A long gold scepter: upright when the forearm hangs, held out along the arm when it is raised forward (arm ≈ [90, 0]). */
  | "scepter"
  | "axe"
  /** A rolled dark cloak held in the front hand (Elijah strikes the Jordan with it). */
  | "mantle"
  /** Gospels and Acts (Oct 9): a palm branch held upright; a fishing net bundle; a basket of round loaves; one round loaf
   *  (breaking bread); two fish on a cord; a clay oil lamp with a flame; a folded linen towel; a long straight trumpet
   *  (raised to the mouth when the hand is near the face, e.g. arm [150, -40]; otherwise carried); a Roman scutum; a
   *  pilum; a wax writing tablet; an alabaster flask; a gold casket and a lidded gold urn (the Magi's gifts); a money
   *  bag; a basin of water; a short iron chain hanging from the wrist. */
  | "palm" | "net" | "loaves" | "loaf" | "fish" | "lamp" | "towel" | "trumpet" | "scutum" | "pilum" | "tablet" | "alabaster" | "gift" | "urn" | "purse"
  | "basin" | "chain";

export type Look = {
  robe?: string;
  sash?: string;
  mantle?: string;
  skin?: string;
  /** "tiara": tall flared royal cap with a gold band (Assyrian and Persian kings); "cone": Assyrian pointed iron helmet
   *  with cheek guard; "turban": wrapped head cloth (Persians, Medes, Babylonian officials). Colour them with `cap`.
   *  Oct 9: "galea": Roman legionary iron helmet with brow guard, cheek guard, neck guard and a fore-and-aft horsehair
   *  crest; "crest": Hellenistic/Seleucid bronze helmet with a peak, cheek piece and a tall plume on a stilt; "laurel":
   *  a leaf wreath over dark hair (Roman officials, Greeks); "thorns": a dark woven ring of thorns over hair (no blood). */
  head?: "cloth" | "veil" | "hair" | "bare" | "nemes" | "wig" | "hood" | "crown" | "long" | "helmet" | "plume" | "tiara" | "cone" | "turban" | "galea" | "crest" | "laurel" | "thorns";
  /** "wild": a big shaggy dark beard (Elijah). */
  beard?: boolean | "white" | "wild";
  /** Colour of a tiara, cone helmet or turban (defaults: cream felt, iron grey, linen); of the galea's crest (deep red),
   *  the Hellenistic helmet's plume (pale horsehair) or the laurel wreath (green; use gold for an emperor). */
  cap?: string;
  /** A soft gold disc behind the head (0..1 or true). Optional and subtle; the series mostly uses `glow` instead. */
  halo?: boolean | number;
  /** A second item in the back hand (any Hold), drawn behind the body: a scutum, a palm branch, a scroll. */
  hold2?: Hold | null;
  /** Bound in strips of linen, hands and face wrapped in cloth (Lazarus coming out of the tomb). Use with a pale robe. */
  wrapped?: boolean;
  /** A mantle (himation, toga) in this colour over the shoulders and wrapped round the hips to below the knee, the robe
   *  showing at the chest and hem (Jesus's red mantle over a cream robe, a Roman toga). `drapeEdge` adds a border stripe
   *  (a magistrate's purple). Not the same as `mantle`, which colours a head cloth or veil. */
  drape?: string;
  drapeEdge?: string;
  /** A thin gold circlet over a veil or hair (queens, a bride); a string sets the metal colour. */
  diadem?: boolean | string;
  /** A pale film over the eye (Tobit). */
  blind?: boolean;
  /** Rough hair-cloth texture on the robe (Elijah's garment of hair). */
  hairy?: boolean;
  child?: number;
  /** "raised" holds the staff aloft along the forearm instead of planting it on the ground. */
  staff?: "staff" | "crook" | "raised" | null;
  hold?: Hold | null;
  glow?: number;
  short?: boolean;
  /** Colour of the front hand (e.g. a leprous hand, white as snow). */
  hand?: string;
  /** Bronze scale armour over the torso (Goliath, Saul's armour); a string sets the metal colour. */
  armor?: boolean | string;
};

type Props = { x: number; y?: number; s?: number; flip?: boolean; pose?: Pose; look?: Look; opacity?: number; shadow?: boolean; id?: string };

const dir = (deg: number): Pt => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];

const HIP_STAND: Pt = [0, -84];
const HIP_KNEEL: Pt = [-6, -46];
const HIP_SIT: Pt = [-6, -42];
const HIP_RECLINE: Pt = [-4, -20];
const mixA = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
type Limb = { sh: Pt; el: Pt; hd: Pt };

/** The skeleton Person draws, in its own units (s = 1, facing right, feet at y = 0). Shared by Person and rig(). */
const rigLocal = (pose: Pose, look: Look) => {
  const child = look.child ?? 0;
  const k = pose.kneel ?? 0;
  const st = pose.sit ?? 0;
  const rc = pose.recline ?? 0;
  const lean = (pose.lean ?? 0) + 50 * rc;
  const tilt = (pose.head ?? 0) - 38 * rc;
  const walking = pose.walk !== undefined;
  const ph = pose.walk ?? 0;
  const stride = (pose.stride ?? 1) * (1 - k) * (1 - st) * (1 - rc);
  const sw = walking ? Math.sin(ph) : 0;
  const bob = walking ? -Math.abs(Math.sin(ph)) * 1.8 : 0;
  const hip0 = mixPt(mixPt(mixPt(HIP_STAND, HIP_KNEEL, k), HIP_SIT, st), HIP_RECLINE, rc);
  const hip: Pt = [hip0[0], hip0[1] + bob];
  const torso = 58 * (1 - 0.06 * child);
  const S = add(hip, [Math.sin((lean * Math.PI) / 180) * torso, -Math.cos((lean * Math.PI) / 180) * torso]);
  const hr = 12.5 * (1 + 0.32 * child);
  const Hc = add(S, rot([0, -(hr + 6.5)], lean + tilt));
  const swing = walking ? sw * 16 : 0;
  const a1 = pose.arm ?? mixA([8 + swing, 14], [62, 24], rc);
  const a2 = pose.arm2 ?? mixA([-6 - swing, 10], [-50, 92], rc);
  const arm = (a: [number, number], off: Pt): Limb => {
    const sh = add(S, rot(off, lean));
    const el = add(sh, dir(a[0] + lean).map((v) => v * 29) as Pt);
    const hd = add(el, dir(a[0] + a[1] + lean).map((v) => v * 26) as Pt);
    return { sh, el, hd };
  };
  const fF: Pt = [4 + (walking ? 10 * sw * stride : 0), -2.5];
  const fB: Pt = [-4 - (walking ? 10 * sw * stride : 0), -2.5];
  return { child, k, st, rc, lean, tilt, walking, sw, bob, stride, hip0, hip, torso, S, hr, Hc, front: arm(a1, [3, 3]), back: arm(a2, [-3, 3]), fF, fB };
};

/** Joint positions of a Person in its own units (s = 1, facing right, feet at y = 0, before band and child scale). */
export type Joints = {
  head: Pt;
  /** Crown of the head (where a wreath, a tongue of fire or a dove would rest). */
  top: Pt;
  mouth: Pt;
  neck: Pt;
  shoulder: Pt;
  hip: Pt;
  /** Front hand (the near arm, `pose.arm`) and its elbow; hand2/elbow2 belong to the back arm (`pose.arm2`). */
  hand: Pt;
  elbow: Pt;
  hand2: Pt;
  elbow2: Pt;
  foot: Pt;
  foot2: Pt;
  /** Head radius, torso lean and head tilt (degrees, recline included). */
  hr: number;
  lean: number;
  tilt: number;
};

/** Where a Person's head, hands and feet are in its own units, exactly as Person draws them (walk bob and recline included). */
export const personJoints = (pose: Pose = {}, look: Look = {}): Joints => {
  const L = rigLocal(pose, look);
  const at = (q: Pt) => add(L.Hc, rot(q, L.lean + L.tilt));
  return {
    head: L.Hc,
    top: at([0, -L.hr]),
    mouth: at([L.hr * 0.95, L.hr * 0.4]),
    neck: add(L.S, rot([1, -4], L.lean)),
    shoulder: L.S,
    hip: L.hip,
    hand: L.front.hd,
    elbow: L.front.el,
    hand2: L.back.hd,
    elbow2: L.back.el,
    foot: L.fF,
    foot2: L.fB,
    hr: L.hr,
    lean: L.lean,
    tilt: L.tilt,
  };
};

/** Joints in band pixels, plus the effective scale `sc`, facing `dir` (1 right, -1 left) and the head radius `r` in pixels. */
export type Rig = Omit<Joints, "hr" | "lean" | "tilt"> & { sc: number; dir: 1 | -1; r: number };

/**
 * Where a Person drawn at (x, gy) lands, so a scene can attach props to hands and heads without copying the arm maths.
 * `sc` is s × the band's k (e.g. 1 * K.near), the same numbers you give the Person; child looks shrink automatically.
 * Example: const r = rig(x, ridgeY(geo.near, x), 1 * K.near, PETER, pose, true); then draw a net at r.hand.
 * Inside a band (a prop component), useRig() reads the band's ground and k for you.
 */
export const rig = (x: number, gy: number, sc: number, look: Look = {}, pose: Pose = {}, flip = false): Rig => {
  const j = personJoints(pose, look);
  const k = sc * (1 - 0.36 * (look.child ?? 0));
  const d: 1 | -1 = flip ? -1 : 1;
  const T = (q: Pt): Pt => [x + d * k * q[0], gy + k * q[1]];
  return {
    head: T(j.head),
    top: T(j.top),
    mouth: T(j.mouth),
    neck: T(j.neck),
    shoulder: T(j.shoulder),
    hip: T(j.hip),
    hand: T(j.hand),
    elbow: T(j.elbow),
    hand2: T(j.hand2),
    elbow2: T(j.elbow2),
    foot: T(j.foot),
    foot2: T(j.foot2),
    sc: k,
    dir: d,
    r: j.hr * k,
  };
};

/** rig() for components inside a Band: `(x, s, look, pose, flip, y?)` with the band's ground and scale applied. */
export const useRig = () => {
  const band = useBand();
  return (x: number, s: number, look: Look = {}, pose: Pose = {}, flip = false, y?: number) => rig(x, y ?? band.gy(x), s * band.k, look, pose, flip);
};

export const Person: React.FC<Props> = ({ x, y, s = 1, flip = false, pose = {}, look = {}, opacity = 1, shadow = true }) => {
  const band = useBand();
  const stage = useStage();
  const ink = useInk();
  const rimC = useRim();
  const glowId = useUid("pg");
  const gy = y ?? band.gy(x);
  const glow = look.glow ?? 0;
  const L0 = rigLocal(pose, look);
  const { child, k, st, rc, lean, tilt: headTilt, walking, sw } = L0;
  const netClip = useUid("pn");
  const haloId = useUid("ph");
  const wrapId = useUid("pw");
  const frame = useCurrentFrame();
  const flick = 0.86 + 0.14 * Math.sin(frame * 0.41) * Math.sin(frame * 0.17 + 2);

  const robeBase = look.robe ?? "#5A4232";
  const robe = glow > 0 ? mixHex(ink(robeBase), "#F2ECDD", glow) : ink(robeBase);
  const robeDark = tone(robe, -0.28);
  const sash = look.sash ? (glow > 0 ? mixHex(ink(look.sash), "#FFF6DE", glow) : ink(look.sash)) : null;
  const skin = glow > 0 ? mixHex(ink(look.skin ?? "#6A4632"), "#F0E2CC", glow) : ink(look.skin ?? "#6A4632");
  const rim = glow > 0 ? `rgba(255,246,220,${0.9 * glow})` : rimC(1);
  const scale = s * band.k * (1 - 0.36 * child);
  const rimW = 1.5 / Math.max(0.3, scale);

  // Rig.
  const { hip, S, hr, Hc } = L0;
  const R = (p: Pt) => add(S, rot(p, lean));
  const Hp = (p: Pt) => add(hip, rot(p, lean * 0.5));

  const sway = walking ? sw * 3.5 : 0;
  const hemY = look.short ? -32 : -7;
  const standLow: Pt[] = [
    [hip[0] + 12, hip[1] + 40],
    [15 + sway + (look.short ? -2 : 0), hemY],
    [-15 + sway, hemY],
    [hip[0] - 12, hip[1] + 40],
  ];
  const kneelLow: Pt[] = [
    [hip[0] + 15, -18],
    [hip[0] + 16, -2],
    [hip[0] - 38, -2],
    [hip[0] - 24, -14],
  ];
  const sitLow: Pt[] = [
    [hip[0] + 36, hip[1] - 4],
    [hip[0] + 42, -6],
    [hip[0] + 22, -6],
    [hip[0] - 16, hip[1] + 4],
  ];
  const reclineLow: Pt[] = [
    [L0.hip0[0] + 14, -4],
    [L0.hip0[0] - 100, -3],
    [L0.hip0[0] - 106, -17],
    [L0.hip0[0] - 44, L0.hip0[1] - 2],
  ];
  const low = standLow.map((p, i) => {
    const q = mixPt(mixPt(p, kneelLow[i], k), sitLow[i], st);
    return rc > 0 ? mixPt(q, reclineLow[i], rc) : q;
  });
  const robePts: Pt[] = [R([5, 1]), R([10, 16]), Hp([10, -6]), low[0], low[1], low[2], low[3], Hp([-11, -4]), R([-10, 6]), R([-5, -1])];
  const robeD = smooth(robePts, true, 0.42);

  // Arms: shoulder angle + elbow bend, relative to the torso.
  const { front, back } = L0;

  // Feet (visible under a standing robe).
  const feet = k < 0.5 && st < 0.5 && rc < 0.5;
  const { fF, fB } = L0;
  const legsShort = look.short;

  const headwear = () => {
    const c = look.head ?? "cloth";
    const cloth = ink(look.mantle ?? tone(robeBase, 0.18));
    const r = hr;
    const T = (pts: Pt[]) => smooth(pts.map((p) => add(Hc, rot(p, lean + headTilt))), true, 0.45);
    if (c === "cloth" || c === "hood")
      return {
        back: T([[r * 0.85, -r * 0.6], [0, -r * 1.42], [-r * 1.05, -r * 0.45], [-r * 1.3, r * 1.95], [-r * 0.15, r * 1.7], [-r * 0.5, r * 0.25]]),
        color: c === "hood" ? tone(cloth, -0.25) : cloth,
        band: c === "cloth",
      };
    if (c === "veil")
      return {
        back: T([[r * 0.95, -r * 0.15], [r * 0.45, -r * 1.42], [-r * 0.95, -r * 0.85], [-r * 1.55, r * 0.9], [-r * 1.25, r * 3.3], [-r * 0.05, r * 2.7], [r * 0.25, r * 1.2], [r * 0.6, r * 0.35]]),
        color: cloth,
        band: false,
      };
    if (c === "hair") return { back: T([[r * 0.8, -r * 0.62], [0, -r * 1.3], [-r * 1.05, -r * 0.3], [-r * 1.1, r * 0.6], [-r * 0.55, r * 0.85], [-r * 0.25, 0]]), color: ink("#1E1410"), band: false };
    if (c === "wig") return { back: T([[r * 0.6, -r * 0.85], [0, -r * 1.32], [-r * 1.05, -r * 0.6], [-r * 1.15, r * 1.15], [r * 0.15, r * 1.15], [r * 0.3, r * 0.3]]), color: ink("#120E0C"), band: false };
    if (c === "nemes")
      return {
        back: T([[r * 0.8, -r * 0.7], [0, -r * 1.35], [-r * 1.1, -r * 0.6], [-r * 1.7, r * 2.1], [-r * 0.2, r * 1.9], [r * 0.15, r * 0.9], [r * 0.6, r * 1.8], [r * 0.9, r * 1.6], [r * 0.7, r * 0.2]]),
        color: ink("#C9A24A"),
        band: false,
        stripes: true,
      };
    if (c === "crown") return { back: T([[r * 0.8, -r * 0.62], [0, -r * 1.3], [-r * 1.05, -r * 0.3], [-r * 1.1, r * 0.6], [-r * 0.55, r * 0.85], [-r * 0.25, 0]]), color: ink("#2A1C14"), band: false, crown: true };
    if (c === "long")
      return { back: T([[r * 0.8, -r * 0.7], [0, -r * 1.36], [-r * 1.1, -r * 0.4], [-r * 1.45, r * 1.6], [-r * 1.2, r * 4.2], [-r * 0.2, r * 3.6], [-r * 0.35, r * 1.2], [-r * 0.2, 0]]), color: ink("#1E1410"), band: false };
    if (c === "helmet") return { back: T([[r * 1.0, -r * 0.2], [r * 0.7, -r * 1.2], [-r * 0.3, -r * 1.45], [-r * 1.15, -r * 0.7], [-r * 1.2, r * 0.5], [-r * 0.4, r * 0.2]]), color: ink("#6A6A6E"), band: false, helmet: true };
    if (c === "plume") return { back: T([[r * 1.0, -r * 0.3], [r * 0.9, -r * 2.0], [r * 0.2, -r * 2.3], [-r * 0.6, -r * 2.2], [-r * 1.2, -r * 1.6], [-r * 1.2, r * 0.4], [-r * 0.4, r * 0.1]]), color: ink("#C8B888"), band: false, plume: true };
    if (c === "tiara")
      return { back: T([[r * 0.8, -r * 0.62], [0, -r * 1.3], [-r * 1.05, -r * 0.3], [-r * 1.3, r * 0.75], [-r * 0.95, r * 1.35], [-r * 0.35, r * 1.05], [-r * 0.25, 0]]), color: ink("#1E1410"), band: false, tiara: true };
    if (c === "cone")
      return { back: T([[r * 1.0, -r * 0.3], [r * 0.55, -r * 1.2], [r * 0.1, -r * 2.0], [-r * 0.6, -r * 1.2], [-r * 1.15, -r * 0.2], [-r * 1.12, r * 0.6], [-r * 0.45, r * 0.4]]), color: ink(look.cap ?? "#6E6C70"), band: false, cone: true };
    if (c === "turban")
      return { back: T([[r * 0.7, -r * 0.7], [0, -r * 1.5], [-r * 1.15, -r * 0.6], [-r * 1.2, r * 0.3], [-r * 0.85, r * 0.85], [-r * 0.5, r * 0.3], [-r * 0.3, 0]]), color: ink(look.cap ?? look.mantle ?? "#D8CCB0"), band: false, turban: true };
    if (c === "galea")
      return { back: T([[r * 0.95, -r * 0.35], [r * 0.6, -r * 1.25], [-r * 0.35, -r * 1.42], [-r * 1.12, -r * 0.8], [-r * 1.28, r * 0.2], [-r * 1.78, r * 0.58], [-r * 1.6, r * 0.84], [-r * 0.78, r * 0.46], [-r * 0.4, 0]]), color: ink("#8A8C94"), band: false, galea: true };
    if (c === "crest")
      return { back: T([[r * 1.0, -r * 0.3], [r * 0.7, -r * 1.25], [-r * 0.3, -r * 1.45], [-r * 1.15, -r * 0.8], [-r * 1.28, r * 0.4], [-r * 0.72, r * 0.62], [-r * 0.35, r * 0.1]]), color: ink("#A8803E"), band: false, hcrest: true };
    if (c === "laurel" || c === "thorns")
      return { back: T([[r * 0.8, -r * 0.62], [0, -r * 1.3], [-r * 1.05, -r * 0.3], [-r * 1.1, r * 0.6], [-r * 0.55, r * 0.85], [-r * 0.25, 0]]), color: ink(look.beard === "white" ? "#5A524A" : "#1E1410"), band: false, wreath: c };
    return null;
  };
  const HT = (pts: Pt[]) => pts.map((p) => add(Hc, rot(p, lean + headTilt)));
  const poly = (pts: Pt[]) => `${pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} Z`;
  const capFront = () => {
    if (!hw) return null;
    const r = hr;
    if ("tiara" in hw) {
      const cap = ink(look.cap ?? "#E6DCC6");
      const body = HT([[r * 1.0, -r * 0.4], [r * 1.14, -r * 2.3], [-r * 1.14, -r * 2.24], [-r * 1.02, -r * 0.34]]);
      const band = HT([[r * 1.03, -r * 0.62], [r * 1.07, -r * 1.02], [-r * 1.07, -r * 0.96], [-r * 1.03, -r * 0.56]]);
      const rimTop = HT([[r * 1.16, -r * 2.3], [-r * 1.16, -r * 2.24]]);
      const knob = HT([[r * 0.22, -r * 2.28], [r * 0.08, -r * 2.62], [-r * 0.08, -r * 2.62], [-r * 0.22, -r * 2.27]]);
      return (
        <>
          <path d={poly(body)} fill={cap} stroke={rim} strokeWidth={rimW} strokeLinejoin="round" />
          {[-0.5, 0, 0.5].map((u) => {
            const [a, b] = HT([[r * u, -r * 1.05], [r * u * 1.08, -r * 2.2]]);
            return <line key={u} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={tone(cap, -0.16)} strokeWidth={1.1} />;
          })}
          <path d={poly(band)} fill={glow > 0 ? "#FFF0C0" : "#E2B850"} />
          <path d={poly(knob)} fill={cap} stroke={rim} strokeWidth={rimW * 0.8} />
          <line x1={rimTop[0][0]} y1={rimTop[0][1]} x2={rimTop[1][0]} y2={rimTop[1][1]} stroke="#E2B850" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    }
    if ("cone" in hw) {
      const metal = hw.color;
      const dome = smooth(HT([[r * 1.06, -r * 0.3], [r * 0.72, -r * 1.15], [r * 0.12, -r * 2.12], [-r * 0.62, -r * 1.2], [-r * 1.1, -r * 0.24], [0, -r * 0.5]]), true, 0.25);
      const brim = HT([[r * 1.08, -r * 0.34], [0, -r * 0.56], [-r * 1.12, -r * 0.26]]);
      const cheek = HT([[r * 0.62, -r * 0.42], [r * 0.7, r * 0.1], [r * 0.44, r * 0.62]]);
      const shine = HT([[r * 0.78, -r * 0.6], [r * 0.5, -r * 1.25], [r * 0.16, -r * 1.9]]);
      return (
        <>
          <path d={dome} fill={metal} stroke={rim} strokeWidth={rimW} />
          <path d={smooth(cheek, false)} stroke={metal} strokeWidth={4.2} fill="none" strokeLinecap="round" />
          <path d={smooth(cheek, false)} stroke="rgba(230,232,240,0.35)" strokeWidth={1} fill="none" />
          <path d={smooth(brim, false)} stroke={tone(metal, 0.3)} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <path d={smooth(shine, false)} stroke="rgba(236,238,246,0.5)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </>
      );
    }
    if ("turban" in hw) {
      const cloth = hw.color;
      const wrap = smooth(HT([[r * 1.08, -r * 0.36], [r * 1.18, -r * 1.0], [r * 0.62, -r * 1.64], [-r * 0.3, -r * 1.76], [-r * 1.16, -r * 1.28], [-r * 1.26, -r * 0.46], [-r * 0.5, -r * 0.5], [r * 0.3, -r * 0.62]]), true, 0.45);
      return (
        <>
          <path d={wrap} fill={cloth} stroke={rim} strokeWidth={rimW} />
          {[0, 1, 2].map((i) => {
            const pts = HT([[r * 1.08, -r * (0.55 + 0.32 * i)], [r * 0.1, -r * (0.95 + 0.3 * i)], [-r * 1.15, -r * (0.75 + 0.28 * i)]]);
            return <path key={i} d={smooth(pts, false)} stroke={tone(cloth, -0.24)} strokeWidth={1.3} fill="none" />;
          })}
        </>
      );
    }
    if ("galea" in hw) {
      const metal = hw.color;
      const trim = glow > 0 ? "#FFF0C0" : ink("#C09A52");
      const crestC = glow > 0 ? mixHex(ink(look.cap ?? "#A82820"), "#FFF6DE", glow) : ink(look.cap ?? "#A82820");
      const crest = smooth(HT([[r * 0.72, -r * 1.22], [r * 0.62, -r * 1.95], [r * 0.05, -r * 2.42], [-r * 0.82, -r * 2.3], [-r * 1.38, -r * 1.72], [-r * 1.22, -r * 1.3], [-r * 0.6, -r * 1.62], [0, -r * 1.7], [r * 0.38, -r * 1.42]]), true, 0.4);
      const dome = smooth(HT([[r * 1.08, -r * 0.3], [r * 0.84, -r * 1.06], [r * 0.05, -r * 1.46], [-r * 0.86, -r * 1.16], [-r * 1.2, -r * 0.34], [-r * 0.5, -r * 0.48], [r * 0.4, -r * 0.5]]), true, 0.35);
      const brow = HT([[r * 1.2, -r * 0.3], [r * 0.2, -r * 0.6], [-r * 1.18, -r * 0.3]]);
      const cheek = smooth(HT([[r * 0.3, -r * 0.4], [r * 0.44, r * 0.2], [r * 0.32, r * 0.84], [-r * 0.02, r * 0.9], [-r * 0.24, r * 0.3], [-r * 0.2, -r * 0.38]]), true, 0.3);
      const hinge = HT([[r * 0.05, -r * 0.4]])[0];
      const shine = HT([[r * 0.7, -r * 0.7], [r * 0.3, -r * 1.2], [-r * 0.3, -r * 1.3]]);
      return (
        <>
          <path d={crest} fill={crestC} stroke={rim} strokeWidth={rimW * 0.8} />
          {[0, 1].map((i) => (
            <path key={i} d={smooth(HT([[r * (0.5 - 0.1 * i), -r * 1.42], [r * (0.32 - 0.1 * i), -r * (2.02 - 0.12 * i)], [-r * 0.45, -r * (2.18 - 0.16 * i)], [-r * (1.12 - 0.1 * i), -r * 1.64]]), false)} stroke={tone(crestC, -0.32)} strokeWidth={1} fill="none" />
          ))}
          <path d={dome} fill={metal} stroke={rim} strokeWidth={rimW} />
          <path d={smooth(shine, false)} stroke="rgba(236,238,246,0.45)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <path d={smooth(brow, false)} stroke={trim} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <path d={cheek} fill={tone(metal, -0.08)} stroke={rim} strokeWidth={rimW * 0.8} />
          <circle cx={hinge[0]} cy={hinge[1]} r={1.4} fill={trim} />
        </>
      );
    }
    if ("hcrest" in hw) {
      const metal = hw.color;
      const plumeC = glow > 0 ? mixHex(ink(look.cap ?? "#E2D6B8"), "#FFF6DE", glow) : ink(look.cap ?? "#E2D6B8");
      const dome = smooth(HT([[r * 1.32, -r * 0.42], [r * 0.98, -r * 1.06], [r * 0.1, -r * 1.5], [-r * 0.86, -r * 1.2], [-r * 1.2, -r * 0.32], [-r * 0.5, -r * 0.5], [r * 0.6, -r * 0.56]]), true, 0.35);
      const cheek = smooth(HT([[r * 0.42, -r * 0.48], [r * 0.66, r * 0.12], [r * 0.48, r * 0.8], [r * 0.06, r * 0.74], [-r * 0.16, -r * 0.36]]), true, 0.3);
      const volute = HT([[r * 0.18, 0], [r * 0.38, r * 0.18], [r * 0.28, r * 0.4], [r * 0.12, r * 0.3]]);
      const [s0, s1] = HT([[0, -r * 1.46], [-r * 0.1, -r * 2.02]]);
      const plume = smooth(HT([[r * 0.1, -r * 1.96], [r * 0.25, -r * 2.5], [-r * 0.5, -r * 2.82], [-r * 1.55, -r * 2.55], [-r * 2.3, -r * 1.75], [-r * 2.1, -r * 1.55], [-r * 1.35, -r * 2.05], [-r * 0.45, -r * 2.15]]), true, 0.4);
      const shine = HT([[r * 0.85, -r * 0.75], [r * 0.4, -r * 1.25], [-r * 0.2, -r * 1.38]]);
      return (
        <>
          <path d={plume} fill={plumeC} stroke={rim} strokeWidth={rimW * 0.8} />
          {[0, 1].map((i) => (
            <path key={i} d={smooth(HT([[0, -r * (2.1 + 0.2 * i)], [-r * 0.6, -r * (2.5 + 0.1 * i)], [-r * 1.4, -r * (2.3 - 0.05 * i)], [-r * (2.0 - 0.1 * i), -r * 1.75]]), false)} stroke={tone(plumeC, -0.25)} strokeWidth={1} fill="none" />
          ))}
          <line x1={s0[0]} y1={s0[1]} x2={s1[0]} y2={s1[1]} stroke={metal} strokeWidth={2.6} strokeLinecap="round" />
          <path d={dome} fill={metal} stroke={rim} strokeWidth={rimW} />
          <path d={smooth(shine, false)} stroke="rgba(255,236,190,0.5)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <path d={cheek} fill={tone(metal, -0.1)} stroke={rim} strokeWidth={rimW * 0.8} />
          <path d={smooth(volute, false)} stroke={tone(metal, 0.35)} strokeWidth={1.1} fill="none" />
        </>
      );
    }
    if ("wreath" in hw) {
      const band: Pt[] = [[r * 0.94, -r * 0.44], [r * 0.5, -r * 0.84], [0, -r * 0.96], [-r * 0.55, -r * 0.86], [-r * 1.04, -r * 0.44]];
      const along = (t: number): [Pt, Pt] => {
        const n = band.length - 1;
        const u = Math.min(n - 1e-6, Math.max(0, t * n));
        const i = Math.floor(u);
        const fr = u - i;
        const a = band[i];
        const b = band[i + 1];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [[lerp(a[0], b[0], fr), lerp(a[1], b[1], fr)], [(b[0] - a[0]) / L, (b[1] - a[1]) / L]];
      };
      if (hw.wreath === "laurel") {
        const leafC = glow > 0 ? "#FFF0C0" : ink(look.cap ?? "#5E7E36");
        return (
          <>
            <path d={smooth(HT(band), false)} stroke={tone(leafC, -0.3)} strokeWidth={1.4} fill="none" />
            {Array.from({ length: 12 }, (_, i) => {
              const [p, u] = along((i + 0.5) / 12);
              const side = i % 2 ? 1 : -1;
              const nx = -u[1];
              const ny = u[0];
              let vx = -u[0] * 0.8 + nx * side * 0.6;
              let vy = -u[1] * 0.8 + ny * side * 0.6;
              const vl = Math.hypot(vx, vy) || 1;
              vx /= vl;
              vy /= vl;
              const len = r * 0.5;
              const w = r * 0.13;
              const c: Pt = [p[0] + vx * len * 0.5, p[1] + vy * len * 0.5];
              const leaf = HT([p, [c[0] - vy * w, c[1] + vx * w], [p[0] + vx * len, p[1] + vy * len], [c[0] + vy * w, c[1] - vx * w]]);
              return <path key={i} d={smooth(leaf, true, 0.5)} fill={i % 3 === 0 ? tone(leafC, 0.12) : leafC} stroke={tone(leafC, -0.35)} strokeWidth={0.6} />;
            })}
          </>
        );
      }
      const tc = ink("#3A2A1A");
      const strand = (ph: number) => HT(Array.from({ length: 13 }, (_, i) => {
        const [p, u] = along(i / 12);
        const o = r * 0.08 * Math.sin((i / 12) * Math.PI * 6 + ph);
        return [p[0] - u[1] * o, p[1] + u[0] * o] as Pt;
      }));
      return (
        <>
          <path d={smooth(strand(0), false)} stroke={tc} strokeWidth={2.3} fill="none" strokeLinecap="round" />
          <path d={smooth(strand(Math.PI), false)} stroke={ink("#5A4630")} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          {Array.from({ length: 9 }, (_, i) => {
            const [p] = along((i + 0.3) / 9);
            const ol = Math.hypot(p[0], p[1]) || 1;
            const a = (i % 2 ? 24 : -24) * (Math.PI / 180);
            const ox = p[0] / ol;
            const oy = p[1] / ol;
            const dx = ox * Math.cos(a) - oy * Math.sin(a);
            const dy = ox * Math.sin(a) + oy * Math.cos(a);
            const [q0, q1] = HT([p, [p[0] + dx * r * 0.27, p[1] + dy * r * 0.27]]);
            return <line key={i} x1={q0[0]} y1={q0[1]} x2={q1[0]} y2={q1[1]} stroke={tc} strokeWidth={1.1} strokeLinecap="round" />;
          })}
        </>
      );
    }
    return null;
  };
  const hw = headwear();
  const r = hr;
  const beard = look.beard === "wild"
    ? smooth(HT([[r * 0.5, r * 0.3], [r * 1.12, r * 0.7], [r * 1.0, r * 1.3], [r * 0.7, r * 1.6], [r * 0.48, r * 2.15], [r * 0.12, r * 1.8], [-r * 0.2, r * 2.0], [-r * 0.38, r * 1.3], [-r * 0.6, r * 0.6]]), true, 0.3)
    : look.beard
    ? smooth([[r * 0.55, r * 0.45], [r * 1.05, r * 0.95], [r * 0.45, r * 1.65], [-r * 0.05, r * 1.45], [-r * 0.25, r * 0.8]].map((p) => add(Hc, rot(p as Pt, lean + headTilt))), true, 0.45)
    : null;
  const beardColor = look.beard === "white" ? ink("#D8D2C6") : look.beard === "wild" ? ink("#22180F") : ink("#1A120E");
  const nose = [[r * 0.92, -r * 0.12], [r * 1.22, r * 0.18], [r * 0.9, r * 0.32]].map((p) => add(Hc, rot(p as Pt, lean + headTilt)));
  const mouth = add(Hc, rot([r * 0.95, r * 0.4], lean + headTilt));

  const holdAt = (h: Hold | null | undefined, A: Limb) => {
    if (!h) return null;
    const [hx, hy] = A.hd;
    const wood = ink("#6A4A2A");
    switch (h) {
      case "jar":
        return <path d={`M ${hx - 9} ${hy - 26} Q ${hx - 13} ${hy - 10} ${hx - 8} ${hy + 2} L ${hx + 8} ${hy + 2} Q ${hx + 13} ${hy - 10} ${hx + 9} ${hy - 26} Z M ${hx - 5} ${hy - 26} L ${hx - 6} ${hy - 32} L ${hx + 6} ${hy - 32} L ${hx + 5} ${hy - 26} Z`} fill={ink("#9A6A44")} stroke={rim} strokeWidth={rimW} />;
      case "bundle":
        return <ellipse cx={hx + 2} cy={hy - 4} rx={14} ry={10} fill={ink("#7A6248")} stroke={rim} strokeWidth={rimW} />;
      case "wood":
        return (
          <g>
            {[-6, -2, 2, 6].map((o, i) => (
              <line key={i} x1={S[0] - 30} y1={S[1] + 4 + o} x2={S[0] + 26} y2={S[1] - 10 + o} stroke={wood} strokeWidth={4} strokeLinecap="round" />
            ))}
            <line x1={S[0] - 2} y1={S[1] - 6} x2={S[0] + 2} y2={S[1] + 10} stroke={ink("#3A2A1A")} strokeWidth={2} />
          </g>
        );
      case "knife":
        return <path d={`M ${hx} ${hy} L ${hx + 3} ${hy - 26} L ${hx + 6} ${hy - 1} Z`} fill="#E8E2D2" opacity={0.9} />;
      case "lamb":
        return (
          <g>
            <ellipse cx={hx + 4} cy={hy - 6} rx={18} ry={11} fill={ink("#E2DACB")} stroke={rim} strokeWidth={rimW} />
            <ellipse cx={hx + 22} cy={hy - 12} rx={6} ry={5} fill={ink("#3A3028")} />
          </g>
        );
      case "torch":
        return (
          <g>
            <line x1={hx} y1={hy + 8} x2={hx + 4} y2={hy - 30} stroke={wood} strokeWidth={4} strokeLinecap="round" />
            <ellipse cx={hx + 4} cy={hy - 38} rx={7} ry={12} fill="#FFB050" opacity={0.95} />
            <ellipse cx={hx + 4} cy={hy - 36} rx={3.5} ry={7} fill="#FFF0C0" />
          </g>
        );
      case "cup":
        return <path d={`M ${hx - 7} ${hy - 14} L ${hx + 7} ${hy - 14} L ${hx + 4} ${hy - 4} L ${hx + 1} ${hy - 4} L ${hx + 1} ${hy + 2} L ${hx + 5} ${hy + 4} L ${hx - 5} ${hy + 4} L ${hx - 1} ${hy + 2} L ${hx - 1} ${hy - 4} L ${hx - 4} ${hy - 4} Z`} fill="#D8DCE4" stroke="rgba(255,255,255,0.8)" strokeWidth={0.8} />;
      case "basket":
        return <path d={`M ${hx - 16} ${hy - 14} L ${hx + 16} ${hy - 14} L ${hx + 12} ${hy + 4} L ${hx - 12} ${hy + 4} Z`} fill={ink("#8A6A3A")} stroke={rim} strokeWidth={rimW} />;
      case "bowl":
        return <path d={`M ${hx - 14} ${hy - 6} Q ${hx} ${hy + 10} ${hx + 14} ${hy - 6} Z`} fill={ink("#8A5A3A")} stroke={rim} strokeWidth={rimW} />;
      case "scroll":
        return <rect x={hx - 4} y={hy - 18} width={8} height={22} rx={3} fill={ink("#E6DAC0")} />;
      case "baby":
        return (
          <g>
            <ellipse cx={hx + 2} cy={hy - 8} rx={15} ry={9} fill={ink("#E8DCC4")} stroke={rim} strokeWidth={rimW} />
            <circle cx={hx + 15} cy={hy - 12} r={5.5} fill={skin} />
          </g>
        );
      case "hoe":
        return (
          <g>
            <line x1={hx - 10} y1={hy - 22} x2={hx + 26} y2={hy + 40} stroke={wood} strokeWidth={3.5} strokeLinecap="round" />
            <path d={`M ${hx + 24} ${hy + 38} L ${hx + 38} ${hy + 44} L ${hx + 30} ${hy + 50} Z`} fill={ink("#4A4440")} />
          </g>
        );
      case "stone":
        return <ellipse cx={hx + 2} cy={hy - 6} rx={11} ry={8} fill={ink("#7A746A")} stroke={rim} strokeWidth={rimW} />;
      case "coat":
        return <path d={`M ${hx - 10} ${hy - 6} L ${hx + 12} ${hy - 6} L ${hx + 18} ${hy + 34} L ${hx - 14} ${hy + 34} Z`} fill={ink("#B8442E")} stroke="#F2C66E" strokeWidth={1.4} />;
      case "sword": {
        const [ex, ey] = A.el;
        const dx = hx - ex;
        const dy = hy - ey;
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L;
        const uy = dy / L;
        return (
          <g>
            <path d={`M ${hx - uy * 3} ${hy + ux * 3} L ${hx + ux * 62 - uy * 1.5} ${hy + uy * 62 + ux * 1.5} L ${hx + ux * 70} ${hy + uy * 70} L ${hx + ux * 62 + uy * 1.5} ${hy + uy * 62 - ux * 1.5} L ${hx + uy * 3} ${hy - ux * 3} Z`} fill={glow > 0 ? "#FFF6DE" : "#DCE0E8"} stroke="rgba(255,255,255,0.7)" strokeWidth={0.8} />
            <line x1={hx - uy * 9} y1={hy + ux * 9} x2={hx + uy * 9} y2={hy - ux * 9} stroke={ink("#8A6A3A")} strokeWidth={3} strokeLinecap="round" />
          </g>
        );
      }
      case "spear":
        return (
          <g>
            <line x1={hx - 4} y1={hy + 60} x2={hx + 6} y2={hy - 110} stroke={wood} strokeWidth={3.2} strokeLinecap="round" />
            <path d={`M ${hx + 6} ${hy - 110} L ${hx + 1} ${hy - 96} L ${hx + 7} ${hy - 128} L ${hx + 11} ${hy - 96} Z`} fill="#C8CCD4" stroke="rgba(255,255,255,0.6)" strokeWidth={0.6} />
          </g>
        );
      case "shofar":
        return <path d={`M ${hx - 2} ${hy - 2} Q ${hx + 14} ${hy - 18} ${hx + 8} ${hy - 40} Q ${hx + 6} ${hy - 50} ${hx + 16} ${hy - 56} L ${hx + 20} ${hy - 50} Q ${hx + 13} ${hy - 44} ${hx + 16} ${hy - 36} Q ${hx + 22} ${hy - 12} ${hx + 3} ${hy + 4} Z`} fill={ink("#C8B088")} stroke={rim} strokeWidth={rimW} />;
      case "timbrel":
        return (
          <g>
            <ellipse cx={hx + 2} cy={hy - 14} rx={13} ry={16} fill={ink("#D8C49A")} stroke={ink("#7A5230")} strokeWidth={3} />
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} cx={hx + 2 + Math.cos(i * 1.57 + 0.4) * 14} cy={hy - 14 + Math.sin(i * 1.57 + 0.4) * 17} r={2.6} fill="#E8C060" />
            ))}
          </g>
        );
      case "censer":
        return (
          <g>
            <line x1={hx} y1={hy} x2={hx + 2} y2={hy + 22} stroke={ink("#8A7A5A")} strokeWidth={1.2} />
            <path d={`M ${hx - 11} ${hy + 22} Q ${hx + 2} ${hy + 40} ${hx + 15} ${hy + 22} Z`} fill={ink("#B88A3A")} stroke={rim} strokeWidth={rimW} />
            <ellipse cx={hx + 2} cy={hy + 21} rx={9} ry={3} fill="#FF9A3A" opacity={0.9} />
          </g>
        );
      case "tablets":
        return (
          <g>
            {[-1, 1].map((k) => (
              <path key={k} d={`M ${hx + k * 11 - 10} ${hy + 6} L ${hx + k * 11 - 10} ${hy - 26} Q ${hx + k * 11} ${hy - 38} ${hx + k * 11 + 10} ${hy - 26} L ${hx + k * 11 + 10} ${hy + 6} Z`} fill={glow > 0 ? "#EDE6D6" : ink("#9A948A")} stroke={glow > 0 ? "rgba(255,240,200,0.9)" : rim} strokeWidth={rimW} />
            ))}
          </g>
        );
      case "sickle":
        return (
          <g>
            <line x1={hx} y1={hy + 6} x2={hx + 2} y2={hy - 8} stroke={wood} strokeWidth={3.5} strokeLinecap="round" />
            <path d={`M ${hx + 2} ${hy - 8} Q ${hx + 26} ${hy - 30} ${hx + 30} ${hy - 6} Q ${hx + 22} ${hy - 22} ${hx + 3} ${hy - 4} Z`} fill="#C8CCD4" />
          </g>
        );
      case "jartorch":
        return (
          <g>
            <path d={`M ${hx - 10} ${hy - 24} Q ${hx - 15} ${hy - 8} ${hx - 9} ${hy + 4} L ${hx + 9} ${hy + 4} Q ${hx + 15} ${hy - 8} ${hx + 10} ${hy - 24} Z`} fill={ink("#9A6A44")} stroke={rim} strokeWidth={rimW} />
            <ellipse cx={hx} cy={hy - 34} rx={7} ry={12} fill="#FFB050" opacity={0.95} />
            <ellipse cx={hx} cy={hy - 32} rx={3.5} ry={7} fill="#FFF0C0" />
          </g>
        );
      case "sandal":
        return <path d={`M ${hx - 4} ${hy - 4} Q ${hx + 10} ${hy - 10} ${hx + 22} ${hy - 4} Q ${hx + 24} ${hy + 2} ${hx + 18} ${hy + 3} L ${hx - 2} ${hy + 3} Z`} fill={ink("#7A5230")} stroke={rim} strokeWidth={rimW} />;
      case "mallet":
      case "jawbone": {
        const [ex, ey] = A.el;
        const L = Math.hypot(hx - ex, hy - ey) || 1;
        const ux = (hx - ex) / L;
        const uy = (hy - ey) / L;
        if (h === "mallet") {
          const tx = hx + ux * 30;
          const ty = hy + uy * 30;
          return (
            <g>
              <line x1={hx - ux * 4} y1={hy - uy * 4} x2={tx} y2={ty} stroke={wood} strokeWidth={3.5} strokeLinecap="round" />
              <path d={`M ${tx - uy * 13 - ux * 7} ${ty + ux * 13 - uy * 7} L ${tx + uy * 13 - ux * 7} ${ty - ux * 13 - uy * 7} L ${tx + uy * 13 + ux * 7} ${ty - ux * 13 + uy * 7} L ${tx - uy * 13 + ux * 7} ${ty + ux * 13 + uy * 7} Z`} fill={ink("#7A5A3A")} stroke={rim} strokeWidth={rimW} />
            </g>
          );
        }
        const P = (a: number, b: number) => `${hx + ux * a - uy * b} ${hy + uy * a + ux * b}`;
        return (
          <path d={`M ${P(-4, -4)} Q ${P(20, -10)} ${P(40, -6)} L ${P(46, -16)} L ${P(50, -4)} Q ${P(48, 6)} ${P(36, 6)} Q ${P(20, 8)} ${P(4, 6)} Z`} fill={ink("#E2D8C2")} stroke={rim} strokeWidth={rimW} />
        );
      }
      case "harp":
        // A small lyre held upright against the chest: two curved arms, a crossbar, five strings.
        return (
          <g>
            <path d={`M ${hx - 10} ${hy + 4} Q ${hx - 16} ${hy - 20} ${hx - 8} ${hy - 40} M ${hx + 10} ${hy + 4} Q ${hx + 18} ${hy - 20} ${hx + 12} ${hy - 42}`} stroke={wood} strokeWidth={3.4} fill="none" strokeLinecap="round" />
            <line x1={hx - 11} y1={hy - 38} x2={hx + 15} y2={hy - 41} stroke={wood} strokeWidth={3} strokeLinecap="round" />
            <path d={`M ${hx - 12} ${hy + 2} Q ${hx} ${hy + 10} ${hx + 12} ${hy + 2} Z`} fill={wood} stroke={rim} strokeWidth={rimW} />
            {[-6, -3, 0, 3, 6].map((o) => (
              <line key={o} x1={hx + o} y1={hy + 3} x2={hx + o * 1.2 + 1.5} y2={hy - 39} stroke="rgba(240,226,190,0.85)" strokeWidth={0.8} />
            ))}
          </g>
        );
      case "sling": {
        // Two cords from the hand along the forearm line to a pouch with a stone.
        const [ex, ey] = A.el;
        const L = Math.hypot(hx - ex, hy - ey) || 1;
        const ux = (hx - ex) / L;
        const uy = (hy - ey) / L;
        const px = hx + ux * 34;
        const py = hy + uy * 34;
        return (
          <g>
            <path d={`M ${hx} ${hy} L ${px - uy * 5} ${py + ux * 5} M ${hx} ${hy} L ${px + uy * 5} ${py - ux * 5}`} stroke={ink("#9A8460")} strokeWidth={1.4} />
            <ellipse cx={px + ux * 3} cy={py + uy * 3} rx={6} ry={5} fill={ink("#6A5038")} />
            <circle cx={px + ux * 3} cy={py + uy * 3} r={3.2} fill={ink("#8A847A")} />
          </g>
        );
      }
      case "bow":
      case "bowdraw": {
        // A bow held upright in the front hand; "bowdraw" pulls the string back to the chest with an arrow.
        const pull = h === "bowdraw" ? Math.max(14, Math.hypot(hx - S[0], hy - S[1]) - 6) : 0;
        const tx = hx;
        const top: Pt = [tx + 2, hy - 44];
        const bot: Pt = [tx + 2, hy + 44];
        const nock: Pt = [tx - pull, hy];
        return (
          <g>
            <path d={`M ${top[0]} ${top[1]} Q ${tx + 26} ${hy} ${bot[0]} ${bot[1]}`} stroke={wood} strokeWidth={3.4} fill="none" strokeLinecap="round" />
            <path d={`M ${top[0]} ${top[1]} L ${nock[0]} ${nock[1]} L ${bot[0]} ${bot[1]}`} stroke="rgba(236,226,200,0.8)" strokeWidth={0.9} fill="none" />
            {h === "bowdraw" ? (
              <g>
                <line x1={nock[0]} y1={hy} x2={tx + 30} y2={hy} stroke={ink("#8A6A44")} strokeWidth={1.8} />
                <path d={`M ${tx + 30} ${hy - 3} L ${tx + 38} ${hy} L ${tx + 30} ${hy + 3} Z`} fill="#C8CCD4" />
              </g>
            ) : null}
          </g>
        );
      }
      case "oilhorn":
        // A horn of anointing oil, golden, with a bead of oil at its mouth.
        return (
          <g>
            <path d={`M ${hx - 2} ${hy - 2} Q ${hx + 14} ${hy - 18} ${hx + 8} ${hy - 40} Q ${hx + 6} ${hy - 50} ${hx + 16} ${hy - 56} L ${hx + 20} ${hy - 50} Q ${hx + 13} ${hy - 44} ${hx + 16} ${hy - 36} Q ${hx + 22} ${hy - 12} ${hx + 3} ${hy + 4} Z`} fill={ink("#D8B868")} stroke={rim} strokeWidth={rimW} />
            <ellipse cx={hx + 18} cy={hy - 58} rx={3} ry={2.2} fill="rgba(255,226,140,0.95)" />
          </g>
        );
      case "shield":
        return (
          <g>
            <circle cx={hx + 4} cy={hy - 6} r={24} fill={ink("#8A6E3A")} stroke={rim} strokeWidth={rimW * 1.2} />
            <circle cx={hx + 4} cy={hy - 6} r={17} fill="none" stroke={ink("#B8964E")} strokeWidth={2} />
            <circle cx={hx + 4} cy={hy - 6} r={5} fill={ink("#C8A860")} />
          </g>
        );
      case "cloth":
        // A torn corner of a royal robe.
        return <path d={`M ${hx - 6} ${hy - 6} L ${hx + 14} ${hy - 10} L ${hx + 10} ${hy + 14} Z`} fill={ink("#6A2A44")} stroke="#E8C060" strokeWidth={1.2} />;
      case "scepter":
      case "axe":
      case "mantle": {
        const [ex, ey] = A.el;
        const L = Math.hypot(hx - ex, hy - ey) || 1;
        const ux = (hx - ex) / L;
        const uy = (hy - ey) / L;
        if (h === "scepter") {
          const a = (Math.atan2(ux, uy) * 180) / Math.PI;
          const t = Math.min(1, Math.max(0, (a - 45) / 40));
          let dx = ux * t;
          let dy = uy * t - (1 - t);
          const dl = Math.hypot(dx, dy) || 1;
          dx /= dl;
          dy /= dl;
          const g1 = glow > 0 ? "#FFF0C0" : "#E2B850";
          return (
            <g>
              <line x1={hx - dx * 26} y1={hy - dy * 26} x2={hx + dx * 84} y2={hy + dy * 84} stroke="#9A7428" strokeWidth={3.6} strokeLinecap="round" />
              <line x1={hx - dx * 24} y1={hy - dy * 24} x2={hx + dx * 82} y2={hy + dy * 82} stroke={g1} strokeWidth={1.8} strokeLinecap="round" />
              <circle cx={hx + dx * 88} cy={hy + dy * 88} r={6} fill={g1} stroke="rgba(255,240,200,0.85)" strokeWidth={1} />
              <circle cx={hx + dx * 86 - dy * 2} cy={hy + dy * 86 + dx * 2} r={2} fill="rgba(255,252,236,0.9)" />
            </g>
          );
        }
        if (h === "axe") {
          const P = (a: number, b: number) => `${(hx + ux * a - uy * b).toFixed(1)} ${(hy + uy * a + ux * b).toFixed(1)}`;
          return (
            <g>
              <line x1={hx - ux * 8} y1={hy - uy * 8} x2={hx + ux * 46} y2={hy + uy * 46} stroke={wood} strokeWidth={3.6} strokeLinecap="round" />
              <path d={`M ${P(34, -6)} L ${P(46, -6)} L ${P(50, 2)} L ${P(55, 15)} Q ${P(42, 19)} ${P(29, 15)} L ${P(32, 2)} Z`} fill={ink("#5A5A60")} stroke={rim} strokeWidth={rimW} />
              <path d={`M ${P(55, 15)} Q ${P(42, 19)} ${P(29, 15)}`} stroke="#C8CCD4" strokeWidth={1.4} fill="none" />
            </g>
          );
        }
        // The rolled cloak hangs from the fist, swung a little toward where the forearm points.
        const m = ink("#3A2A1C");
        let vx = ux * 0.45;
        let vy = uy * 0.45 + 0.75;
        const vl = Math.hypot(vx, vy) || 1;
        vx /= vl;
        vy /= vl;
        const nx = -vy;
        const ny = vx;
        const Q = (a: number, b: number) => `${(hx + vx * a + nx * b).toFixed(1)} ${(hy + vy * a + ny * b).toFixed(1)}`;
        const roll = `M ${Q(-3, -5)} Q ${Q(16, -9)} ${Q(34, -8)} Q ${Q(48, -7)} ${Q(54, -2)} Q ${Q(56, 4)} ${Q(50, 7)} Q ${Q(30, 9)} ${Q(14, 8)} L ${Q(-3, 5)} Z`;
        return (
          <g>
            <path d={roll} fill={m} stroke={rim} strokeWidth={rimW} strokeLinejoin="round" />
            <path d={`M ${Q(2, 1)} Q ${Q(24, 3)} ${Q(50, 0)}`} stroke={tone(m, 0.3)} strokeWidth={1.4} fill="none" />
            <path d={`M ${Q(40, 6)} Q ${Q(52, 12)} ${Q(60, 10)} L ${Q(58, 4)} Z`} fill={tone(m, 0.12)} />
            {[10, 20, 30, 40].map((a) => (
              <path key={a} d={`M ${Q(a, -6)} l ${(vx * 2 + nx * 3).toFixed(1)} ${(vy * 2 + ny * 3).toFixed(1)}`} stroke={tone(m, 0.35)} strokeWidth={1.1} />
            ))}
            <circle cx={hx} cy={hy} r={4.4} fill={skin} />
          </g>
        );
      }
      case "palm": {
        const b0: Pt = [hx - 3, hy + 16];
        const c0: Pt = [hx + 4, hy - 42];
        const t0: Pt = [hx + 22, hy - 86];
        const at = (t: number): Pt => [(1 - t) * (1 - t) * b0[0] + 2 * (1 - t) * t * c0[0] + t * t * t0[0], (1 - t) * (1 - t) * b0[1] + 2 * (1 - t) * t * c0[1] + t * t * t0[1]];
        const tan = (t: number): Pt => {
          const dx = 2 * (1 - t) * (c0[0] - b0[0]) + 2 * t * (t0[0] - c0[0]);
          const dy = 2 * (1 - t) * (c0[1] - b0[1]) + 2 * t * (t0[1] - c0[1]);
          const l = Math.hypot(dx, dy) || 1;
          return [dx / l, dy / l];
        };
        const leafC = glow > 0 ? "#FFF4D0" : ink("#5E7E34");
        const fronds: React.ReactNode[] = [];
        for (let i = 0; i < 14; i++) {
          const t = 0.28 + (i / 13) * 0.7;
          const p = at(t);
          const [ux, uy] = tan(t);
          const len = 25 * (1 - 0.6 * ((t - 0.28) / 0.7)) + 4;
          for (const sd of [-1, 1]) {
            const a = (sd * 52 * Math.PI) / 180;
            const dx = ux * Math.cos(a) - uy * Math.sin(a);
            const dy = ux * Math.sin(a) + uy * Math.cos(a);
            fronds.push(
              <path key={`${i}${sd}`} d={`M ${p[0].toFixed(1)} ${p[1].toFixed(1)} Q ${(p[0] + dx * len * 0.55).toFixed(1)} ${(p[1] + dy * len * 0.55).toFixed(1)} ${(p[0] + dx * len).toFixed(1)} ${(p[1] + dy * len + len * 0.38).toFixed(1)}`} stroke={i % 3 ? leafC : tone(leafC, 0.15)} strokeWidth={1.9} fill="none" strokeLinecap="round" />,
            );
          }
        }
        return (
          <g>
            <path d={`M ${b0[0]} ${b0[1]} Q ${c0[0]} ${c0[1]} ${t0[0]} ${t0[1]}`} stroke={ink("#7A8A4A")} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            {fronds}
          </g>
        );
      }
      case "net": {
        const nc = ink("#8A7C5C");
        const body = `M ${hx - 5} ${hy - 2} Q ${hx - 20} ${hy + 18} ${hx - 14} ${hy + 46} Q ${hx + 2} ${hy + 54} ${hx + 18} ${hy + 44} Q ${hx + 20} ${hy + 18} ${hx + 6} ${hy - 2} Z`;
        return (
          <g>
            <defs>
              <clipPath id={netClip}>
                <path d={body} />
              </clipPath>
            </defs>
            <path d={body} fill={nc} opacity={0.6} stroke={rim} strokeWidth={rimW * 0.8} />
            <g clipPath={`url(#${netClip})`}>
              {Array.from({ length: 10 }, (_, i) => (
                <g key={i}>
                  <line x1={hx - 32 + i * 7} y1={hy - 4} x2={hx - 10 + i * 7} y2={hy + 58} stroke={tone(nc, 0.35)} strokeWidth={0.8} />
                  <line x1={hx - 10 + i * 7} y1={hy - 4} x2={hx - 32 + i * 7} y2={hy + 58} stroke={tone(nc, 0.35)} strokeWidth={0.8} />
                </g>
              ))}
            </g>
            {[-10, -2, 6, 13].map((o, i) => (
              <ellipse key={i} cx={hx + o} cy={hy + 47 + (i % 2) * 3} rx={3.2} ry={2.2} fill={ink("#C8A060")} />
            ))}
          </g>
        );
      }
      case "loaves":
        return (
          <g>
            {[-9, 0, 9].map((o, i) => (
              <ellipse key={i} cx={hx + o} cy={hy - 15 - (i === 1 ? 3 : 0)} rx={8} ry={5} fill={ink("#C8955A")} stroke={rim} strokeWidth={rimW * 0.6} />
            ))}
            <path d={`M ${hx - 19} ${hy - 13} Q ${hx - 18} ${hy + 6} ${hx - 10} ${hy + 8} L ${hx + 10} ${hy + 8} Q ${hx + 18} ${hy + 6} ${hx + 19} ${hy - 13} Z`} fill={ink("#8A6A3A")} stroke={rim} strokeWidth={rimW} />
            {[-10, -3, 4, 11].map((o) => (
              <line key={o} x1={hx + o} y1={hy - 11} x2={hx + o * 0.8} y2={hy + 6} stroke={ink("#6A4E2A")} strokeWidth={1} />
            ))}
            <path d={`M ${hx - 18} ${hy - 4} Q ${hx} ${hy} ${hx + 18} ${hy - 4}`} stroke={ink("#6A4E2A")} strokeWidth={1} fill="none" />
          </g>
        );
      case "loaf":
        return (
          <g>
            <ellipse cx={hx + 3} cy={hy - 5} rx={12} ry={7} fill={ink("#C8955A")} stroke={rim} strokeWidth={rimW * 0.8} />
            <path d={`M ${hx - 4} ${hy - 9} Q ${hx + 3} ${hy - 6} ${hx + 10} ${hy - 9}`} stroke={ink("#8A5E30")} strokeWidth={1} fill="none" />
          </g>
        );
      case "fish": {
        const fc = ink("#8E9C98");
        const one = (ox: number, oy: number, len: number, key: string) => (
          <g key={key}>
            <path d={`M ${ox} ${oy} Q ${ox + 8} ${oy + len * 0.35} ${ox + 1.5} ${oy + len * 0.8} L ${ox + 6} ${oy + len} L ${ox - 5} ${oy + len} L ${ox - 1.5} ${oy + len * 0.8} Q ${ox - 8} ${oy + len * 0.35} ${ox} ${oy} Z`} fill={fc} stroke={rim} strokeWidth={rimW * 0.7} />
            <circle cx={ox + 1} cy={oy + 4.5} r={1.1} fill="#101010" />
          </g>
        );
        return (
          <g>
            <path d={`M ${hx} ${hy} L ${hx - 4} ${hy + 6} M ${hx} ${hy} L ${hx + 5} ${hy + 5}`} stroke={ink("#9A8460")} strokeWidth={1.1} />
            {one(hx - 4, hy + 5, 31, "f1")}
            {one(hx + 6, hy + 4, 27, "f2")}
          </g>
        );
      }
      case "lamp":
        return (
          <g>
            <GlowS x={hx + 15} y={hy - 13} r={48} color="255,180,90" opacity={0.55 * flick} />
            <path d={`M ${hx - 9} ${hy - 1} Q ${hx - 10} ${hy - 9} ${hx} ${hy - 9} Q ${hx + 9} ${hy - 9} ${hx + 12} ${hy - 5} L ${hx + 17} ${hy - 8} L ${hx + 15} ${hy - 1} Z`} fill={ink("#9A6A40")} stroke={rim} strokeWidth={rimW * 0.8} />
            <ellipse cx={hx + 16} cy={hy - 14} rx={2.6} ry={6 * flick} fill="#FFB050" />
            <ellipse cx={hx + 16} cy={hy - 12.5} rx={1.3} ry={3} fill="#FFF0C0" />
          </g>
        );
      case "towel":
        return (
          <g>
            <path d={`M ${hx - 8} ${hy - 3} L ${hx + 9} ${hy - 4} L ${hx + 11} ${hy + 32} Q ${hx + 2} ${hy + 36} ${hx - 7} ${hy + 31} Z`} fill={glow > 0 ? "#FFF8EC" : ink("#E6DECC")} stroke={rim} strokeWidth={rimW * 0.8} />
            <path d={`M ${hx - 2} ${hy} L ${hx - 1} ${hy + 32} M ${hx + 4} ${hy} L ${hx + 5} ${hy + 32}`} stroke={ink("#B8AE98")} strokeWidth={0.9} />
            <path d={`M ${hx - 8} ${hy + 22} L ${hx + 10} ${hy + 22}`} stroke={ink("#9A8E78")} strokeWidth={1} />
          </g>
        );
      case "trumpet": {
        const near = Math.hypot(hx - mouth[0], hy - mouth[1]) < 46;
        let ux: number;
        let uy: number;
        let ax: number;
        let ay: number;
        if (near) {
          [ux, uy] = dir(102 + lean + headTilt * 0.5);
          [ax, ay] = mouth;
        } else {
          const [ex, ey] = A.el;
          const L = Math.hypot(hx - ex, hy - ey) || 1;
          ux = (hx - ex) / L;
          uy = (hy - ey) / L;
          ax = hx - ux * 16;
          ay = hy - uy * 16;
        }
        const len = 76;
        const bx = ax + ux * len;
        const by = ay + uy * len;
        const nx = -uy;
        const ny = ux;
        const g = glow > 0 ? "#FFF0C0" : "#E2BE6A";
        return (
          <g>
            <line x1={ax} y1={ay} x2={bx - ux * 10} y2={by - uy * 10} stroke={g} strokeWidth={2.6} strokeLinecap="round" />
            <path d={`M ${bx - ux * 12 + nx * 1.6} ${by - uy * 12 + ny * 1.6} L ${bx + nx * 8} ${by + ny * 8} L ${bx - nx * 8} ${by - ny * 8} L ${bx - ux * 12 - nx * 1.6} ${by - uy * 12 - ny * 1.6} Z`} fill={g} stroke="rgba(255,244,214,0.8)" strokeWidth={0.8} />
            {[0.3, 0.6].map((t) => (
              <line key={t} x1={ax + ux * len * t + nx * 2.4} y1={ay + uy * len * t + ny * 2.4} x2={ax + ux * len * t - nx * 2.4} y2={ay + uy * len * t - ny * 2.4} stroke="#B08A3A" strokeWidth={1.4} />
            ))}
          </g>
        );
      }
      case "scutum": {
        const sc = glow > 0 ? "#FFF0D8" : ink("#8E2A22");
        const g = glow > 0 ? "#FFF6DE" : ink("#C8A050");
        return (
          <g>
            <rect x={hx - 16} y={hy - 40} width={36} height={62} rx={7} fill={sc} stroke={rim} strokeWidth={rimW * 1.1} />
            <rect x={hx - 12} y={hy - 36} width={28} height={54} rx={5} fill="none" stroke={g} strokeWidth={1.6} />
            <line x1={hx + 2} y1={hy - 36} x2={hx + 2} y2={hy + 18} stroke={g} strokeWidth={1.2} />
            {[-1, 1].map((d) => (
              <path key={d} d={`M ${hx + 2} ${hy - 9 + d * 8} l -7 ${d * 10} M ${hx + 2} ${hy - 9 + d * 8} l 7 ${d * 10}`} stroke={g} strokeWidth={1.1} fill="none" />
            ))}
            <circle cx={hx + 2} cy={hy - 9} r={6} fill={ink("#B0B4BC")} stroke={g} strokeWidth={1.2} />
          </g>
        );
      }
      case "pilum":
        return (
          <g>
            <line x1={hx - 4} y1={hy + 58} x2={hx + 4} y2={hy - 64} stroke={wood} strokeWidth={3.4} strokeLinecap="round" />
            <circle cx={hx + 4} cy={hy - 64} r={3} fill={ink("#5A5A60")} />
            <line x1={hx + 4} y1={hy - 64} x2={hx + 7} y2={hy - 112} stroke={ink("#9A9EA6")} strokeWidth={1.6} />
            <path d={`M ${hx + 7} ${hy - 112} l -2.4 6 l 2.4 -12 l 2.4 12 Z`} fill="#C8CCD4" />
          </g>
        );
      case "tablet":
        return (
          <g>
            <rect x={hx - 2} y={hy - 20} width={18} height={22} rx={1.5} fill={ink("#8A6A44")} stroke={rim} strokeWidth={rimW * 0.8} />
            <rect x={hx + 1} y={hy - 17} width={12} height={16} fill={ink("#3A2E22")} />
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1={hx + 3} y1={hy - 14 + i * 3.6} x2={hx + 11 - (i === 3 ? 4 : 0)} y2={hy - 14 + i * 3.6} stroke="rgba(230,214,180,0.85)" strokeWidth={0.8} />
            ))}
          </g>
        );
      case "alabaster":
        return (
          <g>
            <path d={`M ${hx - 3} ${hy - 30} L ${hx + 3} ${hy - 30} L ${hx + 2.4} ${hy - 24} Q ${hx + 9} ${hy - 16} ${hx + 7} ${hy - 2} Q ${hx} ${hy + 6} ${hx - 7} ${hy - 2} Q ${hx - 9} ${hy - 16} ${hx - 2.4} ${hy - 24} Z`} fill={ink("#E8DFCE")} stroke={rim} strokeWidth={rimW * 0.8} />
            <ellipse cx={hx} cy={hy - 30} rx={5} ry={1.8} fill={ink("#D8CDB8")} />
            <path d={`M ${hx - 3} ${hy - 18} Q ${hx - 4} ${hy - 8} ${hx - 2} ${hy - 2}`} stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} fill="none" />
          </g>
        );
      case "gift": {
        const g = glow > 0 ? "#FFF0C0" : ink("#D4A640");
        return (
          <g>
            <rect x={hx - 12} y={hy - 14} width={26} height={14} rx={1.5} fill={g} stroke={rim} strokeWidth={rimW * 0.8} />
            <path d={`M ${hx - 13} ${hy - 14} Q ${hx + 1} ${hy - 27} ${hx + 15} ${hy - 14} Z`} fill={tone(g, 0.12)} stroke={rim} strokeWidth={rimW * 0.8} />
            <line x1={hx - 12} y1={hy - 8} x2={hx + 14} y2={hy - 8} stroke={tone(g, -0.3)} strokeWidth={1} />
            {["#C83A3A", "#3A6AC8", "#3AA06A"].map((c, i) => (
              <circle key={i} cx={hx - 6 + i * 7} cy={hy - 4} r={1.6} fill={c} />
            ))}
          </g>
        );
      }
      case "urn": {
        const g = glow > 0 ? "#FFF0C0" : ink("#C89A3A");
        return (
          <g>
            <path d={`M ${hx - 6} ${hy - 22} L ${hx + 6} ${hy - 22} Q ${hx + 13} ${hy - 12} ${hx + 9} ${hy - 2} L ${hx + 6} ${hy + 3} L ${hx - 6} ${hy + 3} L ${hx - 9} ${hy - 2} Q ${hx - 13} ${hy - 12} ${hx - 6} ${hy - 22} Z`} fill={g} stroke={rim} strokeWidth={rimW * 0.8} />
            <path d={`M ${hx - 7} ${hy - 22} Q ${hx} ${hy - 33} ${hx + 7} ${hy - 22} Z`} fill={tone(g, 0.15)} stroke={rim} strokeWidth={rimW * 0.6} />
            <circle cx={hx} cy={hy - 31} r={2} fill={tone(g, 0.25)} />
            <path d={`M ${hx - 10} ${hy - 10} Q ${hx} ${hy - 7} ${hx + 10} ${hy - 10}`} stroke={tone(g, -0.3)} strokeWidth={1} fill="none" />
          </g>
        );
      }
      case "purse":
        return (
          <g>
            <path d={`M ${hx - 3} ${hy + 1} Q ${hx - 12} ${hy + 8} ${hx - 10} ${hy + 20} Q ${hx} ${hy + 26} ${hx + 10} ${hy + 20} Q ${hx + 12} ${hy + 8} ${hx + 3} ${hy + 1} Z`} fill={ink("#6A4A2E")} stroke={rim} strokeWidth={rimW * 0.8} />
            <path d={`M ${hx - 4} ${hy + 3} L ${hx + 4} ${hy + 3}`} stroke={ink("#3A2818")} strokeWidth={1.6} />
            <circle cx={hx + 4} cy={hy + 14} r={1.6} fill="#E0C478" opacity={0.8} />
          </g>
        );
      case "basin":
        return (
          <g>
            <path d={`M ${hx - 22} ${hy - 6} Q ${hx - 18} ${hy + 8} ${hx} ${hy + 9} Q ${hx + 18} ${hy + 8} ${hx + 22} ${hy - 6} Z`} fill={ink("#9A7448")} stroke={rim} strokeWidth={rimW} />
            <ellipse cx={hx} cy={hy - 6} rx={22} ry={4} fill={ink("#7A5634")} stroke={rim} strokeWidth={rimW * 0.7} />
            <ellipse cx={hx} cy={hy - 5.5} rx={18} ry={2.6} fill="rgba(150,190,210,0.7)" />
          </g>
        );
      case "chain":
        return (
          <g>
            <rect x={hx - 5} y={hy - 4} width={10} height={6} rx={2} fill={ink("#4A4A50")} stroke={rim} strokeWidth={rimW * 0.6} />
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse key={i} cx={hx + Math.sin(i * 0.9) * 2} cy={hy + 6 + i * 5.4} rx={i % 2 ? 1.6 : 3} ry={3.2} fill="none" stroke={ink("#6A6A72")} strokeWidth={1.4} />
            ))}
          </g>
        );
    }
    return null;
  };

  const drapeC = look.drape ? (glow > 0 ? mixHex(ink(look.drape), "#FFF6DE", glow) : ink(look.drape)) : null;
  const drapeEl = drapeC
    ? (() => {
        const upper = smooth([R([-3, -3]), R([5, 3]), R([8, 26]), Hp([12, 2]), Hp([-11, 4]), R([-11, 30]), R([-10, 4])], true, 0.35);
        const a = Hp([12, -2]);
        const b = Hp([-12, 0]);
        const lower = smooth([a, mixPt(a, low[1], 0.62), mixPt(b, low[2], 0.66), b], true, 0.3);
        const edgeC = look.drapeEdge ? ink(look.drapeEdge) : null;
        return (
          <g>
            <path d={lower} fill={drapeC} stroke={rim} strokeWidth={rimW} />
            <path d={smooth([mixPt(a, low[1], 0.2), mixPt(b, low[2], 0.5)], false)} stroke={tone(drapeC, -0.25)} strokeWidth={1.2} fill="none" />
            <path d={upper} fill={drapeC} stroke={rim} strokeWidth={rimW} />
            <path d={smooth([R([-6, 6]), R([0, 24]), Hp([8, 0])], false)} stroke={tone(drapeC, -0.25)} strokeWidth={1.2} fill="none" />
            {edgeC ? <path d={smooth([R([5, 3]), R([8, 26]), Hp([12, 2])], false)} stroke={edgeC} strokeWidth={3} fill="none" /> : null}
            {edgeC ? <path d={smooth([mixPt(a, low[1], 0.62), mixPt(b, low[2], 0.66)], false)} stroke={edgeC} strokeWidth={3} fill="none" /> : null}
          </g>
        );
      })()
    : null;

  const armorC = look.armor ? ink(typeof look.armor === "string" ? look.armor : "#8A7448") : null;
  const armorEl = armorC
    ? (() => {
        const cuirass = smooth([R([7, 2]), R([10, 18]), Hp([10, -4]), Hp([-11, -2]), R([-10, 8]), R([-6, 1])], true, 0.4);
        const rows: React.ReactNode[] = [];
        for (let i = 0; i < 6; i++) {
          const t = (i + 0.5) / 6;
          for (let j = -2; j <= 2; j++) {
            const c = mixPt(R([j * 3.6, 6]), Hp([j * 3.8, -4]), t);
            rows.push(<path key={`${i}${j}`} d={`M ${c[0] - 2.6} ${c[1] - 1} Q ${c[0]} ${c[1] + 2.6} ${c[0] + 2.6} ${c[1] - 1}`} stroke={tone(armorC, 0.35)} strokeWidth={1} fill="none" />);
          }
        }
        return (
          <g>
            <path d={cuirass} fill={armorC} stroke={rim} strokeWidth={rimW} />
            {rows}
          </g>
        );
      })()
    : null;

  const staff = look.staff === "raised"
    ? (() => {
        const [hx, hy] = front.hd;
        const [ex, ey] = front.el;
        const L = Math.hypot(hx - ex, hy - ey) || 1;
        const ux = (hx - ex) / L;
        const uy = (hy - ey) / L;
        return <path d={`M ${hx - ux * 44} ${hy - uy * 44} L ${hx + ux * 96} ${hy + uy * 96}`} stroke={glow > 0 ? mixHex(ink("#6A4A2C"), "#FFE6B0", glow) : ink("#6A4A2C")} strokeWidth={4} fill="none" strokeLinecap="round" />;
      })()
    : look.staff
    ? (() => {
        const [hx, hy] = front.hd;
        const top: Pt = [hx + 1, hy - 34];
        const bot: Pt = [hx + 6, 0];
        const crook = look.staff === "crook" ? ` M ${top[0]} ${top[1]} Q ${top[0] - 2} ${top[1] - 16} ${top[0] + 10} ${top[1] - 16} Q ${top[0] + 18} ${top[1] - 14} ${top[0] + 16} ${top[1] - 4}` : "";
        return <path d={`M ${bot[0]} ${bot[1]} L ${top[0]} ${top[1]}${crook}`} stroke={ink("#6A4A2C")} strokeWidth={4} fill="none" strokeLinecap="round" />;
      })()
    : null;

  const limb = (p: { sh: Pt; el: Pt; hd: Pt }, color: string, hand = skin) => (
    <>
      <path d={`M ${p.sh[0]} ${p.sh[1]} L ${p.el[0]} ${p.el[1]} L ${p.hd[0]} ${p.hd[1]}`} stroke={rim} strokeWidth={10.5 + rimW * 2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <path d={`M ${p.sh[0]} ${p.sh[1]} L ${p.el[0]} ${p.el[1]} L ${p.hd[0]} ${p.hd[1]}`} stroke={color} strokeWidth={10.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={p.hd[0]} cy={p.hd[1]} r={hand === skin ? 4.2 : 5.4} fill={hand} />
    </>
  );

  if (opacity <= 0.001) return null;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -scale : scale} ${scale})`} opacity={opacity}>
      {glow > 0 ? (
        <>
          <defs>
            <radialGradient id={glowId}>
              <stop offset="0" stopColor="rgb(255,246,222)" stopOpacity={0.55 * glow} />
              <stop offset="0.5" stopColor="rgb(255,226,170)" stopOpacity={0.18 * glow} />
              <stop offset="1" stopColor="rgb(255,226,170)" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={0} cy={-90} rx={150} ry={170} fill={`url(#${glowId})`} />
        </>
      ) : null}
      {look.halo
        ? (() => {
            const a = typeof look.halo === "number" ? look.halo : 1;
            return (
              <>
                <defs>
                  <radialGradient id={haloId}>
                    <stop offset="0" stopColor="rgb(255,236,180)" stopOpacity={0.5 * a} />
                    <stop offset="0.62" stopColor="rgb(255,222,150)" stopOpacity={0.3 * a} />
                    <stop offset="1" stopColor="rgb(255,214,140)" stopOpacity={0} />
                  </radialGradient>
                </defs>
                <circle cx={Hc[0]} cy={Hc[1]} r={hr * 2.1} fill={`url(#${haloId})`} />
                <circle cx={Hc[0]} cy={Hc[1]} r={hr * 1.62} fill="none" stroke={`rgba(255,226,160,${(0.5 * a).toFixed(3)})`} strokeWidth={1.1} />
              </>
            );
          })()
        : null}
      {shadow ? <ellipse cx={rc > 0 ? -44 * rc : 0} cy={0} rx={34 + 14 * st + 10 * k + 52 * rc} ry={5} fill="rgba(0,0,0,0.35)" /> : null}
      {limb(back, robeDark, look.wrapped ? robeDark : skin)}
      {holdAt(look.hold2, back)}
      {rc >= 0.5 ? <ellipse cx={low[1][0] - 5} cy={-6} rx={6} ry={4} fill={tone(skin, -0.25)} /> : null}
      {feet && !legsShort ? <ellipse cx={fB[0] + 3} cy={fB[1]} rx={8} ry={3.2} fill={tone(skin, -0.3)} /> : null}
      {legsShort && feet ? (
        <>
          <path d={`M ${hip[0] - 4} ${hemY} L ${fB[0]} -3`} stroke={tone(skin, -0.25)} strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${hip[0] + 4} ${hemY} L ${fF[0]} -3`} stroke={skin} strokeWidth={6} strokeLinecap="round" />
        </>
      ) : null}
      {hw ? <path d={hw.back} fill={hw.color} stroke={rim} strokeWidth={rimW} /> : null}
      <path d={robeD} fill={robe} stroke={rim} strokeWidth={rimW} strokeLinejoin="round" />
      {look.hairy
        ? Array.from({ length: 28 }, (_, i) => {
            const t = 0.12 + 0.82 * (((i % 7) + 0.37 * ((i * 5) % 3)) / 7);
            const j = Math.floor(i / 7) - 1.5;
            const top = R([j * 4, 12]);
            const bot = mixPt(low[1], low[2], 0.5 + j * 0.18);
            const c = mixPt(top, bot, t);
            const ox = (((i * 7) % 5) - 2) * 1.3 + j * 2.5 * t;
            return <path key={`hr${i}`} d={`M ${c[0] + ox} ${c[1]} l ${1.6 + (i % 3)} ${4.5}`} stroke={tone(robe, 0.22)} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />;
          })
        : null}
      {look.wrapped ? (
        <>
          <defs>
            <clipPath id={wrapId}>
              <path d={robeD} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${wrapId})`}>
            {Array.from({ length: 18 }, (_, i) => (
              <line key={i} x1={-70} y1={-186 + i * 11} x2={70} y2={-166 + i * 11} stroke={tone(robe, -0.22)} strokeWidth={1.5} />
            ))}
          </g>
        </>
      ) : null}
      {drapeEl}
      {armorEl}
      {sash ? <path d={`M ${Hp([10, -8])[0]} ${Hp([10, -8])[1]} L ${Hp([-11, -6])[0]} ${Hp([-11, -6])[1]}`} stroke={sash} strokeWidth={5} strokeLinecap="round" /> : null}
      {feet && !legsShort ? <ellipse cx={fF[0] + 3} cy={fF[1]} rx={8} ry={3.2} fill={tone(skin, -0.15)} /> : null}
      <circle cx={Hc[0]} cy={Hc[1]} r={hr} fill={skin} stroke={rim} strokeWidth={rimW} />
      <path d={`M ${nose[0][0]} ${nose[0][1]} L ${nose[1][0]} ${nose[1][1]} L ${nose[2][0]} ${nose[2][1]} Z`} fill={skin} />
      {hw ? (
        <>
          <path d={smooth([[r * 0.9, -r * 0.5], [0, -r * 1.38], [-r * 1.0, -r * 0.4], [-r * 0.2, -r * 0.55]].map((p) => add(Hc, rot(p as Pt, lean + headTilt))), true, 0.5)} fill={hw.color} />
          {hw.band ? <path d={smooth([[r * 0.88, -r * 0.48], [0, -r * 0.82], [-r * 1.02, -r * 0.42]].map((p) => add(Hc, rot(p as Pt, lean + headTilt))), false)} stroke={ink("#1A1410")} strokeWidth={2.4} fill="none" /> : null}
          {"stripes" in hw && hw.stripes ? <path d={smooth([[r * 0.8, -r * 0.2], [-r * 0.6, 0], [-r * 1.2, r]].map((p) => add(Hc, rot(p as Pt, lean))), false)} stroke={ink("#2A3A6A")} strokeWidth={2} fill="none" /> : null}
          {"crown" in hw && hw.crown ? <path d={`M ${Hc[0] - r} ${Hc[1] - r * 0.7} L ${Hc[0] - r * 0.9} ${Hc[1] - r * 1.5} L ${Hc[0] - r * 0.4} ${Hc[1] - r} L ${Hc[0]} ${Hc[1] - r * 1.6} L ${Hc[0] + r * 0.4} ${Hc[1] - r} L ${Hc[0] + r * 0.9} ${Hc[1] - r * 1.5} L ${Hc[0] + r} ${Hc[1] - r * 0.7} Z`} fill="#E8C060" /> : null}
          {"helmet" in hw && hw.helmet ? <path d={smooth([[r * 1.05, -r * 0.25], [r * 0.6, -r * 1.25], [-r * 0.4, -r * 1.5], [-r * 1.2, -r * 0.75], [-r * 1.0, -r * 0.2]].map((p) => add(Hc, rot(p as Pt, lean + headTilt))), false)} stroke="rgba(230,232,240,0.55)" strokeWidth={2} fill="none" /> : null}
          {"plume" in hw && hw.plume
            ? Array.from({ length: 7 }, (_, i) => {
                const a = -60 + i * 20;
                const b = add(Hc, rot([Math.sin((a * Math.PI) / 180) * r * 1.2, -Math.cos((a * Math.PI) / 180) * r * 1.2] as Pt, lean + headTilt));
                const t = add(Hc, rot([Math.sin((a * Math.PI) / 180) * r * 2.3, -Math.cos((a * Math.PI) / 180) * r * 2.3] as Pt, lean + headTilt));
                return <line key={i} x1={b[0]} y1={b[1]} x2={t[0]} y2={t[1]} stroke={ink("#E2D6B0")} strokeWidth={3} strokeLinecap="round" />;
              })
            : null}
          {capFront()}
        </>
      ) : null}
      {look.diadem && look.head !== "crown" && look.head !== "tiara" ? (
        <>
          <path d={smooth(HT([[r * 0.96, -r * 0.42], [r * 0.1, -r * 0.86], [-r * 1.0, -r * 0.4]]), false)} stroke={typeof look.diadem === "string" ? look.diadem : "#E2B850"} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          {[[0.78, -0.6, 0.62, -0.95], [0.42, -0.78, 0.3, -1.12], [0.04, -0.86, -0.06, -1.18]].map(([a, b, c, d], i) => {
            const [p1, p2] = HT([[r * a, r * b], [r * c, r * d]]);
            return <line key={`dm${i}`} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={typeof look.diadem === "string" ? look.diadem : "#E2B850"} strokeWidth={1.8} strokeLinecap="round" />;
          })}
        </>
      ) : null}
      {look.blind
        ? (() => {
            const [e] = HT([[r * 0.5, -r * 0.14]]);
            return (
              <>
                <circle cx={e[0]} cy={e[1]} r={r * 0.38} fill="rgba(226,230,236,0.22)" />
                <ellipse cx={e[0]} cy={e[1]} rx={r * 0.23} ry={r * 0.16} fill="rgba(234,236,240,0.88)" />
              </>
            );
          })()
        : null}
      {beard && !look.wrapped ? <path d={beard} fill={beardColor} /> : null}
      {look.wrapped ? (
        <>
          <circle cx={Hc[0]} cy={Hc[1]} r={hr * 1.08} fill={tone(robe, 0.04)} stroke={rim} strokeWidth={rimW} />
          {[-0.5, 0, 0.5].map((u) => {
            const [a, b] = HT([[-r * 1.05, r * u - r * 0.2], [r * 1.05, r * u + r * 0.25]]);
            return <line key={u} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={tone(robe, -0.22)} strokeWidth={1.3} />;
          })}
        </>
      ) : null}
      {staff}
      {look.hold === "wood" ? holdAt(look.hold, front) : null}
      {limb(front, robe, look.hand ?? (look.wrapped ? tone(robe, 0.05) : skin))}
      {look.hold !== "wood" ? holdAt(look.hold, front) : null}
    </g>
  );
};

/** Walk phase helper: frames -> phase, `speed` steps per second at 30 fps. */
export const walkPhase = (f: number, speed = 1) => (f / 30) * Math.PI * 2 * speed * 0.9;

/** Common robe colours, muted earth tones that hold up under rim light. */
export const ROBES = {
  brown: "#5E4432",
  umber: "#4A3628",
  sand: "#8C7656",
  olive: "#4E5634",
  blue: "#34465E",
  indigo: "#2E3452",
  red: "#7A2E28",
  wine: "#5A2234",
  grey: "#5A5650",
  white: "#D8D0BE",
  linen: "#E2DACA",
  black: "#1E1A18",
  teal: "#2E5050",
};

export { lerp };
