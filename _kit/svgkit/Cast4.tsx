import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { Dust, Glow, GlowS, Tint } from "./Atmos";
import { Pt, add, lerp, mixPt, mod, range, rot, seg, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { Fire, Lightning, Rain, Smoke } from "./Fx";
import { useLayout } from "./layout";
import { Look, Pose, Person, ROBES } from "./Person";
import { Animal, Herd } from "./Animals";
import { Bush, Grass, Palm, Rock, Tree } from "./Plants";
import { City, Tent } from "./Props";
import { Lampstand } from "./Props3";
import { Army, BronzeAltar, Ruins, Skyline } from "./Props4";
import {
  BelIdol, BelTable, FieryFurnace, GoldenStatue, HeathenAltar, LionThrone, TarshishShip, ModinMonument, OlympianIdol, Populace, TempleMenorah, WarElephant,
  WholeStoneAltar, DenLion, AshHeap,
} from "./Props5";
import { Band, Land, LandPreset, Sky, Stage, Water, projectPt, ridgeY, useBand, useBandK, useInk, useLandGeo, useRim, useCam } from "./Stage";
import { dryGrass, lushGrass } from "./Cast";
import { BABYLONIAN, CYRUS, JEHOIACHIN, Paving, SACKCLOTH, TempleSet } from "./Cast3";

/**
 * Recurring people and places for 1–2 Maccabees, Job, Baruch, Daniel and Jonah, so every film draws them the same way.
 * Colours are fixed per character across films (Antiochus's purple with a gold diadem, Judas Maccabeus's red tunic and
 * bronze scales, Daniel's slate blue, Jonah's sea-grey green). Seleucid kings wear a diadem on bare hair; Seleucid soldiers
 * bronze crested helmets ("plume") or bronze Phrygian helmets ("cone" in bronze); Jewish fighters "helmet" or a headcloth;
 * Babylonian and Persian kings "tiara"; their officials "turban". Variants carry a suffix (JOB_AFFLICTED, DANIEL_OLD,
 * SIMON_HIGH_PRIEST). The three youths are HANANIAH, MISHAEL, AZARIAH at Daniel 1 and SHADRACH, MESHACH, ABEDNEGO at court.
 */

// ── People ──────────────────────────────────────────────────────────────────────────────

const GOLD = "#C89A40";

// 1–2 Maccabees.
/** Antiochus IV Epiphanes: royal purple, a gold diadem on bare hair, beardless as on his coins. */
export const ANTIOCHUS: Look = { robe: "#4A1E5E", head: "hair", diadem: true, sash: "#E0B050" };
export const ANTIOCHUS_ARMED: Look = { robe: "#4A1E5E", head: "plume", armor: "#C8A050", sash: "#E0B050", short: true };
/** Seleucid soldiers: bronze Phrygian helmets (the "cone" head in bronze, distinct from Assyria's iron grey), bronze scales,
 *  crimson/plum/ochre tunics, long spears and round shields. Their commanders (NICANOR, LYSIAS, ANTIOCHUS_ARMED) wear the
 *  crested "plume" helmet. */
export const SELEUCID = (i = 0): Look => ({
  robe: ["#7A2A22", "#5A2A44", "#7A4A22"][i % 3],
  head: "cone",
  cap: "#A8803E",
  armor: "#9A7A44",
  short: true,
  beard: i % 2 === 0,
  hold: i % 3 === 2 ? "shield" : "spear",
});
export const NICANOR: Look = { robe: "#3A2A5A", head: "plume", armor: "#B8963E", sash: GOLD, beard: true, short: true, hold: "sword" };
export const LYSIAS: Look = { robe: "#5A3A1E", head: "plume", armor: "#9A8A6A", sash: GOLD, beard: true, short: true };
/** Heliodorus, the king's chancellor: Greek court dress, deep teal, beardless. */
export const HELIODORUS: Look = { robe: "#1E4A4A", head: "hair", sash: GOLD };
/** Mattathias, the old priest of Modin: unbleached linen, a brown village headcloth, a white beard and staff. */
export const MATTATHIAS: Look = { robe: "#D2C6AE", head: "cloth", mantle: "#5A4A3A", sash: "#2E3E6A", beard: "white", staff: "staff" };
/** Judas Maccabeus: a red tunic, bronze scale armour, an iron helmet, a sword. JUDAS_MAC_BARE without the helmet. */
export const JUDAS_MAC: Look = { robe: "#8A3424", head: "helmet", armor: "#A8884A", sash: GOLD, beard: true, short: true, hold: "sword" };
export const JUDAS_MAC_BARE: Look = { ...JUDAS_MAC, head: "hair", hold: null };
export const JONATHAN_MAC: Look = { robe: "#2E5A6A", head: "helmet", armor: "#8A7A5A", beard: true, short: true, hold: "spear" };
/** Jonathan made high priest by Alexander Balas: a purple robe and a gold crown (1 Maccabees 10:20). */
export const JONATHAN_HIGH_PRIEST: Look = { robe: "#5A2A6A", head: "turban", cap: "#F0EAD8", diadem: true, sash: GOLD, beard: true };
export const SIMON_MAC: Look = { robe: "#5E5A2E", head: "cloth", mantle: "#A89A6A", sash: "#8A6A3A", beard: true };
export const SIMON_MAC_ARMED: Look = { ...SIMON_MAC, head: "helmet", armor: "#8A7A5A", short: true, hold: "spear" };
/** Simon, high priest and leader, "clothed in purple and wearing gold" (1 Maccabees 14:43–44): as Jonathan, white-bearded. */
export const SIMON_HIGH_PRIEST: Look = { ...JONATHAN_HIGH_PRIEST, beard: "white" };
/** Judas's fighters: plain tunics, headcloths or helmets, swords, spears, shields and slings. */
export const MACCABEE = (i = 0): Look => ({
  robe: [ROBES.brown, ROBES.olive, ROBES.umber, ROBES.sand, "#4A3A2E"][i % 5],
  head: i % 3 === 0 ? "helmet" : "cloth",
  mantle: ["#7A6A50", "#8A7A5A", "#6A5A44"][i % 3],
  beard: i % 4 !== 3,
  short: true,
  hold: (["sword", "spear", "shield", "sling", "spear"] as const)[i % 5],
});
/** Onias the high priest: the blue robe, a white linen turban with the gold plate, white beard. */
export const ONIAS: Look = { robe: "#2E3E7A", head: "turban", cap: "#F2ECDD", diadem: "#E8C060", sash: "#8A2A22", beard: "white" };
export const ONIAS_VISION: Look = { ...ONIAS, glow: 0.5 };
/** The horseman in golden armour (2 Maccabees 3:25); put him on <Steed glory={1}>. */
export const HEAVENLY_RIDER: Look = { robe: "#9A2A22", head: "plume", armor: "#E0A830", sash: "#F6E6B0", glow: 0.25, short: true, hold: "spear" };
/** The two young men "glorious in strength, beautiful in dress" (2 Maccabees 3:26). */
export const ANGEL_YOUTH = (i = 0): Look => ({ robe: ["#F4EEDC", "#F2E8D4"][i % 2], head: "hair", mantle: "#FFF6DE", sash: i % 2 ? "#E8C060" : "#F8E8B0", glow: 0.85 });
/** Jeremiah in Judas's dream, the prophet in glory (2 Maccabees 15:13–16); give hold: "sword" for the golden sword. */
export const JEREMIAH_VISION: Look = { robe: "#E8DCC4", head: "hood", mantle: "#D8C8A0", beard: "white", glow: 0.6 };
/** Eleazar the aged scribe (2 Maccabees 6:18): deep slate robe, a white headcloth, white beard, staff. */
export const ELEAZAR_SCRIBE: Look = { robe: "#3A3A4E", head: "cloth", mantle: "#D8D0C0", sash: "#8A6A3A", beard: "white", staff: "staff" };
/** The mother of the seven brothers (2 Maccabees 7). */
export const MARTYR_MOTHER: Look = { robe: "#3A2E4A", head: "veil", mantle: "#B8A890", sash: "#9A8A6A" };
/** The seven brothers, eldest (0, bearded) to youngest (6, a boy). */
export const MARTYR_SON = (i = 0): Look => ({
  robe: ["#4A3A5A", "#3A4A5A", "#5A4A3A", "#3A5A4A", "#5A3A3A", "#4A4A3A", "#5A5A6A"][i % 7],
  head: i % 2 ? "hair" : "cloth",
  mantle: ["#8A7A6A", "#7A7A8A", "#8A806A"][i % 3],
  beard: i < 3,
  child: i === 6 ? 0.55 : i === 5 ? 0.25 : 0,
});

// Job.
export const JOB: Look = { robe: "#7A2E2E", head: "turban", cap: "#E8DCC0", sash: GOLD, beard: true };
/** Job in mourning (1:20): the robe torn, head shaved. */
export const JOB_MOURNING: Look = { robe: "#6A2A2A", head: "bare", beard: true };
/** Job afflicted on the ash heap (2:8): dark sackcloth, shaved head, an ashen skin (sores are not shown). Seat him with sit: 1. */
export const JOB_AFFLICTED: Look = { robe: "#4A4238", head: "bare", beard: true, skin: "#6E5444" };
export const JOB_RESTORED: Look = { robe: "#7A2E2E", head: "turban", cap: "#F0E8D4", sash: GOLD, beard: "white" };
export const JOB_WIFE: Look = { robe: "#4A5A5A", head: "veil", mantle: "#8A8A7A" };
export const ELIPHAZ: Look = { robe: "#2E4A6A", head: "turban", cap: "#D8CCB0", sash: "#9A7A3A", beard: "white" };
export const BILDAD: Look = { robe: "#6A5A2A", head: "cloth", mantle: "#A89A6A", sash: "#5A3A2A", beard: true };
export const ZOPHAR: Look = { robe: "#4A2E3A", head: "turban", cap: "#C8A060", sash: GOLD, beard: true };
/** Job's three friends: 0 Eliphaz the Temanite, 1 Bildad the Shuhite, 2 Zophar the Naamathite. */
export const JOB_FRIEND = (i = 0): Look => [ELIPHAZ, BILDAD, ZOPHAR][i % 3];
export const JOB_MESSENGER: Look = { robe: ROBES.sand, head: "cloth", mantle: "#8A7A5A", short: true, beard: true };
/** Jemimah, Keziah and Keren-happuch (42:14–15), no women so beautiful in all the land. */
export const JOB_DAUGHTER = (i = 0): Look => ({ robe: ["#7A3A5A", "#2E5A6A", "#8A6A2A"][i % 3], head: "veil", mantle: "#EDE4D2", sash: "#E0B050", diadem: true });

// Baruch.
export const BARUCH: Look = { robe: "#4A5A6A", head: "cloth", mantle: "#B8B0A0", sash: "#6A4A2A", beard: true, hold: "scroll" };
/** Jeconiah (Jehoiachin) in exile: Cast3 JEHOIACHIN's colours without the crown. */
export const JECONIAH: Look = { robe: JEHOIACHIN.robe, head: "hair", sash: "#9A7A3A", beard: true };
/** Jerusalem as a mother (Baruch 4–5): in mourning, then clothed in the glory that comes from God. */
export const JERUSALEM_MOURNING: Look = { robe: SACKCLOTH, head: "veil", mantle: "#4A4238" };
export const JERUSALEM_GLORY: Look = { robe: "#E8DCC4", head: "veil", mantle: "#FFF6DE", sash: "#E8C060", diadem: true, glow: 0.5 };

// Daniel.
export const DANIEL_YOUTH: Look = { robe: "#3A5A7A", head: "hair", sash: "#C8B07A" };
/** Daniel at court (Belteshazzar): slate blue with a gold sash and a cream turban. DANIEL_OLD for Daniel 6 and 14. */
export const DANIEL: Look = { robe: "#3A5A7A", head: "turban", cap: "#E8DCC0", sash: GOLD, beard: true };
export const DANIEL_OLD: Look = { ...DANIEL, beard: "white" };
export const HANANIAH: Look = { robe: "#7A3A2A", head: "hair", sash: "#C8A060" };
export const MISHAEL: Look = { robe: "#4A6A3A", head: "hair", sash: "#C8A060" };
export const AZARIAH: Look = { robe: "#5A4A7A", head: "hair", sash: "#C8A060" };
export const SHADRACH: Look = { robe: "#7A3A2A", head: "turban", cap: "#D8CCB0", sash: GOLD, beard: true };
export const MESHACH: Look = { robe: "#4A6A3A", head: "turban", cap: "#C8B890", sash: GOLD, beard: true };
export const ABEDNEGO: Look = { robe: "#5A4A7A", head: "turban", cap: "#E0D4B8", sash: GOLD, beard: true };
export const DANIEL_FRIENDS: Look[] = [HANANIAH, MISHAEL, AZARIAH];
export const DANIEL_FRIENDS_COURT: Look[] = [SHADRACH, MESHACH, ABEDNEGO];
/** The fourth man in the fire, "like a son of the gods" (Daniel 3:25). */
export const FURNACE_ANGEL: Look = { robe: "#FFF6E0", head: "hair", mantle: "#FFF6DE", sash: "#F8E0A0", glow: 1 };
/** Nebuchadnezzar (promoted from film 48): lapis-blue robe, a cream tiara, gold sash. */
export const NEBUCHADNEZZAR: Look = { robe: "#1E3462", head: "tiara", cap: "#E8DCC0", mantle: "#B8903A", sash: "#E0B050", beard: true };
/** Darius the Mede (Daniel 6), sixty-two years old: amber robe, cream tiara, white beard. */
export const DARIUS_MEDE: Look = { robe: "#7A4A1E", head: "tiara", cap: "#E8DFC8", sash: "#E0B050", beard: "white" };
/** Satraps and administrators: turbans and long court robes; every third carries a scroll. */
export const SATRAP = (i = 0): Look => ({
  robe: ["#6A3A5A", "#3A5A5A", "#7A5A2A", "#4A3A6A", "#5A2A2A"][i % 5],
  head: "turban",
  cap: ["#D8CCB0", "#C8A060", "#B8B0A0"][i % 3],
  sash: GOLD,
  beard: true,
  hold: i % 3 === 1 ? "scroll" : null,
});
/** Chaldean wise men and enchanters: tall dark caps, dark robes. */
export const CHALDEAN_SAGE = (i = 0): Look => ({ robe: ["#2A2A5A", "#4A2A2A", "#2A4A4A"][i % 3], head: "tiara", cap: "#2A2440", sash: "#C8A060", beard: "white" });
export const SUSANNA: Look = { robe: "#8A4A5A", head: "veil", mantle: "#EDE4D2", sash: "#E0B050" };
/** Susanna brought before the assembly, veiled in grief. */
export const SUSANNA_VEILED: Look = { robe: "#5A3A44", head: "veil", mantle: "#3A2E34" };
export const SUSANNA_MAID = (i = 0): Look => ({ robe: [ROBES.sand, "#7A6A50"][i % 2], head: "veil", mantle: ["#A8987A", "#8A7A68"][i % 2] });
export const SUSANNA_FATHER: Look = { robe: ROBES.brown, head: "cloth", mantle: "#A89A7A", beard: "white" };
export const SUSANNA_MOTHER: Look = { robe: "#4A5A4A", head: "veil", mantle: "#8A7A6A" };
/** Joakim, Susanna's husband, a rich and honoured man in Babylon (not the high priest Joakim of Judith). */
export const JOAKIM: Look = { robe: "#3A4A6A", head: "turban", cap: "#E0D4B8", sash: GOLD, beard: true };
/** The two wicked elders appointed judges: dark robes, dull turbans, staffs. */
export const ELDER_JUDGE = (i = 0): Look => ({ robe: ["#3A2A2A", "#2A2A3A"][i % 2], head: "turban", cap: ["#8A7A5A", "#6A6050"][i % 2], sash: "#8A6A3A", beard: "white", staff: "staff" });
/** Cyrus the Persian in Bel and the Dragon: Cast3 CYRUS. */
export const CYRUS_PERSIAN: Look = CYRUS;
/** The seventy priests of Bel: shaven heads, linen robes with coloured sashes. */
export const BEL_PRIEST = (i = 0): Look => ({ robe: ["#D8CCB0", "#C8B890", "#B8A880"][i % 3], head: "bare", sash: ["#8A2A22", "#2A3A6A", "#6A2A44"][i % 3], beard: i % 3 === 0 });
/** Habakkuk carrying pottage to the reapers (Daniel 14:33). */
export const HABAKKUK: Look = { robe: "#6A5A3A", head: "cloth", mantle: "#9A8A6A", beard: true, hold: "bowl" };
/** Babylonian palace guards: Cast3 BABYLONIAN. */
export const BABYLON_GUARD = (i = 0): Look => BABYLONIAN(i);

// Jonah.
/** Jonah: a sea-grey green robe, a pale headcloth. JONAH_BARE after the fish (no headcloth). */
export const JONAH: Look = { robe: "#4A5E5A", head: "cloth", mantle: "#9A9A84", sash: "#6A4A2A", beard: true };
export const JONAH_BARE: Look = { ...JONAH, head: "hair" };
/** The sailors of the Tarshish ship: short tunics, headcloths, caps or bare heads. */
export const MARINER = (i = 0): Look => ({
  robe: ["#7A6A4A", "#5A4A3A", "#3A4A5A", "#6A3A2A"][i % 4],
  head: (["cloth", "hair", "turban", "bare"] as const)[i % 4],
  cap: "#C8B890",
  mantle: "#9A8A6A",
  short: true,
  beard: i % 3 !== 2,
});
export const SHIP_CAPTAIN: Look = { robe: "#2E4A5A", head: "turban", cap: "#D8CCB0", sash: GOLD, beard: "white" };
/** The people of Nineveh in sackcloth, from the greatest to the least (every third a woman). */
export const NINEVITE = (i = 0): Look =>
  i % 3 === 0
    ? { robe: ["#4E4638", "#5A5040", "#463E32"][Math.floor(i / 3) % 3], head: "veil", mantle: "#3E382E" }
    : { robe: ["#4E4638", "#5A5040", "#463E32", "#524A3C"][i % 4], head: i % 4 === 1 ? "hair" : "cloth", mantle: "#4A4238", beard: true, short: i % 5 === 2 };
export const KING_NINEVEH: Look = { robe: "#6A2A2A", head: "tiara", cap: "#E6DCC6", sash: "#E0B050", beard: true };
/** The king of Nineveh risen from his throne, in sackcloth, sitting in the ashes (Jonah 3:6). */
export const KING_NINEVEH_SACK: Look = { robe: SACKCLOTH, head: "hair", beard: true };

// ── Rig helper ───────────────────────────────────────────────────────────────────────────

const dirv = (deg: number): Pt => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];

export type FigureRig = { hip: Pt; shoulder: Pt; head: Pt; headR: number; hand: Pt; elbow: Pt; hand2: Pt; elbow2: Pt; scale: number };

/**
 * Where a Person's joints land, computed exactly as Person draws them, so props can be put in a hand or on a head.
 * Returns points in the same space as the Person: give the figure's x, its ground y (gy, e.g. ridgeY(geo.near, x) in a
 * scene, or band.gy(x) inside a band), its total scale sk = s * band k (K.near for the near band when computed in a scene;
 * inside a band use s * useBand().k), the pose, look (child changes the proportions) and flip. `hand` is the front hand.
 */
export const figureRig = (x: number, gy: number, sk: number, pose: Pose = {}, look: Look = {}, flip = false): FigureRig => {
  const child = look.child ?? 0;
  const k = pose.kneel ?? 0;
  const st = pose.sit ?? 0;
  const lean = pose.lean ?? 0;
  const walking = pose.walk !== undefined;
  const ph = pose.walk ?? 0;
  const sw = walking ? Math.sin(ph) : 0;
  const bob = walking ? -Math.abs(Math.sin(ph)) * 1.8 : 0;
  const hip0 = mixPt(mixPt([0, -84], [-6, -46], k), [-6, -42], st);
  const hip: Pt = [hip0[0], hip0[1] + bob];
  const torso = 58 * (1 - 0.06 * child);
  const S = add(hip, [Math.sin((lean * Math.PI) / 180) * torso, -Math.cos((lean * Math.PI) / 180) * torso]);
  const hr = 12.5 * (1 + 0.32 * child);
  const Hc = add(S, rot([0, -(hr + 6.5)], lean + (pose.head ?? 0)));
  const swing = walking ? sw * 16 : 0;
  const a1 = pose.arm ?? [8 + swing, 14];
  const a2 = pose.arm2 ?? [-6 - swing, 10];
  const arm = (a: [number, number], off: Pt) => {
    const sh = add(S, rot(off, lean));
    const el = add(sh, dirv(a[0] + lean).map((v) => v * 29) as Pt);
    const hd = add(el, dirv(a[0] + a[1] + lean).map((v) => v * 26) as Pt);
    return { el, hd };
  };
  const fa = arm(a1, [3, 3]);
  const ba = arm(a2, [-3, 3]);
  const sc = sk * (1 - 0.36 * child);
  const W = (q: Pt): Pt => [x + (flip ? -1 : 1) * q[0] * sc, gy + q[1] * sc];
  return { hip: W(hip), shoulder: W(S), head: W(Hc), headR: hr * sc, hand: W(fa.hd), elbow: W(fa.el), hand2: W(ba.hd), elbow2: W(ba.el), scale: sc };
};

// ── Places ──────────────────────────────────────────────────────────────────────────────

type CamT = ReturnType<typeof useCam>;
type SkyP = React.ComponentProps<typeof Sky>;
type SetP = { cam: CamT; seed: string; tod?: number; near?: React.ReactNode; mid?: React.ReactNode; far?: React.ReactNode; front?: React.ReactNode; fx?: React.ReactNode; sky?: SkyP; storm?: number };

/** A gatehouse in the temple court wall (monumental scale, 128 wide, 86 tall); `burnt` 0..1 chars it, its doors fallen. */
const CourtGate: React.FC<{ x: number; burnt?: number; seed: string }> = ({ x, burnt = 0, seed }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const k = band.k;
  const gy = band.gy(x);
  const stone = ink(mixHex("#8E7C60", "#4A3E32", burnt * 0.4));
  const cedar = ink("#5E3C22");
  const charC = ink("#1A1410");
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <rect x={-64} y={-86} width={128} height={88} fill={stone} stroke={rim(0.9)} strokeWidth={1.2} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={-64 + i * 27} y={-96} width={16} height={11} fill={stone} />
      ))}
      {[1, 2, 3].map((r) => (
        <line key={`c${r}`} x1={-64} y1={-r * 22} x2={64} y2={-r * 22} stroke="rgba(40,30,20,0.3)" strokeWidth={1} />
      ))}
      <path d="M -24 2 L -24 -46 Q 0 -64 24 -46 L 24 2 Z" fill="#0E0A08" />
      {burnt > 0 ? <ellipse cx={0} cy={-62} rx={40} ry={26} fill={`rgba(16,12,10,${(0.55 * burnt).toFixed(3)})`} /> : null}
      {burnt < 1 ? (
        <g opacity={1 - burnt}>
          <path d="M -24 2 L -24 -46 Q -12 -58 0 -60 L 0 2 Z" fill={cedar} stroke={rim(0.6)} strokeWidth={0.8} />
          <path d="M 24 2 L 24 -46 Q 12 -58 0 -60 L 0 2 Z" fill={tone(cedar, -0.08)} stroke={rim(0.6)} strokeWidth={0.8} />
          {[-12, 12].map((dx) => [-40, -24, -8].map((dy) => <circle key={`${dx}${dy}`} cx={dx} cy={dy} r={1.6} fill={ink("#B8863A")} />))}
        </g>
      ) : null}
      {burnt > 0 ? (
        <g opacity={burnt}>
          <path d="M -24 2 L -26 -40 L -14 -48 L -6 -30 L -10 2 Z" fill={charC} />
          <path d="M 4 2 L 40 -6 L 44 2 Z" fill={charC} transform="rotate(4 20 0)" />
          <path d="M 8 -2 L 26 -14 L 30 -2 Z" fill={tone(charC, 0.1)} />
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={i} cx={range(`${seed}e${i}`, -20, 36)} cy={-range(`${seed}y${i}`, 1, 8)} r={1.4} fill={`rgba(255,${120 + 60 * Math.sin(f * 0.2 + i)},40,${(0.5 * burnt).toFixed(3)})`} />
          ))}
        </g>
      ) : null}
    </g>
  );
};

/**
 * The Jerusalem temple court in the Maccabean age, built on Cast3 TempleSet `second` (the plainer second temple; the
 * same coordinates: temple at tx in the middle band, scale ts; the paved court and altar at ax in the near band, people
 * there at Person s ≈ 1). Desecrated and cleansed states (1 Maccabees 1:54, 4:36–59):
 *  desolate 0..1 grows shrubs in the courts, chars the court gate (`gate` overrides), dims and dusts the light;
 *  abomination 0..1 sets the heathen altar on the altar and the statue of Olympian Zeus beside it;
 *  altar "bronze" (the old altar) | "stone" (the new altar of whole stones) | "none"; fire 0..1 lights it;
 *  menorah 0..1 opens the doors and lights the golden lampstand inside the house (`open` overrides the doors);
 *  dedication 0..1 hangs golden crowns and shields on the porch (4:57).
 * The lampstand stands on the temple's podium at screen x = tx, y = ridgeY(geo.mid, tx) - 36 * ts * K.mid.
 * The altar fire base is at ridgeY(geo.near, ax) - (140 for bronze, 150 for stone) * as * K.near.
 */
export const MaccabeanTemple: React.FC<
  SetP & { tx?: number; ts?: number; ax?: number; as?: number; altar?: "bronze" | "stone" | "none"; fire?: number; desolate?: number; abomination?: number; gate?: number; menorah?: number; open?: number; dedication?: number; preset?: LandPreset }
> = ({ cam, seed, tod = 0.42, near, mid, far, front, fx, sky, storm = 0, tx, ts, ax, as, altar = "bronze", fire = 0, desolate = 0, abomination = 0, gate, menorah = 0, open, dedication = 0, preset = "hills" }) => {
  const { p, W, H } = useLayout();
  const K = useBandK();
  const geo = useLandGeo(preset, seed);
  const x = tx ?? p(1150, 600);
  const s = ts ?? p(0.95, 0.95);
  const ax0 = ax ?? p(470, 230);
  const as0 = as ?? p(0.8, 0.75);
  const half = 0.6 * 560 * s * K.mid + 40;
  const gx = (x - half) * 0.5;
  const op = open ?? Math.min(1, menorah * 2.5);
  const base = ridgeY(geo.mid, x);
  const podium = base - 36 * s * K.mid;
  const altarTop = ridgeY(geo.near, ax0) - (altar === "stone" ? 150 : 148) * as0 * K.near;
  const nWeedM = Math.round(desolate * 16);
  const nWeedN = Math.round(desolate * 10);
  const weedsMid = Array.from({ length: nWeedM }, (_, i) => {
    const wx = range(`${seed}wm${i}`, -100, W + 100);
    if (Math.abs(wx - x) < half * 0.5) return null;
    return <Bush key={`wm${i}`} x={wx} s={range(`${seed}ws${i}`, 0.35, 0.6)} seed={`${seed}wb${i}`} color={i % 2 ? "#4A5A2E" : "#5A5A32"} tangle={i % 3 === 0} />;
  });
  const weedsNear = Array.from({ length: nWeedN }, (_, i) => {
    const t = (i + 0.5) / Math.max(1, nWeedN);
    const wx = range(`${seed}wn${i}`, -60, W + 60);
    if (Math.abs(wx - ax0) < p(160, 110)) return null;
    return <Bush key={`wn${i}`} x={wx} s={range(`${seed}wns${i}`, 0.7, 1.1) * (0.6 + 0.4 * t)} seed={`${seed}wnb${i}`} color={i % 2 ? "#4E5A30" : "#5E5E36"} tangle={i % 2 === 0} />;
  });
  const crownsY = base - 290 * s * K.mid;
  const lampQ = projectPt(cam, W, H, x, podium - 180 * s * K.mid, 0.4);
  const altarQ = projectPt(cam, W, H, ax0, altarTop, 0.8);
  return (
    <TempleSet
      cam={cam}
      seed={seed}
      tod={tod}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 + 0.3 * desolate }}
      storm={storm}
      tx={x}
      ts={s}
      altar={false}
      second
      glow={menorah * 0.5 + dedication * 0.15}
      open={op}
      preset={preset}
      far={far}
      mid={
        <>
          <CourtGate x={gx} burnt={gate ?? desolate} seed={`${seed}gt`} />
          {weedsMid}
          {menorah > 0 && op > 0.2 ? (
            <g opacity={Math.min(1, (op - 0.2) * 2)}>
              <TempleMenorah x={x} y={podium} s={s * 0.9} lit={menorah} />
            </g>
          ) : null}
          {dedication > 0
            ? [-0.82, -0.42, 0, 0.42, 0.82].map((u, i) => {
                const cx = x + u * 150 * s * K.mid;
                const r = 13 * s * K.mid;
                const a = seg(dedication, i * 0.12, i * 0.12 + 0.5);
                return i % 2 ? (
                  <g key={`dd${i}`} opacity={a}>
                    <circle cx={cx} cy={crownsY} r={r} fill="#C8963A" stroke="rgba(255,236,190,0.8)" strokeWidth={1.2} />
                    <circle cx={cx} cy={crownsY} r={r * 0.35} fill="#F2D27A" />
                  </g>
                ) : (
                  <g key={`dd${i}`} opacity={a}>
                    <circle cx={cx} cy={crownsY} r={r} fill="none" stroke="#E2B850" strokeWidth={r * 0.4} />
                    {Array.from({ length: 8 }, (_, j) => (
                      <ellipse key={j} cx={cx + Math.cos((j / 8) * Math.PI * 2) * r} cy={crownsY + Math.sin((j / 8) * Math.PI * 2) * r} rx={r * 0.32} ry={r * 0.18} fill="#F2D27A" transform={`rotate(${(j / 8) * 360 + 90} ${cx + Math.cos((j / 8) * Math.PI * 2) * r} ${crownsY + Math.sin((j / 8) * Math.PI * 2) * r})`} />
                    ))}
                  </g>
                );
              })
            : null}
          {mid}
        </>
      }
      near={
        <>
          {altar === "bronze" ? <BronzeAltar x={ax0} s={as0} fire={fire} seed={`${seed}ba`} /> : null}
          {altar === "stone" ? <WholeStoneAltar x={ax0} s={as0} fire={fire} seed={`${seed}sa`} /> : null}
          {abomination > 0 && altar !== "none" ? <HeathenAltar x={ax0} y={altarTop} s={as0 * 0.75} p={abomination} fire={fire > 0 ? 0 : 0.6 * abomination} seed={`${seed}ha`} /> : null}
          {abomination > 0 ? <OlympianIdol x={ax0 + p(230, 170) * as0} s={as0 * 1.15} p={abomination} /> : null}
          {desolate > 0
            ? Array.from({ length: Math.round(desolate * 6) }, (_, i) => <Rock key={`rk${i}`} x={range(`${seed}rx${i}`, p(80, 40), W - p(80, 40))} s={range(`${seed}rs${i}`, 0.5, 0.9)} seed={`${seed}rk${i}`} color="#8A7C66" />)
            : null}
          {weedsNear}
          {desolate > 0.3 ? <Grass x0={-300} x1={W + 300} n={Math.round(60 * desolate)} seed={`${seed}gr`} h={[10, 26]} color={["#5A5A30", "#8A8450"]} /> : null}
          {near}
        </>
      }
      front={front}
      fx={
        <>
          {desolate > 0 ? <Tint color="#5A4E3E" opacity={0.18 * desolate} blend="soft-light" /> : null}
          {menorah > 0 ? <Glow x={lampQ.x} y={lampQ.y} size={p(520, 480)} color="255,200,120" opacity={0.35 * menorah * op} /> : null}
          {fire > 0 && altar !== "none" ? <Smoke x={altarQ.x} y={altarQ.y - 40} s={p(1.4, 1.3)} n={10} life={170} rise={1.2} drift={0.25} color="200,190,180" opacity={0.3 * fire} seed={`${seed}sm`} /> : null}
          {fx}
        </>
      }
    />
  );
};

/** Flat-roofed houses climbing a hill in the middle band (monumental scale), centred at vx, hill w wide and hh high. */
const HillVillage: React.FC<{ vx: number; w: number; hh: number; seed: string; lit?: number; n?: number; summit?: React.ReactNode }> = ({ vx, w, hh, seed, lit = 0, n = 22, summit }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const k = band.k;
  const hill = (xx: number) => {
    const u = (xx - vx) / (w / 2);
    return Math.abs(u) >= 1 ? 0 : -hh * Math.pow(1 - u * u, 1.3);
  };
  const pts: string[] = [];
  for (let xx = vx - w / 2 - 20; xx <= vx + w / 2 + 20; xx += 12) pts.push(`${pts.length ? "L" : "M"} ${xx} ${(band.gy(xx) + hill(xx)).toFixed(1)}`);
  const earth = ink("#6A6448");
  const wall = ink("#B8A882");
  const houses = Array.from({ length: n }, (_, i) => {
    const hx = vx + range(`${seed}x${i}`, -0.4, 0.4) * w;
    const hb = band.gy(hx) + hill(hx) * range(`${seed}m${i}`, 0.72, 0.98) + 6;
    return { hx, hb, hw: range(`${seed}w${i}`, 34, 58) * k, hh2: range(`${seed}h${i}`, 26, 44) * k, sh: random(`${seed}c${i}`), wl: random(`${seed}l${i}`) };
  }).sort((a, b) => a.hb - b.hb);
  const top = vx + w * 0.04;
  return (
    <g>
      <path d={`${pts.join(" ")} L ${vx + w / 2 + 20} ${band.gy(vx + w / 2) + 40} L ${vx - w / 2 - 20} ${band.gy(vx - w / 2) + 40} Z`} fill={earth} stroke={rim(0.6)} strokeWidth={1.2} />
      {Array.from({ length: 4 }, (_, r) => {
        const yy = (r + 1) / 5;
        const tp: string[] = [];
        for (let xx = vx - w / 2; xx <= vx + w / 2; xx += 14) {
          const hv = hill(xx);
          if (hv < -hh * yy * 0.9) tp.push(`${tp.length ? "L" : "M"} ${xx} ${(band.gy(xx) - hh * yy).toFixed(1)}`);
        }
        return tp.length > 1 ? <path key={r} d={tp.join(" ")} stroke={tone(earth, 0.15)} strokeWidth={2} fill="none" opacity={0.6} /> : null;
      })}
      {summit ? <g transform={`translate(${top} ${band.gy(top) + hill(top) + 4})`}>{summit}</g> : null}
      {houses.map((q, i) => (
        <g key={i}>
          <rect x={q.hx - q.hw / 2} y={q.hb - q.hh2} width={q.hw} height={q.hh2 + 30 * k} fill={mixHex(wall, tone(wall, -0.3), q.sh)} stroke={rim(0.5)} strokeWidth={1} />
          <rect x={q.hx - q.hw / 2 - 2} y={q.hb - q.hh2 - 4} width={q.hw + 4} height={5} fill={tone(wall, -0.25)} />
          <rect x={q.hx - 4 * k} y={q.hb - q.hh2 + 9 * k} width={8 * k} height={9 * k} fill={lit > 0 ? `rgba(255,190,100,${(0.3 + 0.6 * lit * q.wl).toFixed(3)})` : tone(wall, -0.55)} />
        </g>
      ))}
    </g>
  );
};

/**
 * Modin, the hill village of the Maccabees (1 Maccabees 2), in the Judean hills: flat-roofed houses on a hill in the middle
 * band at vx, olive terraces, olive trees in the near band where people stand (Person s ≈ 1). altar "pagan" sets the king's
 * Greek altar at ax (the officers' sacrifice, 2:15–25), "stone" a plain stone altar, "none"; fire 0..1.
 * monument 0..1 raises Simon's monument with seven pyramids on the hilltop (13:27–30); lit lights the windows.
 */
export const ModinSet: React.FC<SetP & { vx?: number; vw?: number; altar?: "pagan" | "stone" | "none"; ax?: number; fire?: number; monument?: number; lit?: number; preset?: LandPreset }> = ({
  cam,
  seed,
  tod = 0.4,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  vx,
  vw,
  altar = "none",
  ax,
  fire = 0,
  monument = 0,
  lit,
  preset = "hills",
}) => {
  const { p, W } = useLayout();
  const night = tod > 0.74 || tod < 0.22;
  const x = vx ?? p(1240, 640);
  const w = vw ?? p(1000, 820);
  const ax0 = ax ?? p(820, 420);
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1700, 940), y: p(340, 780) }, clouds: 0.35, stars: night ? 1 : 0 }}
      far={far}
      mid={
        <>
          <HillVillage vx={x} w={w} hh={p(150, 150)} seed={`${seed}v`} lit={lit ?? (night ? 0.7 : 0)} summit={monument > 0 ? <ModinMonument x={0} y={0} s={p(0.6, 0.55)} built={monument} /> : null} />
          {Array.from({ length: p(6, 3) }, (_, i) => (
            <Tree key={i} x={x - w * 0.55 - i * p(120, 110)} s={0.42} kind="olive" seed={`${seed}ot${i}`} />
          ))}
          {mid}
        </>
      }
      near={
        <>
          <Tree x={p(110, 40)} s={p(1.15, 1)} kind="olive" seed={`${seed}t1`} />
          <Tree x={W - p(140, 60)} s={p(1.05, 0.95)} kind="olive" seed={`${seed}t2`} flip />
          {altar === "pagan" ? <HeathenAltar x={ax0} s={1} fire={fire} seed={`${seed}ha`} /> : null}
          {altar === "stone" ? <WholeStoneAltar x={ax0} s={0.6} fire={fire} seed={`${seed}sa`} /> : null}
          {near}
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/**
 * A battle in the Judean hills (Beth-zechariah, Emmaus, Adasa): the Seleucid army drawn up on the right of the middle band
 * facing left (crested bronze helmets, gold and bronze shields), with `elephants` war elephants among the ranks and towers on
 * their backs; Judas's smaller force on the left (`jews` 0..1). People who speak stand on the near band (Person s ≈ 1).
 *  advance 0..1 marches the Seleucids forward; rout 0..1 turns them and drives them off to the right;
 *  gleam 0..1 flashes the sun on their shields ("the mountains glistened", 6:39); dust 0..1 raises a dust cloud.
 */
export const HillsBattleSet: React.FC<SetP & { enemy?: number; advance?: number; rout?: number; elephants?: number; gleam?: number; jews?: number; dust?: number; preset?: LandPreset }> = ({
  cam,
  seed,
  tod = 0.42,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  enemy = 1,
  advance = 0,
  rout = 0,
  elephants = 3,
  gleam = 0,
  jews = 1,
  dust = 0,
  preset = "hills",
}) => {
  const { p, W } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const geo = useLandGeo(preset, seed);
  const x0 = p(820, 470);
  const x1 = W + p(80, 60);
  const dx = -advance * p(240, 140) + rout * p(620, 420);
  const fleeing = rout > 0.15;
  const marching = advance > 0 && advance < 1 ? 1 : fleeing ? 1 : 0;
  const eleS = 0.3;
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1600, 900), y: p(300, 720) }, clouds: 0.35 }}
      far={
        <>
          {Array.from({ length: p(6, 3) }, (_, i) => (
            <Tent key={i} x={W - p(80, 60) - i * p(70, 60)} s={0.45} w={130} light={0.15} color="#7A6A52" />
          ))}
          {far}
        </>
      }
      mid={
        <>
          <Army x0={p(-60, -60)} x1={p(560, 320)} n={p(14, 8)} rows={2} seed={`${seed}j`} helm="round" tint="#5A4A3A" metal="#8A8070" p={jews} banners={1} bows={false} />
          <Army x0={x0} x1={x1} n={p(28, 14)} rows={3} seed={`${seed}s`} helm="plume" tint="#7A2A22" metal="#C8A050" p={enemy} march={marching} dx={dx} flip={!fleeing} banners={p(3, 2)} />
          {Array.from({ length: elephants }, (_, i) => {
            const t = (i + 0.6) / (elephants + 0.4);
            const ex = lerp(x0 + p(80, 50), x1 - p(120, 90), t) + dx;
            return enemy > t ? <WarElephant key={i} x={ex} s={eleS} flip={!fleeing} walk={marching ? f * 0.16 + i : undefined} trunk={i % 2 ? 0.2 : 0} /> : null;
          })}
          {gleam > 0
            ? Array.from({ length: 22 }, (_, i) => {
                const gxp = lerp(x0, x1, random(`${seed}gl${i}`)) + dx;
                const tw = Math.max(0, Math.sin(f * 0.18 + i * 2.7));
                const gyp = ridgeY(geo.mid, gxp) - range(`${seed}gy${i}`, 14, 36) * K.mid;
                return <GlowS key={`g${i}`} x={gxp} y={gyp} r={18 * tw + 4} color="255,240,200" opacity={gleam * tw} />;
              })
            : null}
          {mid}
        </>
      }
      near={
        <>
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={
        <>
          {dust > 0 ? <Smoke x={p(1300, 760)} y={p(640, 1120)} s={p(3.4, 2.8)} n={12} life={200} rise={0.5} drift={rout > 0 ? 0.9 : -0.4} low color="180,160,130" opacity={0.45 * dust} seed={`${seed}du`} /> : null}
          {fx}
        </>
      }
    />
  );
};

/** Job's great stone house (Person scale): two storeys with a roof room and parapet, a walled courtyard to the left with a
 *  gate. About 420 wide (+260 courtyard), roof at -300. `lit` warms the windows. */
const StoneHouse: React.FC<{ x: number; s?: number; lit?: number; seed: string }> = ({ x, s = 1, lit = 0, seed }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = band.gy(x);
  const k = s * band.k;
  const st = ink("#B8A888");
  const win = (a: number) => (lit > 0 ? `rgba(255,190,100,${(0.35 + 0.6 * lit * a).toFixed(3)})` : tone(st, -0.6));
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <ellipse cx={-80} cy={0} rx={380} ry={9} fill="rgba(0,0,0,0.3)" />
      <rect x={-470} y={-120} width={260} height={120} fill={tone(st, -0.08)} stroke={rim(0.8)} strokeWidth={1.2} />
      <rect x={-474} y={-128} width={268} height={10} fill={tone(st, -0.2)} />
      <path d="M -380 0 L -380 -80 Q -350 -100 -320 -80 L -320 0 Z" fill={tone(st, -0.55)} />
      <rect x={-210} y={-300} width={420} height={300} fill={st} stroke={rim(1)} strokeWidth={1.4} />
      {[1, 2, 3, 4, 5].map((r) => (
        <line key={r} x1={-210} y1={-r * 50} x2={210} y2={-r * 50} stroke={tone(st, -0.2)} strokeWidth={1} opacity={0.6} />
      ))}
      <rect x={-214} y={-312} width={428} height={14} fill={tone(st, -0.18)} stroke={rim(0.8)} strokeWidth={1} />
      <rect x={20} y={-400} width={170} height={100} fill={tone(st, 0.05)} stroke={rim(0.9)} strokeWidth={1.2} />
      <rect x={16} y={-410} width={178} height={12} fill={tone(st, -0.18)} />
      <rect x={70} y={-372} width={26} height={34} fill={win(1)} />
      <rect x={120} y={-372} width={26} height={34} fill={win(0.7)} />
      <path d="M -60 0 L -60 -120 Q 0 -150 60 -120 L 60 0 Z" fill={tone(st, -0.6)} stroke={rim(0.7)} strokeWidth={1.2} />
      {[-160, -110, 110, 160].map((wx, i) => (
        <rect key={wx} x={wx - 14} y={-250} width={28} height={40} fill={win(random(`${seed}w${i}`))} />
      ))}
      {[-160, 160].map((wx, i) => (
        <rect key={`l${wx}`} x={wx - 12} y={-130} width={24} height={30} fill={win(random(`${seed}v${i}`))} />
      ))}
    </g>
  );
};

/**
 * The land of Uz (Job 1): a pastoral vista of great wealth. Job's stone house with its courtyard in the middle band at hx
 * (scale hs), black goat-hair tents and a camel train in the middle band, a yoke of oxen ploughing, donkeys and distant
 * flocks in the far band, and flocks of sheep and goats in the near band where people stand (Person s ≈ 1). wealth 0..1 scales the herds (set 1 again after the restoration); fallen 0..1 brings the
 * house down to ruins and dust (1:19, shown from afar); lit lights the windows (the sons' feast).
 */
export const UzSet: React.FC<SetP & { wealth?: number; hx?: number; hs?: number; fallen?: number; lit?: number; preset?: LandPreset }> = ({
  cam,
  seed,
  tod = 0.4,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  wealth = 1,
  hx,
  hs,
  fallen = 0,
  lit,
  preset = "plain",
}) => {
  const { p, W, v } = useLayout();
  const f = useCurrentFrame();
  const night = tod > 0.74 || tod < 0.22;
  const hxx = hx ?? p(1500, 860);
  const hss = hs ?? p(0.62, 0.5);
  const camels = Math.round(1 + p(4, 2) * wealth);
  const sheep = Math.round(3 + p(7, 3) * wealth);
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#76744A", near: "#5E6238", front: "#2E3418" }}
      sky={sky ?? { sun: { x: p(1700, 950), y: p(330, 760) }, clouds: 0.3, stars: night ? 1 : 0 }}
      far={
        <>
          {wealth > 0.2 ? <Herd kind="sheep" n={Math.round(p(10, 6) * wealth)} x0={p(160, 60)} x1={p(760, 420)} s={0.45} seed={`${seed}fh`} /> : null}
          {wealth > 0.3 ? (
            <g>
              <Plough x={W * 0.5 - 50} s={0.55} />
              <Animal kind="cow" x={W * 0.5} s={0.85} walk={f * 0.1} tint="#6A5040" />
              <Animal kind="cow" x={W * 0.5 + 18} s={0.85} walk={f * 0.1 + 1.2} tint="#7A6048" />
            </g>
          ) : null}
          {wealth > 0.5 ? <Herd kind="donkey" n={p(4, 2)} x0={W * 0.6} x1={W * p(0.7, 0.72)} s={0.8} seed={`${seed}dn`} /> : null}
          {!v
            ? Array.from({ length: 3 }, (_, i) => <Tent key={i} x={W * 0.78 + i * 110} s={0.55} w={150} light={night ? 0.7 : 0.2} />)
            : null}
          {far}
        </>
      }
      mid={
        <>
          {fallen < 0.5 ? <StoneHouse x={hxx} s={hss} lit={lit ?? (night ? 0.8 : 0)} seed={`${seed}h`} /> : null}
          {fallen > 0 ? <g opacity={Math.min(1, fallen * 2)}><Ruins x={hxx} s={hss * 1.3} w={560} seed={`${seed}r`} smoke={fallen} /></g> : null}
          <Palm x={hxx + p(300, 230) * hss} s={0.9} seed={`${seed}p1`} />
          <Palm x={hxx - p(560, 420) * hss} s={0.75} lean={-0.3} seed={`${seed}p2`} />
          {Array.from({ length: p(2, 1) }, (_, i) => (
            <Tent key={i} x={p(110, 90) + i * p(230, 200)} s={1.1} w={210} light={night ? 0.7 : 0.25} />
          ))}
          {Array.from({ length: camels }, (_, i) => (
            <Animal key={`c${i}`} kind="camel" x={p(560, 330) + i * p(105, 95)} s={1.7} walk={f * 0.12 + i * 1.1} />
          ))}
          {mid}
        </>
      }
      near={
        <>
          {wealth > 0 ? <Herd kind="sheep" n={sheep} x0={p(40, 20)} x1={p(760, 420)} s={1.45} seed={`${seed}sh`} /> : null}
          {wealth > 0.4 ? <Herd kind="goat" n={3} x0={W - p(420, 260)} x1={W - p(80, 40)} s={1.5} seed={`${seed}gt`} /> : null}
          {near}
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/** A simple wooden plough behind an ox team (Person scale, about 150 long, handle top at -110). */
const Plough: React.FC<{ x: number; s?: number }> = ({ x, s = 1 }) => {
  const band = useBand();
  const ink = useInk();
  const gy = band.gy(x);
  const k = s * band.k;
  const wood = ink("#5A4430");
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <path d="M -60 -110 L -30 -6 L 30 -2 M 30 -2 L 150 -70" stroke={wood} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M -36 -10 L -10 4 L -40 2 Z" fill={ink("#6A6A6E")} />
    </g>
  );
};

/**
 * Job on the ash heap outside the town at dusk (Job 2:8–13): an AshHeap at jx in the near band (its `seat` slot sits a
 * Person on top: a Person at x = 0, y = 0 with sit: 1), a dead tree, the town wall far off with lit windows, a low sun.
 * Friends sit on the ground around (Person sit: 1 on the near band). ember 0..1 and smoke on the heap.
 */
export const AshHeapSet: React.FC<SetP & { jx?: number; seat?: React.ReactNode; ember?: number; town?: boolean; preset?: LandPreset }> = ({
  cam,
  seed,
  tod = 0.73,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  jx,
  seat,
  ember = 0.3,
  town = true,
  preset = "desert",
}) => {
  const { p, W } = useLayout();
  const x = jx ?? p(960, 540);
  const dusk = tod > 0.66;
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#6E5A44", near: "#54443A", front: "#2A221C" }}
      sky={sky ?? { sun: { x: p(360, 200), y: p(560, 1010), a: dusk ? 0.8 : 1 }, clouds: 0.3, stars: tod > 0.8 ? 1 : 0 }}
      far={far}
      mid={
        <>
          {town ? <City x={p(1480, 800)} s={p(0.9, 0.8)} w={360} lit={dusk ? 0.7 : 0} seed={`${seed}c`} color="#8A7458" /> : null}
          {mid}
        </>
      }
      near={
        <>
          <Tree x={W - p(260, 110)} s={p(1.1, 0.95)} kind="dead" seed={`${seed}dt`} flip />
          <Rock x={p(220, 90)} s={1.1} seed={`${seed}r1`} color="#6A6058" />
          <AshHeap x={x} s={p(1.05, 1)} seat={seat} ember={ember} seed={`${seed}ah`} />
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={
        <>
          {dusk ? <Tint color="#FF8A4A" opacity={0.08} blend="soft-light" /> : null}
          {fx}
        </>
      }
    />
  );
};

/** A tall bronze tripod brazier with a bowl of fire for palace and temple interiors (Person scale: bowl rim at -172). */
const BrazierStand: React.FC<{ x: number; s?: number; fire?: number; seed: string }> = ({ x, s = 1, fire = 1, seed }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const gy = band.gy(x);
  const k = s * band.k;
  const br = ink("#9A7A3A");
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <ellipse cx={0} cy={0} rx={34} ry={5} fill="rgba(0,0,0,0.35)" />
      <path d="M -26 0 L -5 -118 M 26 0 L 5 -118 M 0 0 L 0 -118" stroke={br} strokeWidth={4} strokeLinecap="round" />
      <rect x={-7} y={-150} width={14} height={36} rx={3} fill={br} stroke={rim(0.7)} strokeWidth={1} />
      <path d="M -36 -170 Q 0 -134 36 -170 Z" fill={br} stroke={rim(0.8)} strokeWidth={1.2} />
      <rect x={-39} y={-175} width={78} height={7} rx={3} fill={tone(br, 0.22)} />
      {fire > 0 ? <Fire x={0} y={-172} s={0.75 * fire} n={3} w={20} seed={seed} /> : null}
    </g>
  );
};

/** A striding lion of glazed brick (Babylon's Processional Way), facing right, ~76 wide at sc = 1. */
const brickLion = (lx: number, ly: number, sc: number, col: string, key: string, flip = false) => (
  <g key={key} transform={`translate(${lx} ${ly}) scale(${flip ? -sc : sc} ${sc})`}>
    <path d="M -36 0 L -32 -18 Q -36 -28 -24 -30 L 12 -32 Q 20 -46 34 -42 Q 44 -34 40 -24 L 36 -18 L 38 0 L 31 0 L 28 -13 L 16 -13 L 14 0 L 7 0 L 5 -15 L -16 -15 L -18 0 L -25 0 L -25 -13 Q -40 -14 -46 -28 Q -40 -18 -31 -20 L -29 0 Z" fill={col} />
    <path d="M 22 -44 Q 14 -30 22 -18 Q 30 -26 38 -30 Z" fill={tone(col, -0.25)} />
  </g>
);

/**
 * A Babylonian palace hall (Daniel 1–6, distinct from Cast3 CourtSet's Persian columns): walls of deep blue glazed brick,
 * stylised palm-tree pillars with double volutes, a white-and-yellow rosette band, a frieze of striding yellow lions facing
 * the throne, a gold-framed niche behind a LionThrone at tx (faces left unless tflip false). style "nineveh" makes it an
 * Assyrian hall instead (alabaster relief panels, winged bulls by the niche) for the king of Nineveh. Interior like
 * CourtSet: children stand on the floor (near band, Person s ≈ 1); `king` sits on the throne (a Person at x = 0, y = 0 with
 * sit: 1). Throne dais top at ridgeY(useLandGeo("plain", seed).near, tx) - 36 * p(0.95, 0.9) * K.near. `night`, `lamp`.
 */
export const BabylonCourt: React.FC<{
  cam: CamT;
  seed: string;
  children?: React.ReactNode;
  fx?: React.ReactNode;
  tx?: number;
  tflip?: boolean;
  throne?: boolean;
  king?: React.ReactNode;
  night?: number;
  lamp?: number;
  style?: "babylon" | "nineveh";
}> = ({ cam, seed, children, fx, tx, tflip = true, throne = true, king, night = 0.3, lamp = 1, style = "babylon" }) => {
  const { p, W, H, v } = useLayout();
  const f = useCurrentFrame();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const nin = style === "nineveh";
  const ttx = tx ?? p(1440, 790);
  const wallC = nin ? "#A8A090" : "#1E3A72";
  const lionC = nin ? "#7A7060" : "#E8B840";
  const topY = p(120, 300);
  const rosY = p(190, 380);
  const fr2Y = v && !nin ? 780 : null;
  const frY = p(560, 1110);
  const frH = p(84, 80);
  const floorY = ridgeY(geo.near, W / 2);
  const flick = 0.86 + 0.14 * Math.sin(f * 0.37) * Math.sin(f * 0.13 + 1);
  const pillars = (p([0.06, 0.24, 0.42, 0.94], [0.1, 0.9]) as number[]).map((t) => t * W).filter((cx) => Math.abs(cx - ttx) > p(260, 200));
  const nW = p(300, 280);
  const braz = [ttx - p(420, 330), ttx + p(420, 330)].filter((bx) => bx > p(60, 60) && bx < W - p(60, 60));
  return (
    <Stage cam={cam} tod={0.5 + night * 0.4} rim="255,196,130" rimA={0.55}>
      <AbsoluteFill style={{ background: nin ? "linear-gradient(180deg, #2A241C 0%, #4A4234 55%, #1E1A14 100%)" : "linear-gradient(180deg, #0C1424 0%, #1A2A48 55%, #0A0E18 100%)" }} />
      <Band depth={0.3} k={K.mid}>
        <rect x={-400} y={topY} width={W + 800} height={H} fill={wallC} />
        {Array.from({ length: 70 }, (_, r) => (
          <line key={r} x1={-400} y1={topY + r * (nin ? 60 : 16)} x2={W + 400} y2={topY + r * (nin ? 60 : 16)} stroke={nin ? "rgba(60,50,40,0.3)" : "rgba(4,10,24,0.35)"} strokeWidth={1} />
        ))}
        {nin
          ? Array.from({ length: Math.ceil((W + 800) / 180) }, (_, i) => {
              const px = -400 + i * 180;
              return (
                <g key={`rp${i}`}>
                  <line x1={px} y1={topY} x2={px} y2={floorY} stroke="rgba(60,50,40,0.35)" strokeWidth={2} />
                  {Array.from({ length: p(2, 3) }, (_, r) => {
                    const yy = rosY + 130 + r * p(200, 240);
                    return [60, 124].map((ox) => {
                      const fx = px + ox;
                      return (
                        <g key={`${r}${ox}`} opacity={0.62}>
                          <path d={`M ${fx - 13} ${yy} L ${fx - 10} ${yy - 50} Q ${fx} ${yy - 56} ${fx + 10} ${yy - 50} L ${fx + 15} ${yy} Z`} fill="#857A68" />
                          <path d={`M ${fx - 12} ${yy - 6} L ${fx + 14} ${yy - 30}`} stroke="#A89E8C" strokeWidth={1.4} />
                          <circle cx={fx + 1} cy={yy - 60} r={8} fill="#857A68" />
                          <path d={`M ${fx - 7} ${yy - 64} L ${fx + 1} ${yy - 80} L ${fx + 9} ${yy - 64} Z`} fill="#857A68" />
                          <path d={`M ${fx + 3} ${yy - 58} Q ${fx + 11} ${yy - 46} ${fx + 2} ${yy - 44} Z`} fill="#6A6050" />
                          <path d={`M ${fx + 6} ${yy - 46} L ${fx + 20} ${yy - 38} L ${fx + 26} ${yy - 50}`} stroke="#857A68" strokeWidth={4} fill="none" strokeLinecap="round" />
                        </g>
                      );
                    });
                  })}
                </g>
              );
            })
          : null}
        <rect x={-400} y={rosY - 22} width={W + 800} height={44} fill={nin ? "#8A8070" : "#16305E"} />
        {Array.from({ length: Math.ceil((W + 800) / 44) }, (_, i) => {
          const cx = -400 + i * 44 + 22;
          return (
            <g key={`ro${i}`}>
              {Array.from({ length: 8 }, (_, j) => (
                <ellipse key={j} cx={cx + Math.cos((j / 8) * Math.PI * 2) * 9} cy={rosY + Math.sin((j / 8) * Math.PI * 2) * 9} rx={6} ry={3} fill={nin ? "#C8C0B0" : "#F2ECDC"} transform={`rotate(${(j / 8) * 360} ${cx + Math.cos((j / 8) * Math.PI * 2) * 9} ${rosY + Math.sin((j / 8) * Math.PI * 2) * 9})`} />
              ))}
              <circle cx={cx} cy={rosY} r={5} fill={nin ? "#E0D8C8" : "#E8B840"} />
            </g>
          );
        })}
        <rect x={-400} y={frY - 10} width={W + 800} height={frH + 20} fill={nin ? "#988E7E" : "#24427E"} />
        {[frY - 10, frY + frH + 4].map((yy) => (
          <rect key={yy} x={-400} y={yy} width={W + 800} height={6} fill={nin ? "#C8C0B0" : "#E8DCC0"} opacity={0.85} />
        ))}
        {Array.from({ length: Math.ceil((W + 800) / p(150, 130)) }, (_, i) => {
          const lx = -400 + i * p(150, 130) + 60;
          return brickLion(lx, frY + frH * 0.88, (frH / 46) * 0.9, lionC, `l${i}`, lx > ttx);
        })}
        {fr2Y !== null ? (
          <g>
            <rect x={-400} y={fr2Y - 10} width={W + 800} height={frH + 20} fill="#24427E" />
            {[fr2Y - 10, fr2Y + frH + 4].map((yy) => (
              <rect key={yy} x={-400} y={yy} width={W + 800} height={6} fill="#E8DCC0" opacity={0.85} />
            ))}
            {Array.from({ length: Math.ceil((W + 800) / 130) }, (_, i) => {
              const lx = -400 + i * 130 + 60;
              return brickLion(lx, fr2Y + frH * 0.88, (frH / 46) * 0.9, "#ECE4D2", `l2${i}`, lx > ttx);
            })}
          </g>
        ) : null}
        <rect x={ttx - nW / 2 - 18} y={topY + p(70, 60)} width={nW + 36} height={floorY - topY} fill={nin ? "#C8BCA4" : "#C8962E"} />
        <path d={`M ${ttx - nW / 2} ${floorY} L ${ttx - nW / 2} ${topY + p(190, 170)} Q ${ttx} ${topY + p(70, 70)} ${ttx + nW / 2} ${topY + p(190, 170)} L ${ttx + nW / 2} ${floorY} Z`} fill={nin ? "#3A342A" : "#0E1A36"} />
        {!nin
          ? [0, 1, 2].map((r) => (
              <path key={r} d={`M ${ttx - nW / 2 + 20 + r * 16} ${floorY} L ${ttx - nW / 2 + 20 + r * 16} ${topY + p(200, 180) + r * 14} Q ${ttx} ${topY + p(90, 90) + r * 16} ${ttx + nW / 2 - 20 - r * 16} ${topY + p(200, 180) + r * 14} L ${ttx + nW / 2 - 20 - r * 16} ${floorY}`} stroke={r % 2 ? "#E8B840" : "#2A4E8E"} strokeWidth={6} fill="none" opacity={0.85} />
            ))
          : null}
        {nin
          ? [-1, 1].map((d) => {
              const bx = ttx + d * (nW / 2 + 90);
              const by = floorY - 4;
              return (
                <g key={`lm${d}`} transform={`translate(${bx} ${by}) scale(${d * p(1.15, 1)} ${p(1.15, 1)})`}>
                  <path d="M -70 0 L -66 -120 Q -60 -150 -20 -150 L 40 -152 Q 60 -150 62 -120 L 64 0 L 50 0 L 48 -90 L 30 -90 L 28 0 L 14 0 L 12 -80 L -30 -80 L -32 0 L -46 0 L -48 -80 L -56 -80 L -56 0 Z" fill="#A39886" stroke="rgba(60,50,40,0.7)" strokeWidth={1.6} />
                  <path d="M -50 -150 Q -90 -230 -40 -280 Q -20 -220 10 -160 Z" fill="#968C7A" stroke="rgba(60,50,40,0.7)" strokeWidth={1.4} />
                  {[0, 1, 2, 3, 4].map((i) => (
                    <path key={i} d={`M ${-46 + i * 6} ${-156 - i * 22} L ${-6 + i * 3} ${-158 - i * 8}`} stroke="#6A6050" strokeWidth={1.6} />
                  ))}
                  {[-40, -10, 20].map((rx) => (
                    <path key={rx} d={`M ${rx} -140 q 6 10 0 20 q -6 10 0 20`} stroke="#6A6050" strokeWidth={1.4} fill="none" />
                  ))}
                  <rect x={36} y={-206} width={34} height={44} rx={4} fill="#A39886" stroke="rgba(60,50,40,0.7)" strokeWidth={1.2} />
                  <path d="M 38 -206 L 40 -226 L 68 -226 L 70 -206 Z" fill="#7A7060" />
                  <path d="M 40 -170 L 44 -126 L 66 -126 L 70 -170 Z" fill="#5A5044" />
                  <circle cx={60} cy={-190} r={3} fill="#3A3228" />
                </g>
              );
            })
          : null}
        {pillars.map((cx, i) => (
          <g key={`pl${i}`}>
            <rect x={cx - p(16, 18)} y={topY + p(120, 100)} width={p(32, 36)} height={floorY - topY} fill={nin ? "#C8C0AC" : "#D8A840"} stroke="rgba(255,220,170,0.4)" strokeWidth={1.2} />
            {Array.from({ length: 14 }, (_, j) => (
              <path key={j} d={`M ${cx - p(16, 18)} ${topY + p(140, 120) + j * p(30, 36)} l ${p(16, 18)} ${p(10, 12)} l ${p(16, 18)} ${-p(10, 12)}`} stroke={nin ? "rgba(90,80,64,0.5)" : "rgba(120,80,20,0.5)"} strokeWidth={1.4} fill="none" />
            ))}
            {[-1, 1].map((d) => (
              <path key={d} d={`M ${cx} ${topY + p(120, 100)} q ${d * p(30, 34)} ${-p(4, 4)} ${d * p(34, 38)} ${p(18, 20)} q ${-d * p(4, 4)} ${p(10, 12)} ${-d * p(14, 16)} ${p(2, 2)}`} stroke={nin ? "#A89E8A" : "#E8C060"} strokeWidth={p(5, 6)} fill="none" />
            ))}
            {Array.from({ length: 7 }, (_, j) => {
              const a = -150 + j * 20;
              return <path key={`fr${j}`} d={`M ${cx} ${topY + p(112, 92)} q ${Math.cos((a * Math.PI) / 180) * p(30, 34)} ${Math.sin((a * Math.PI) / 180) * p(30, 34) - p(8, 10)} ${Math.cos((a * Math.PI) / 180) * p(56, 62)} ${Math.sin((a * Math.PI) / 180) * p(40, 44) + p(16, 18)}`} stroke={nin ? "#8A8070" : "#3E6A3A"} strokeWidth={p(4, 5)} fill="none" strokeLinecap="round" />;
            })}
          </g>
        ))}
      </Band>
      <Band depth={0.8} ridge={geo.near} fill={nin ? "#5A5244" : "#3A3026"} fill2="#140E0A" haze={0} edge={0.25} k={K.near}>
        <Paving color="16,12,8" />
        {braz.map((bx, i) => (
          <BrazierStand key={`bz${i}`} x={bx} s={p(1, 0.9)} fire={lamp} seed={`${seed}bz${i}`} />
        ))}
        {throne ? <LionThrone x={ttx} s={p(0.95, 0.9)} flip={tflip} seat={king} /> : null}
        {children}
      </Band>
      {braz.map((bx, i) => {
        const q = projectPt(cam, W, H, bx, ridgeY(geo.near, bx) - 190 * p(1, 0.9) * K.near, 0.8);
        return <Glow key={i} x={q.x} y={q.y} size={p(520, 460)} color="255,170,90" opacity={lamp * (0.3 + 0.3 * night) * flick} />;
      })}
      <Glow x={ttx} y={p(380, 780)} size={p(1200, 1000)} color={nin ? "255,200,140" : "200,180,255"} opacity={0.14 * (1 - 0.5 * night)} />
      <Tint color="#06050A" opacity={0.3 * night} />
      {fx}
    </Stage>
  );
};

const DURA_ROBES = ["#6A5A48", "#5A6048", "#4A5468", "#7A6448", "#6A4A50", "#6A6458", "#5A4A3A"];

/**
 * The plain of Dura (Daniel 3:1–7): the golden image on the middle band at sx (scale ss: the crowd beside it is Populace
 * at size 174 * ss, i.e. Person scale for the statue), throngs on both sides of it that bow at `bow` 0..1, musicians to
 * its left (`music` 0..1), Babylon far off, and nearer crowds at the edges of the near band (`nearCrowd`). The three
 * youths who stand stand on the near band (Person s ≈ 1). `glint` 0..1 (undefined: a slow sweep) on the gold.
 */
export const DuraPlain: React.FC<SetP & { sx?: number; ss?: number; bow?: number; crowd?: number; music?: number; glint?: number; nearCrowd?: boolean; preset?: LandPreset }> = ({
  cam,
  seed,
  tod = 0.44,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  sx,
  ss,
  bow = 0,
  crowd = 1,
  music = 0,
  glint,
  nearCrowd = true,
  preset = "plain",
}) => {
  const { p, W } = useLayout();
  const x = sx ?? p(1240, 640);
  const s = ss ?? p(0.36, 0.42);
  const size = 174 * s;
  const gapW = 300 * s * p(1.15, 1.3);
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#8C7A52", near: "#6E5C3A", front: "#3A2E1C" }}
      sky={sky ?? { sun: { x: p(1700, 950), y: p(300, 700) }, clouds: 0.2 }}
      far={
        <>
          <Skyline x={p(380, 260)} s={p(0.32, 0.3)} kind="babylon" seed={`${seed}sk`} />
          {far}
        </>
      }
      mid={
        <>
          <Populace x0={p(-40, -30)} x1={x - gapW} n={p(20, 8)} rows={2} size={size} seed={`${seed}cl`} bow={bow} p={crowd} colors={DURA_ROBES} />
          <Populace x0={x + gapW} x1={W + p(40, 30)} n={p(14, 6)} rows={2} size={size} seed={`${seed}cr`} bow={bow} p={crowd} flip colors={DURA_ROBES} />
          <GoldenStatue x={x} s={s} glint={glint} glow={0.5} />
          {music > 0
            ? [0, 1, 2].map((i) => (
                <g key={i} opacity={music}>
                  <Person x={x - gapW - p(40, 26) - i * p(34, 26)} s={s * 1.1} look={{ robe: ["#7A2A3A", "#2A4A6A", "#6A5A2A"][i], head: "turban", cap: "#E0D4B8", beard: true, hold: (["shofar", "harp", "timbrel"] as const)[i] }} pose={{ arm: [70, 30] }} />
                </g>
              ))
            : null}
          {mid}
        </>
      }
      near={
        <>
          {nearCrowd ? <Populace x0={p(-60, -60)} x1={p(380, 170)} n={p(5, 3)} rows={2} size={p(120, 128)} seed={`${seed}nl`} bow={bow} p={crowd} colors={DURA_ROBES} /> : null}
          {nearCrowd ? <Populace x0={W - p(380, 170)} x1={W + p(60, 60)} n={p(5, 3)} rows={2} size={p(120, 128)} seed={`${seed}nr`} bow={bow} p={crowd} flip colors={DURA_ROBES} /> : null}
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/**
 * The burning fiery furnace (Daniel 3:19–27): the FieryFurnace on the middle band at fx0 (scale fs), the king and his
 * counsellors on the near band in front (Person s ≈ 1), evening sky, heat glow and rising embers. `inside` is drawn in the
 * furnace mouth (Persons at y = 0, |x| < 180, s = 1: they take the furnace's scale). fire, heat, cool, door as FieryFurnace.
 */
export const FurnaceSet: React.FC<{
  cam: CamT;
  seed: string;
  tod?: number;
  fire?: number;
  heat?: number;
  cool?: number;
  door?: number;
  inside?: React.ReactNode;
  fx0?: number;
  fs?: number;
  near?: React.ReactNode;
  far?: React.ReactNode;
  fx?: React.ReactNode;
  sky?: SkyP;
}> = ({ cam, seed, tod = 0.78, fire = 1, heat = 0, cool = 0, door = 0, inside, fx0, fs, near, far, fx, sky }) => {
  const { p, W, H } = useLayout();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const x = fx0 ?? p(1180, 600);
  const s = fs ?? p(0.72, 0.7);
  const base = ridgeY(geo.mid, x);
  const q = projectPt(cam, W, H, x, base - 180 * s * K.mid, 0.4);
  return (
    <Land
      preset="plain"
      seed={seed}
      tod={tod}
      cam={cam}
      colors={{ mid: "#6A5640", near: "#4E3E2E", front: "#241A12" }}
      sky={sky ?? { sun: null, clouds: 0.25, stars: tod > 0.8 ? 0.6 : 0 }}
      far={
        <>
          <Skyline x={p(420, 200)} s={p(0.3, 0.28)} kind="babylon" lit={0.6} seed={`${seed}sk`} />
          {far}
        </>
      }
      mid={<FieryFurnace x={x} s={s} fire={fire} heat={heat} cool={cool} door={door} inside={inside} seed={`${seed}ff`} />}
      near={
        <>
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      fx={
        <>
          <Glow x={q.x} y={q.y} size={p(1500, 1300)} color="255,120,50" opacity={0.28 * fire * (0.7 + 0.3 * heat)} />
          <Dust count={50} seed={`${seed}em`} area={{ x: q.x - p(400, 300), y: 0, w: p(800, 600), h: q.y + p(200, 200) }} color="255,180,90" opacity={0.7 * fire} size={[1, 2.6]} vy={-1.2} drift={0.6} />
          <Tint color="#FF6A2A" opacity={0.07 * fire} blend="soft-light" />
          {fx}
        </>
      }
    />
  );
};

/**
 * The lions' den in cutaway (Daniel 6:16–23; 14:31–42): the ground surface at sy with the king's city far behind; below it
 * a cave chamber reached by a shaft at dx, a great stone over the shaft's mouth (`cover` 0..1, 1 = covering it, 0 = rolled
 * aside to the right) with the king's seal (`seal` 0..1). `lions` lions lie or pace on the den floor (`lionPose`), leaving
 * the middle free for Daniel; `glow` 0..1 fills the den with the angel's light. Slots: `inside` stands on the den floor
 * (Person s ≈ 1, ground = the floor), `above` on the surface (the king at the edge; drawn in front of the stone).
 * Screen anchors: surface y = p(470, 760), den floor y = p(1000, 1480), shaft at dx.
 */
export const LionsDenSet: React.FC<{
  cam: CamT;
  seed: string;
  tod?: number;
  dx?: number;
  cover?: number;
  seal?: number;
  glow?: number;
  lions?: number;
  lionPose?: "lie" | "sleep" | "stand" | "walk" | "sit";
  inside?: React.ReactNode;
  above?: React.ReactNode;
  fx?: React.ReactNode;
  sky?: SkyP;
  city?: boolean;
}> = ({ cam, seed, tod = 0.3, dx, cover = 1, seal = 1, glow = 0, lions = 4, lionPose = "lie", inside, above, fx, sky, city = true }) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const x = dx ?? W / 2;
  const sy = p(470, 760);
  const fy = p(1000, 1480);
  const hw = p(700, 500);
  const shaftW = p(230, 210);
  const shaftB = sy + p(110, 120);
  const kIn = p(1.05, 1.25);
  const kUp = p(1.0, 1.2);
  const surf = (xx: number) => sy + Math.sin(xx * 0.004 + 1) * 4;
  const floor = (xx: number) => fy + Math.sin(xx * 0.006) * 5;
  const night = tod > 0.74 || tod < 0.22;
  const cave: Pt[] = [
    [x - shaftW / 2, shaftB], [x - hw * 0.55, shaftB + p(30, 40)], [x - hw * 0.9, shaftB + p(110, 130)], [x - hw, fy - p(120, 160)], [x - hw * 0.95, fy + p(10, 10)],
    [x + hw * 0.95, fy + p(10, 10)], [x + hw, fy - p(140, 170)], [x + hw * 0.88, shaftB + p(100, 120)], [x + hw * 0.5, shaftB + p(26, 36)], [x + shaftW / 2, shaftB],
  ];
  const shaft = `M ${x - shaftW / 2 - 10} ${sy - 2} L ${x - shaftW / 2} ${shaftB + 20} L ${x + shaftW / 2} ${shaftB + 20} L ${x + shaftW / 2 + 10} ${sy - 2} Z`;
  const stoneX = x + (1 - cover) * p(360, 300);
  const stoneW = shaftW + p(90, 80);
  const stoneH = p(46, 50);
  const lionXs = [-0.74, -0.44, 0.44, 0.74, -0.6, 0.6, 0].slice(0, Math.min(7, lions));
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} clouds={0.25} stars={night ? 1 : 0.2} hzY={sy - p(40, 50)} sun={null} moon={night ? { x: p(1600, 860), y: p(140, 400), r: 22 } : null} {...sky} />
      <Band depth={0.15} ridge={{ base: sy - p(30, 40), amp: 18, seed: `${seed}f` }} fill="#4A4A58" haze={0.5} edge={0.3} k={K.far}>
        {city ? <Skyline x={p(1500, 800)} y={sy - p(28, 38)} s={p(0.3, 0.28)} kind="babylon" lit={night ? 0.7 : 0} seed={`${seed}sk`} /> : null}
      </Band>
      <Band depth={0.8} shape={surf} fill="#5E4C36" fill2="#2A2018" haze={0} edge={0.5} k={kUp}>
        {Array.from({ length: 7 }, (_, r) => {
          const yy = sy + p(60, 70) + r * p(80, 110);
          return <path key={r} d={`M -400 ${yy} Q ${W * 0.3} ${yy + 16 * Math.sin(r)} ${W * 0.6} ${yy - 10} T ${W + 400} ${yy + 6}`} stroke="rgba(20,14,8,0.35)" strokeWidth={2} fill="none" />;
        })}
        {Array.from({ length: 30 }, (_, i) => (
          <ellipse key={`st${i}`} cx={range(`${seed}sx${i}`, -100, W + 100)} cy={range(`${seed}sy${i}`, sy + 30, H)} rx={range(`${seed}sr${i}`, 6, 18)} ry={range(`${seed}sr${i}`, 4, 10)} fill="rgba(110,96,76,0.35)" />
        ))}
        <Grass x0={-300} x1={W + 300} n={50} seed={`${seed}g`} h={[8, 20]} color={["#5A5030", "#8A7A4A"]} />
      </Band>
      <Band depth={0.8} gy={floor} k={kIn}>
        <path d={shaft} fill="#120C08" />
        <path d={smooth(cave, true, 0.4)} fill="#1E1610" stroke="rgba(180,150,110,0.35)" strokeWidth={3} />
        <path d={smooth(cave, true, 0.4)} fill="none" stroke="#3A2C1E" strokeWidth={14} opacity={0.6} />
        {Array.from({ length: 14 }, (_, i) => (
          <ellipse key={`rk${i}`} cx={x + range(`${seed}cx${i}`, -0.85, 0.85) * hw} cy={range(`${seed}cy${i}`, shaftB + 40, fy - 30)} rx={range(`${seed}cr${i}`, 20, 50)} ry={range(`${seed}cr${i}`, 10, 24)} fill="rgba(60,46,32,0.4)" />
        ))}
        <path d={`M ${x - hw * 0.95} ${fy + 6} Q ${x} ${fy - 14} ${x + hw * 0.95} ${fy + 6} L ${x + hw * 0.95} ${fy + 30} L ${x - hw * 0.95} ${fy + 30} Z`} fill="#3A2C20" />
        {cover < 1 || glow > 0 ? <GlowS x={x} y={shaftB} r={shaftW * 1.2} squash={1.6} color={night ? "160,180,230" : "255,226,170"} opacity={0.35 * (1 - cover) + 0.2 * glow} /> : null}
        {glow > 0 ? <GlowS x={x} y={fy - p(160, 200)} r={hw * 0.75} squash={0.6} color="255,236,190" opacity={0.7 * glow} /> : null}
        {lionXs.map((u, i) => (
          <DenLion key={i} x={x + u * hw} s={0.95} pose={i % 3 === 2 && lionPose === "lie" ? "sleep" : lionPose} flip={u > 0} mane={i % 3 !== 1} seed={`${seed}l${i}`} phase={f * 0.18 + i} />
        ))}
        {inside}
        <g transform={`translate(${stoneX} ${sy})`}>
          <ellipse cx={0} cy={2} rx={stoneW / 2 + 10} ry={8} fill="rgba(0,0,0,0.45)" />
          <rect x={-stoneW / 2} y={-stoneH} width={stoneW} height={stoneH + 4} rx={stoneH / 2} fill="#7A7064" stroke="rgba(255,226,180,0.45)" strokeWidth={1.6} />
          <rect x={-stoneW / 2 + 10} y={-stoneH + 6} width={stoneW - 20} height={10} rx={5} fill="rgba(200,190,170,0.25)" />
          {seal > 0.01 ? (
            <g opacity={Math.min(1, seal * 1.5)}>
              <path d={`M ${-stoneW / 2 - p(60, 50)} 2 Q 0 ${-stoneH * 0.4} ${stoneW / 2 + p(60, 50)} 2`} stroke="#8A6A40" strokeWidth={2.4} fill="none" />
              <rect x={-stoneW / 2 - p(66, 56)} y={-10} width={7} height={14} fill="#5A4030" />
              <rect x={stoneW / 2 + p(58, 48)} y={-10} width={7} height={14} fill="#5A4030" />
              <ellipse cx={0} cy={-stoneH * 0.45} rx={15} ry={11} fill="#8A3A22" stroke="rgba(255,220,170,0.6)" strokeWidth={1} />
              <circle cx={0} cy={-stoneH * 0.45} r={5} fill="none" stroke="#E0A060" strokeWidth={1.3} />
            </g>
          ) : null}
        </g>
      </Band>
      <Band depth={0.8} gy={surf} k={kUp}>
        {above}
      </Band>
      {fx}
    </Stage>
  );
};

/**
 * Joakim's garden in Babylon (Susanna, Daniel 13): a plastered garden wall across the middle band with the garden doors at
 * gx (`doors` 0..1 open; Susanna has them shut) and a small side door, trees before it (olive, a mastic and an evergreen oak
 * by name), palms beyond, a bathing pool in the near band at px with a stone rim (water only; Susanna stays clothed), lush
 * grass and flowers. People stand on the near band (Person s ≈ 1); the two big near trees at the edges (x ≈ p(150, 60) and
 * W - p(170, 70)) are drawn after `near`, so an elder placed there hides behind them.
 */
export const SusannaGarden: React.FC<SetP & { gx?: number; doors?: number; px?: number; pool?: boolean }> = ({ cam, seed, tod = 0.5, near, mid, far, front, fx, sky, storm = 0, gx, doors = 0, px, pool = true }) => {
  const { p, W } = useLayout();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const f = useCurrentFrame();
  const g = gx ?? p(1540, 830);
  const pxx = px ?? p(900, 500);
  const wh = 230;
  const pw = p(520, 420);
  const pd = p(120, 150);
  const gyN = ridgeY(geo.near, pxx);
  return (
    <Land
      preset="plain"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#5E6A3A", near: "#4A5A2E", front: "#24301A" }}
      sky={sky ?? { sun: { x: p(1600, 900), y: p(240, 640) }, clouds: 0.25 }}
      far={
        <>
          {Array.from({ length: p(7, 4) }, (_, i) => (
            <Palm key={i} x={p(80, 60) + i * p(280, 280)} s={0.8} lean={range(`${seed}pl${i}`, -0.3, 0.3)} seed={`${seed}fp${i}`} />
          ))}
          {far}
        </>
      }
      mid={
        <>
          <GardenWall wh={wh} gx={g} doors={doors} sideX={p(330, 150)} seed={`${seed}w`} />
          {Array.from({ length: p(7, 4) }, (_, i) => {
            const bx = (W * (i + 0.5)) / p(7, 4) + range(`${seed}bu${i}`, -40, 40);
            if (Math.abs(bx - g) < p(130, 110) || Math.abs(bx - p(330, 150)) < p(70, 60)) return null;
            return <Bush key={`bu${i}`} x={bx} s={range(`${seed}bs${i}`, 0.7, 1)} seed={`${seed}bb${i}`} color={i % 2 ? "#3E5A2E" : "#4A6234"} />;
          })}
          <Tree x={p(560, 330)} s={0.9} kind="olive" seed={`${seed}t1`} />
          <Tree x={p(1180, 640)} s={0.95} kind="terebinth" seed={`${seed}t2`} />
          <Tree x={p(1820, 1030)} s={0.85} kind="olive" seed={`${seed}t3`} flip />
          {mid}
        </>
      }
      near={
        <>
          {pool ? (
            <g>
              <path d={`M ${pxx - pw / 2 - 18} ${gyN + 4} L ${pxx + pw / 2 + 18} ${gyN + 4} L ${pxx + pw / 2 + 50} ${gyN + pd + 18} L ${pxx - pw / 2 - 50} ${gyN + pd + 18} Z`} fill="#A8987A" stroke="rgba(255,236,200,0.5)" strokeWidth={1.4} />
              <path d={`M ${pxx - pw / 2} ${gyN + 14} L ${pxx + pw / 2} ${gyN + 14} L ${pxx + pw / 2 + 28} ${gyN + pd} L ${pxx - pw / 2 - 28} ${gyN + pd} Z`} fill="#2E5A6A" />
              <path d={`M ${pxx - pw / 2} ${gyN + 14} L ${pxx + pw / 2} ${gyN + 14} L ${pxx + pw / 2 + 6} ${gyN + 30} L ${pxx - pw / 2 - 6} ${gyN + 30} Z`} fill="rgba(10,20,30,0.45)" />
              {Array.from({ length: 9 }, (_, i) => {
                const t = mod(f * 0.004 + i / 9, 1);
                const yy = gyN + 34 + t * (pd - 40);
                const ww = (pw * 0.3 + t * pw * 0.2) * (0.6 + 0.4 * random(`${seed}r${i}`));
                const xx = pxx + range(`${seed}rx${i}`, -0.3, 0.3) * pw;
                return <line key={i} x1={xx - ww / 2} y1={yy} x2={xx + ww / 2} y2={yy} stroke="rgba(220,236,240,0.4)" strokeWidth={1.4} opacity={Math.sin(Math.PI * t)} />;
              })}
              <path d={`M ${pxx - pw * 0.1} ${gyN + 40} L ${pxx + pw * 0.15} ${gyN + 40} L ${pxx + pw * 0.24} ${gyN + pd - 10} L ${pxx - pw * 0.04} ${gyN + pd - 10} Z`} fill="rgba(255,250,230,0.12)" />
            </g>
          ) : null}
          {Array.from({ length: 26 }, (_, i) => {
            const fx2 = range(`${seed}fl${i}`, -40, W + 40);
            if (pool && Math.abs(fx2 - pxx) < pw / 2 + 60) return null;
            const fy2 = ridgeY(geo.near, fx2) + range(`${seed}fy${i}`, 4, 60);
            return <circle key={`fl${i}`} cx={fx2} cy={fy2} r={range(`${seed}fr${i}`, 2.4, 4.6) * K.near * 0.7} fill={["#E8D8E8", "#E8C060", "#E87060", "#F2ECE0"][i % 4]} opacity={0.85} />;
          })}
          {near}
          <Tree x={p(150, 60)} s={p(1.5, 1.3)} kind="oak" seed={`${seed}n1`} />
          <Tree x={W - p(170, 70)} s={p(1.4, 1.25)} kind="terebinth" seed={`${seed}n2`} flip />
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/** A plastered garden wall across the middle band (Person scale, wh tall) with garden doors at gx and a side door. */
const GardenWall: React.FC<{ wh: number; gx: number; doors: number; sideX: number; seed: string }> = ({ wh, gx, doors, sideX }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const { W } = useLayout();
  const k = band.k;
  const c = ink("#C8B898");
  const top = (xx: number) => band.gy(xx) - wh * k;
  const pts: string[] = [];
  const pb: string[] = [];
  for (let xx = -300; xx <= W + 300; xx += 20) {
    pts.push(`${pts.length ? "L" : "M"} ${xx} ${top(xx).toFixed(1)}`);
    pb.unshift(`L ${xx} ${(band.gy(xx) + 2).toFixed(1)}`);
  }
  const gw = 130 * k;
  const gh = 190 * k;
  const gyG = band.gy(gx);
  const sw = 64 * k;
  const sh = 120 * k;
  const gyS = band.gy(sideX);
  const cedar = ink("#5E3C22");
  return (
    <g>
      <path d={`${pts.join(" ")} ${pb.join(" ")} Z`} fill={c} stroke={rim(0.8)} strokeWidth={1.2} />
      <path d={pts.join(" ")} stroke={ink("#8A5A3A")} strokeWidth={8 * k} fill="none" />
      <path d={pts.join(" ")} transform={`translate(0 ${-4 * k})`} stroke={ink("#A86A44")} strokeWidth={3 * k} fill="none" />
      <rect x={gx - gw / 2 - 14 * k} y={gyG - gh - 24 * k} width={gw + 28 * k} height={gh + 24 * k} fill={tone(c, -0.08)} stroke={rim(0.8)} strokeWidth={1.2} />
      <rect x={gx - gw / 2} y={gyG - gh} width={gw} height={gh} fill="#2A3A20" />
      <rect x={gx - gw / 2} y={gyG - gh} width={gw} height={gh} fill="rgba(140,170,110,0.35)" />
      {[-1, 1].map((d) => (
        <g key={d} transform={`translate(${gx + d * (gw / 2)} 0) scale(${1 - 0.85 * doors} 1) translate(${-(gx + d * (gw / 2))} 0)`}>
          <rect x={d < 0 ? gx - gw / 2 : gx} y={gyG - gh} width={gw / 2} height={gh} fill={d < 0 ? cedar : tone(cedar, -0.08)} stroke={rim(0.7)} strokeWidth={1} />
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1={d < 0 ? gx - gw / 2 : gx} y1={gyG - gh * t} x2={d < 0 ? gx : gx + gw / 2} y2={gyG - gh * t} stroke={tone(cedar, 0.2)} strokeWidth={1.4} />
          ))}
        </g>
      ))}
      <rect x={sideX - sw / 2} y={gyS - sh} width={sw} height={sh} fill={tone(cedar, -0.1)} stroke={rim(0.7)} strokeWidth={1} />
      <circle cx={sideX + sw * 0.3} cy={gyS - sh * 0.5} r={2.4 * k} fill={ink("#B8863A")} />
    </g>
  );
};

/**
 * The temple of Bel (Daniel 14:1–22), interior: walls of dark brick with recessed niches and gold bands, the bronze idol Bel
 * on its dais at ix with the table of provisions before it, the great doors on the left (`sealed` 0..1: the king's clay seal
 * on cords; `doorOpen` 0..1), and a secret trapdoor in the floor to the right of the table (`secret` 0..1 opens it). The
 * floor can be strewn with ashes (`ashes` 0..1) and show the footprints of men, women and children leading from the trapdoor
 * to the table (`prints` 0..1). `eaten` 0..1 empties the table; `crack`/`fall` break Bel; `night` dims it to lamplight.
 * Children stand on the floor (near band, Person s ≈ 1).
 */
export const BelTemple: React.FC<{
  cam: CamT;
  seed: string;
  children?: React.ReactNode;
  fx?: React.ReactNode;
  ix?: number;
  eaten?: number;
  ashes?: number;
  prints?: number;
  secret?: number;
  sealed?: number;
  doorOpen?: number;
  crack?: number;
  fall?: number;
  night?: number;
  lamp?: number;
}> = ({ cam, seed, children, fx, ix, eaten = 0, ashes = 0, prints = 0, secret = 0, sealed = 0, doorOpen = 0, crack = 0, fall = 0, night = 0.3, lamp = 1 }) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const x = ix ?? p(1180, 600);
  const topY = p(100, 500);
  const dX = p(240, 130);
  const dW = p(220, 190);
  const dH = p(420, 400);
  const fyD = ridgeY(geo.near, dX) - p(130, 140);
  const sdx = x + p(330, 300) * p(1, 0.75);
  const fl = (xx: number) => ridgeY(geo.near, xx);
  const flick = 0.86 + 0.14 * Math.sin(f * 0.37) * Math.sin(f * 0.13 + 1);
  const lampX = [x - p(420, 330), x + p(560, 380)].filter((lx) => lx > 40 && lx < W - 40);
  const steps = [0, 1, 2].flatMap((tI) => {
    const r = [1, 0.8, 0.62][tI];
    const xa = sdx - p(30, 24);
    const ya = fl(sdx) + p(44, 50) + tI * p(12, 14);
    const xb = x + p(110, 80) - tI * p(50, 36);
    const yb = fl(xb) + p(40, 44) + tI * p(26, 30);
    const n = Math.max(6, Math.round(Math.abs(xa - xb) / (30 * r * K.near)));
    const ang = (Math.atan2(yb - ya, xb - xa) * 180) / Math.PI;
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      const side = i % 2 ? 1 : -1;
      return { x: lerp(xa, xb, t), y: lerp(ya, yb, t) + Math.sin(t * Math.PI) * p(22, 26) * (tI - 1) + side * 5 * r * K.near, r, a: ang + range(`${seed}fa${tI}${i}`, -8, 8), t: (tI * 0.15 + t) / 1.3 };
    });
  });
  return (
    <Stage cam={cam} tod={0.5 + night * 0.4} rim="255,190,120" rimA={0.55}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #140C08 0%, #2E1E14 55%, #0E0806 100%)" }} />
      <Band depth={0.3} k={K.mid}>
        <rect x={-400} y={topY} width={W + 800} height={H} fill="#4A3020" />
        {Array.from({ length: 60 }, (_, r) => (
          <line key={r} x1={-400} y1={topY + r * 18} x2={W + 400} y2={topY + r * 18} stroke="rgba(20,10,6,0.35)" strokeWidth={1} />
        ))}
        {Array.from({ length: Math.ceil((W + 800) / 110) }, (_, i) => {
          const nx = -400 + i * 110;
          if (Math.abs(nx - dX) < dW) return null;
          return (
            <g key={`n${i}`}>
              <rect x={nx + 20} y={topY + p(80, 70)} width={34} height={H} fill="#2E1E12" />
              <rect x={nx + 28} y={topY + p(80, 70)} width={18} height={H} fill="#24160E" />
            </g>
          );
        })}
        {[topY + p(46, 40), topY + p(60, 54)].map((yy, i) => (
          <rect key={yy} x={-400} y={yy} width={W + 800} height={i ? 4 : 10} fill="#C8962E" opacity={0.85} />
        ))}
        <rect x={dX - dW / 2 - 26} y={fyD - dH - 30} width={dW + 52} height={dH + 30 + p(140, 150)} fill="#5A3A24" stroke="rgba(255,200,140,0.3)" strokeWidth={1.4} />
        <rect x={dX - dW / 2} y={fyD - dH} width={dW} height={dH + p(140, 150)} fill="#0E0806" />
        {[-1, 1].map((d) => (
          <g key={d} transform={`translate(${dX + d * (dW / 2)} 0) scale(${1 - 0.85 * doorOpen} 1) translate(${-(dX + d * (dW / 2))} 0)`}>
            <rect x={d < 0 ? dX - dW / 2 : dX} y={fyD - dH} width={dW / 2} height={dH + p(140, 150)} fill={d < 0 ? "#5E3C22" : "#553620"} stroke="rgba(255,200,140,0.3)" strokeWidth={1} />
            {Array.from({ length: 6 }, (_, r) =>
              [0.3, 0.7].map((u) => <circle key={`${r}${u}`} cx={(d < 0 ? dX - dW / 2 : dX) + (dW / 2) * u} cy={fyD - dH + 40 + r * (dH / 6)} r={4} fill="#C8962E" />),
            )}
          </g>
        ))}
        {sealed > 0.01 ? (
          <g opacity={Math.min(1, sealed * 1.5)}>
            <path d={`M ${dX - dW / 2 + 10} ${fyD - dH * 0.5} Q ${dX} ${fyD - dH * 0.42} ${dX + dW / 2 - 10} ${fyD - dH * 0.5}`} stroke="#8A6A40" strokeWidth={3} fill="none" />
            <ellipse cx={dX} cy={fyD - dH * 0.45} rx={20} ry={14} fill="#8A3A22" stroke="rgba(255,220,170,0.6)" strokeWidth={1.2} />
            <circle cx={dX} cy={fyD - dH * 0.45} r={7} fill="none" stroke="#E0A060" strokeWidth={1.4} />
          </g>
        ) : null}
      </Band>
      <Band depth={0.8} ridge={geo.near} fill="#5A4430" fill2="#1A100A" haze={0} edge={0.25} k={K.near}>
        <Paving color="22,14,8" />
        {ashes > 0 ? (
          <g opacity={ashes}>
            <path d={`M ${-400} ${fl(-400) + 4} ${Array.from({ length: 30 }, (_, i) => `L ${-400 + (i * (W + 800)) / 29} ${fl(-400 + (i * (W + 800)) / 29) + 4}`).join(" ")} L ${W + 400} ${H + 300} L -400 ${H + 300} Z`} fill="rgba(196,190,180,0.35)" />
            {Array.from({ length: 90 }, (_, i) => {
              const ax2 = range(`${seed}as${i}`, -40, W + 40);
              return <circle key={i} cx={ax2} cy={fl(ax2) + range(`${seed}ay${i}`, 6, p(200, 300))} r={range(`${seed}ar${i}`, 1, 2.4)} fill="rgba(230,226,218,0.55)" />;
            })}
          </g>
        ) : null}
        {prints > 0 && ashes > 0
          ? steps.map((st, i) => {
              const a = seg(prints, st.t * 0.85, st.t * 0.85 + 0.15);
              if (a <= 0) return null;
              const sc = st.r * K.near * 0.75;
              return (
                <g key={`fp${i}`} opacity={0.6 * a * Math.min(1, ashes * 1.4)} transform={`translate(${st.x.toFixed(1)} ${st.y.toFixed(1)}) rotate(${st.a.toFixed(1)}) scale(${sc.toFixed(3)} ${(sc * 0.55).toFixed(3)})`}>
                  <ellipse cx={3} cy={0} rx={8} ry={4.2} fill="#4A3624" />
                  <ellipse cx={-8} cy={0} rx={4.6} ry={3.4} fill="#4A3624" />
                </g>
              );
            })
          : null}
        {secret > 0.01 || prints > 0 ? (
          <g>
            <path d={`M ${sdx - p(60, 50)} ${fl(sdx) + p(16, 20)} L ${sdx + p(60, 50)} ${fl(sdx) + p(16, 20)} L ${sdx + p(74, 64)} ${fl(sdx) + p(60, 70)} L ${sdx - p(74, 64)} ${fl(sdx) + p(60, 70)} Z`} fill={secret > 0.01 ? "#0A0604" : "rgba(30,20,12,0.4)"} stroke="rgba(255,200,140,0.25)" strokeWidth={1} />
            {secret > 0.01
              ? [0, 1, 2].map((i) => (
                  <line key={i} x1={sdx - p(50, 40) + i * 4} y1={fl(sdx) + p(28, 32) + i * p(10, 12)} x2={sdx + p(50, 40) - i * 4} y2={fl(sdx) + p(28, 32) + i * p(10, 12)} stroke="rgba(120,90,60,0.6)" strokeWidth={3} opacity={secret} />
                ))
              : null}
            {secret > 0.01 ? (
              <path d={`M ${sdx - p(60, 50)} ${fl(sdx) + p(16, 20)} L ${sdx + p(60, 50)} ${fl(sdx) + p(16, 20)} L ${sdx + p(60, 50)} ${fl(sdx) + p(16, 20) - p(70, 80) * secret} L ${sdx - p(60, 50)} ${fl(sdx) + p(16, 20) - p(70, 80) * secret} Z`} fill="#4A3220" stroke="rgba(255,200,140,0.35)" strokeWidth={1.2} />
            ) : null}
          </g>
        ) : null}
        <BelIdol x={x} s={p(1.0, 0.9)} crack={crack} fall={fall} glow={0.4 * lamp} />
        <BelTable x={x} s={p(1.0, 0.85)} eaten={eaten} />
        {lampX.map((lx, i) => (
          <BrazierStand key={`ls${i}`} x={lx} s={p(1, 0.9)} fire={lamp} seed={`${seed}ls${i}`} />
        ))}
        {children}
      </Band>
      {lampX.map((lx, i) => {
        const q = projectPt(cam, W, H, lx, ridgeY(geo.near, lx) - 190 * p(1, 0.9) * K.near, 0.8);
        return <Glow key={i} x={q.x} y={q.y} size={p(540, 480)} color="255,170,90" opacity={lamp * (0.3 + 0.3 * night) * flick} />;
      })}
      <Glow x={x} y={p(420, 860)} size={p(1300, 1100)} color="255,180,110" opacity={0.18 * lamp} />
      <Tint color="#06040A" opacity={0.3 * night} />
      {fx}
    </Stage>
  );
};

/**
 * The sea of Jonah 1: a TarshishShip riding the swell at sx (scale ss) under a storm sky (`storm` 0..1; 0 is the calm-sea
 * variant: a gentle swell, a clear sky). The ship pitches with the waves. Slots: `crew` stand on deck and `below` lies in
 * the hold cutaway (as TarshishShip), `onWater` floats on the swell (hidden below the surface: Jonah thrown in, the great
 * fish rising), `under` is drawn under the surface seen through the water (the fish below, Jonah sinking), `front` rides
 * the near wave crests. `shipProps` passes sail, cargo, jettison, oars, roll to the ship. rain defaults to storm; lightning
 * lists frames for bolts. Screen anchors: swell line y = p(640, 1180) (± up to p(76, 92) at full storm); near crests
 * y ≈ p(850, 1440).
 */
export const ShipStormSet: React.FC<{
  cam: CamT;
  seed: string;
  tod?: number;
  storm?: number;
  sx?: number;
  ss?: number;
  ship?: boolean;
  shipProps?: Partial<React.ComponentProps<typeof TarshishShip>>;
  crew?: React.ReactNode;
  below?: React.ReactNode;
  onWater?: React.ReactNode;
  under?: React.ReactNode;
  front?: React.ReactNode;
  fx?: React.ReactNode;
  rain?: number;
  lightning?: number[];
  sky?: SkyP;
  shore?: boolean;
}> = ({ cam, seed, tod = 0.45, storm = 1, sx, ss, ship = true, shipProps, crew, below, onWater, under, front, fx, rain, lightning = [], sky, shore = false }) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const seaHz = p(500, 930);
  const seaY = p(640, 1180);
  const x = sx ?? p(960, 540);
  const s = ss ?? p(0.6, 0.48);
  const A = p(10, 12) + storm * p(66, 80);
  const kx1 = 0.0045;
  const kx2 = 0.011;
  const w1 = 0.035 + storm * 0.02;
  const sea = (xx: number) => seaY + A * (0.62 * Math.sin(xx * kx1 + f * w1) + 0.38 * Math.sin(xx * kx2 - f * w1 * 1.6 + 1.3));
  const slope = (xx: number) => A * (0.62 * kx1 * Math.cos(xx * kx1 + f * w1) + 0.38 * kx2 * Math.cos(xx * kx2 - f * w1 * 1.6 + 1.3));
  const nearY = p(850, 1440);
  const A2 = p(12, 14) + storm * p(60, 70);
  const sea2 = (xx: number) => nearY + A2 * (0.6 * Math.sin(xx * 0.0032 + f * w1 * 1.2 + 2) + 0.4 * Math.sin(xx * 0.009 - f * w1 * 2 + 0.4));
  const pitch = ((Math.atan(slope(x)) * 180) / Math.PI) * 0.55;
  const water = mixHex("#2A4A60", "#1A2A34", storm * 0.7);
  const deep = mixHex("#0A1A26", "#04080C", storm);
  const crestXs = (yfun: (xx: number) => number) => {
    const out: number[] = [];
    for (let xx = -200; xx <= W + 200; xx += 24) {
      const a = yfun(xx - 24);
      const b = yfun(xx);
      const c = yfun(xx + 24);
      if (b < a && b < c) out.push(xx);
    }
    return out;
  };
  const foam = storm > 0.25;
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} storm={storm * 0.9} clouds={0.3 + storm * 0.6} hzY={seaHz} sun={storm < 0.4 ? { x: p(1500, 820), y: p(300, 700), a: 1 - storm * 2 } : null} {...sky} />
      {shore ? (
        <Band depth={0.12} ridge={{ base: seaHz - 4, amp: 30, seed: `${seed}sh` }} peaks fill="#5A6070" haze={0.6} edge={0.3} k={K.far} />
      ) : null}
      <Water depth={0.2} y={seaHz} color={mixHex("#3A5A70", "#2A3440", storm)} deep={deep} haze={0.3} rough={storm * 0.4} k={K.far} />
      <Band depth={0.6} gy={sea} k={K.mid}>
        {onWater}
        {ship ? <TarshishShip x={x} s={s} storm={storm} pitch={pitch} heave={0} crew={crew} below={below} seed={`${seed}ms`} {...shipProps} /> : null}
      </Band>
      <Band depth={0.6} shape={sea} fill={water} fill2={deep} haze={0.05} edge={0.6} k={K.mid}>
        <g opacity={0.5}>{under}</g>
        {foam
          ? crestXs(sea).map((cx, i) => (
              <g key={`c${i}`} opacity={Math.min(1, (storm - 0.25) * 2)}>
                <path d={`M ${cx - 40} ${sea(cx - 40) + 2} Q ${cx} ${sea(cx) - 6} ${cx + 46} ${sea(cx + 46) + 4}`} stroke="rgba(236,242,246,0.75)" strokeWidth={3} fill="none" strokeLinecap="round" />
                {Array.from({ length: 4 }, (_, j) => (
                  <circle key={j} cx={cx + range(`${seed}fc${i}${j}`, -30, 40)} cy={sea(cx) - range(`${seed}fy${i}${j}`, 4, 20) - Math.abs(Math.sin(f * 0.1 + j)) * 10} r={range(`${seed}fr${i}${j}`, 1.4, 3)} fill="rgba(236,242,246,0.7)" />
                ))}
              </g>
            ))
          : null}
        {Array.from({ length: 20 }, (_, i) => {
          const u = random(`${seed}ws${i}`);
          const yy = seaY + 30 + u * (H - seaY);
          const xx = mod(random(`${seed}wx${i}`) * (W + 400) + f * (0.6 + u) * (i % 2 ? 1 : -1), W + 400) - 200;
          const ww = 40 + 160 * u;
          return <line key={`wl${i}`} x1={xx - ww / 2} y1={yy} x2={xx + ww / 2} y2={yy} stroke="rgba(200,220,236,0.14)" strokeWidth={1.4} />;
        })}
      </Band>
      <Band depth={0.9} shape={sea2} fill={tone(water, -0.15)} fill2={deep} haze={0} edge={0.7} k={K.near}>
        {front}
        {foam
          ? crestXs(sea2).map((cx, i) => (
              <g key={`n${i}`} opacity={Math.min(1, (storm - 0.25) * 2)}>
                <path d={`M ${cx - 70} ${sea2(cx - 70) + 4} Q ${cx} ${sea2(cx) - 10} ${cx + 80} ${sea2(cx + 80) + 6}`} stroke="rgba(240,246,250,0.85)" strokeWidth={4} fill="none" strokeLinecap="round" />
                {Array.from({ length: 6 }, (_, j) => (
                  <circle key={j} cx={cx + range(`${seed}nc${i}${j}`, -50, 60)} cy={sea2(cx) - range(`${seed}ny${i}${j}`, 6, 34) - Math.abs(Math.sin(f * 0.12 + j)) * 16} r={range(`${seed}nr${i}${j}`, 2, 4)} fill="rgba(240,246,250,0.75)" />
                ))}
              </g>
            ))
          : null}
      </Band>
      {storm > 0.3 ? <Dust count={50} seed={`${seed}sp`} area={{ x: 0, y: seaHz, w: W, h: H - seaHz }} color="230,238,244" opacity={0.5 * storm} size={[1, 2.6]} vy={-0.6} drift={2.4} /> : null}
      {(rain ?? storm) > 0.05 ? <Rain intensity={rain ?? storm} angle={18} speed={44} seed={`${seed}rn`} /> : null}
      {lightning.map((at, i) => (
        <Lightning key={i} at={at} x={p(400 + i * 520, 200 + i * 300)} y={seaHz} seed={`${seed}lt${i}`} />
      ))}
      {fx}
    </Stage>
  );
};
