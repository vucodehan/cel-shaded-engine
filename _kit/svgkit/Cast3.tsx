import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Tint } from "./Atmos";
import { range } from "./anim";
import { Svg } from "./Film";
import { useLayout } from "./layout";
import { Look, ROBES } from "./Person";
import { Palm, Reeds } from "./Plants";
import { Tent } from "./Props";
import { Army, BronzeAltar, BronzeSea, FortCity, PersianThrone, SiegeEngine, SiegeRamp, Skyline, SolomonTemple } from "./Props4";
import { Band, Land, LandPreset, Sky, Stage, Water, projectPt, ridgeY, useBand, useBandK, useCam, useLandGeo } from "./Stage";
import { dryGrass, lushGrass } from "./Cast";
import { DAVID_KING } from "./Cast2";

/**
 * Recurring people and places for 1 Kings – Esther, Tobit and Judith, so every film draws them the same way.
 * Colours are fixed per character across films (Elijah's hairy dark-brown mantle, Jezebel's near-black wine, Esther's
 * royal blue with gold). Kings of Israel and Judah wear "crown"; Assyrian and Persian kings "tiara"; Persian officials
 * "turban"; Assyrian soldiers "cone" helmets. Variants carry a suffix (SOLOMON_OLD, TOBIT_BLIND, MORDECAI_SACK).
 */

// ── People ──────────────────────────────────────────────────────────────────────────────

/** Sackcloth: coarse dark goat-hair cloth for mourning and repentance. */
export const SACKCLOTH = "#5E5444";
const GOLD = "#C89A40";

// 1 Kings 1–11: David's last days, Solomon.
export const DAVID_OLD: Look = { ...DAVID_KING, beard: "white" };
/** Solomon in his glory: a golden-ochre robe with a blue sash (distinct from David's blue in 1 Kings 1). */
export const SOLOMON: Look = { robe: "#8E6A2C", head: "crown", sash: "#2E4A80", beard: true };
export const SOLOMON_OLD: Look = { ...SOLOMON, robe: "#76603A", beard: "white" };
export const ADONIJAH: Look = { robe: "#7A3428", head: "hair", sash: GOLD, mantle: "#9A6A40", beard: true };
export const BENAIAH: Look = { robe: ROBES.teal, head: "helmet", armor: "#8A7448", short: true, beard: true, hold: "spear" };
export const BATHSHEBA_OLD: Look = { robe: ROBES.teal, head: "veil", mantle: "#A89A80", sash: GOLD };
// 1 Kings 11–12: the kingdom splits.
export const REHOBOAM: Look = { robe: "#4A3A70", head: "crown", sash: GOLD, beard: true };
export const JEROBOAM: Look = { robe: ROBES.red, head: "cloth", mantle: "#A8763C", beard: true, short: true };
export const JEROBOAM_KING: Look = { robe: ROBES.red, head: "crown", sash: GOLD, beard: true };
/** Ahijah wears the new cloak he tears into twelve pieces: a fresh green robe. */
export const AHIJAH: Look = { robe: "#5A6E58", head: "hood", mantle: "#6A6A5A", beard: "white", staff: "staff" };
// 1 Kings 17 – 2 Kings 2: Elijah.
/** Elijah: a garment of hair, a leather belt, a wild beard, a dark-brown hood. ELIJAH_BARE drops the hood (use it with
 *  hold: "mantle" when he rolls up his cloak to strike the Jordan). */
export const ELIJAH: Look = { robe: "#4A3626", head: "hood", mantle: "#5A4230", sash: "#8A5A32", beard: "wild", hairy: true, skin: "#7A4E34" };
export const ELIJAH_BARE: Look = { ...ELIJAH, head: "hair" };
/** Elisha: bald, bearded, a plain olive-sand robe. Give him hold: "mantle" once he takes up Elijah's cloak. */
export const ELISHA: Look = { robe: "#66604A", head: "bare", beard: true, sash: "#4A3A2A" };
export const GEHAZI: Look = { robe: ROBES.sand, head: "cloth", mantle: "#8A7A5A", beard: true, short: true };
export const GEHAZI_LEPER: Look = { ...GEHAZI, skin: "#C8BCB0", hand: "#EEEAE2" };
export const AHAB: Look = { robe: ROBES.wine, head: "crown", sash: GOLD, beard: true };
export const JEZEBEL: Look = { robe: "#2A1620", head: "veil", mantle: "#5A1E30", sash: "#E0B050", diadem: true };
export const OBADIAH: Look = { robe: ROBES.indigo, head: "cloth", mantle: "#7A7A90", sash: GOLD, beard: true };
export const BAAL_PROPHET = (i = 0): Look => ({ robe: ["#9A3A1E", "#B0561E", "#7A2A1A"][i % 3], head: i % 3 === 1 ? "hair" : "bare", sash: "#E0A040", beard: i % 2 === 0, short: i % 4 === 3 });
/** The widow of Zarephath and her son. */
export const WIDOW: Look = { robe: "#4A4440", head: "veil", mantle: "#6A625A" };
export const WIDOW_SON: Look = { robe: ROBES.sand, head: "hair", child: 0.75 };
export const NABOTH: Look = { robe: ROBES.olive, head: "cloth", mantle: "#8A8A60", beard: true };
export const AHAZIAH: Look = { robe: "#7A3A4A", head: "crown", sash: GOLD, beard: true };
// 2 Kings 4–6: Elisha.
export const SHUNAMMITE: Look = { robe: "#5A4A7A", head: "veil", mantle: "#C8B08A", sash: GOLD };
export const SHUNAMMITE_SON: Look = { robe: ROBES.linen, head: "hair", child: 0.8 };
/** Naaman, commander of Aram: gilded scale armour, helmet, a rich crimson cloak. NAAMAN_PLAIN for dipping in the Jordan. */
export const NAAMAN: Look = { robe: "#8A2A30", head: "helmet", armor: "#9A8050", sash: GOLD, beard: true, short: true };
export const NAAMAN_PLAIN: Look = { robe: ROBES.linen, head: "hair", beard: true, short: true };
export const ARAMEAN = (i = 0): Look => ({ robe: ["#6A3A2A", "#4A4A5A", "#7A5A3A"][i % 3], head: "helmet", armor: "#6A6A6E", short: true, beard: true, hold: i % 2 ? "spear" : "sword" });
// 2 Kings 17–19: Samaria falls; Hezekiah and Assyria.
export const HOSHEA: Look = { robe: "#5A4A2A", head: "crown", sash: GOLD, beard: true };
/** Assyrian soldiers: pointed iron helmets, grey scale armour, spears and round shields; dark red, slate or brown tunics. */
export const ASSYRIAN = (i = 0): Look => ({ robe: ["#6A2A24", "#3A3A4A", "#5A3A2A"][i % 3], head: "cone", armor: "#7A7468", short: true, beard: true, hold: i % 3 === 2 ? "shield" : "spear" });
export const RABSHAKEH: Look = { robe: "#6A2430", head: "turban", cap: "#B89A60", mantle: "#3A2A2A", sash: GOLD, beard: true };
export const SENNACHERIB: Look = { robe: "#6A2A2A", head: "tiara", cap: "#E6DCC6", sash: "#E0B050", beard: true };
export const HEZEKIAH: Look = { robe: "#2E5A4A", head: "crown", sash: GOLD, beard: true };
export const HEZEKIAH_SACK: Look = { robe: SACKCLOTH, head: "hair", beard: true };
export const ISAIAH: Look = { robe: "#3A4A3A", head: "cloth", mantle: "#7A8A9A", sash: "#5A4A3A", beard: true, staff: "staff" };
export const ELIAKIM: Look = { robe: "#4A3A6A", head: "cloth", mantle: "#C8B890", sash: GOLD, beard: true };
// 2 Kings 22–25: Josiah; the fall of Judah.
export const JOSIAH: Look = { robe: "#2E5E6E", head: "crown", sash: GOLD, beard: true };
export const JOSIAH_BOY: Look = { robe: "#2E5E6E", head: "crown", sash: GOLD, child: 0.7 };
/** Hilkiah the high priest: white linen, a blue-purple mantle, a gold sash. */
export const HILKIAH: Look = { robe: ROBES.white, head: "cloth", mantle: "#4A3A7A", sash: GOLD, beard: "white" };
export const SHAPHAN: Look = { robe: "#7A6A50", head: "cloth", mantle: "#5A5A4A", beard: true, hold: "scroll" };
export const HULDAH: Look = { robe: "#3A4A5A", head: "veil", mantle: "#C8C0B0" };
/** Chaldean soldiers: rounded bronze helmets, bronze scales, Ishtar-gate blue and ochre tunics (distinct from Assyria). */
export const BABYLONIAN = (i = 0): Look => ({ robe: ["#2A4A7A", "#8A6A2A", "#2A3A5A"][i % 3], head: "helmet", armor: "#9A7A44", short: true, beard: true, hold: i % 3 === 2 ? "bow" : "spear" });
export const NEBUZARADAN: Look = { robe: "#2A3E6A", head: "turban", cap: "#C8A050", armor: "#9A7A44", sash: GOLD, beard: true, short: true };
export const ZEDEKIAH: Look = { robe: "#5A3A5A", head: "crown", sash: GOLD, beard: true };
/** Zedekiah led away: plain robe, the blinded eye shown only as a pale film (restraint). */
export const ZEDEKIAH_CAPTIVE: Look = { robe: "#4A4440", head: "hair", beard: true, blind: true };
export const JEHOIACHIN: Look = { robe: "#3A5A4A", head: "crown", sash: GOLD, beard: true };
/** Captives in plain grey and brown; every third is a woman. */
export const EXILE = (i = 0): Look =>
  i % 3 === 0
    ? { robe: ["#5A5650", "#5E4A3A", "#6A6458"][Math.floor(i / 3) % 3], head: "veil", mantle: ["#6A625A", "#7A6A58", "#5A544C"][(i >> 1) % 3] }
    : { robe: ["#5A5650", "#5E4A3A", "#6A6458", "#4A4238"][i % 4], head: i % 4 === 1 ? "hair" : "cloth", mantle: "#6A625A", beard: true, short: i % 5 === 2 };
// Ezra, Nehemiah, Esther: Persia.
export const CYRUS: Look = { robe: "#5A2A6A", head: "tiara", cap: "#E8DFC8", sash: "#E0B050", beard: true };
export const DARIUS: Look = { robe: "#2A3A6A", head: "tiara", cap: "#D8B868", sash: "#E0B050", beard: true };
export const ARTAXERXES: Look = { robe: "#6A2A3A", head: "tiara", cap: "#E8DFC8", sash: "#E0B050", beard: true };
/** Ahasuerus (Xerxes): royal purple, a gold tiara. Hold "scepter" with the arm out ([90, 0]) to extend it to Esther. */
export const AHASUERUS: Look = { robe: "#4A2266", head: "tiara", cap: "#E0B050", sash: "#E8C060", beard: true };
/** Persian officials and guards: turbans, long robes; even-numbered ones carry spears. */
export const PERSIAN = (i = 0): Look => ({ robe: ["#7A5A2A", "#2A4A6A", "#6A2A3A", "#4A5A3A"][i % 4], head: "turban", cap: ["#D8CCB0", "#C8A060", "#B8B0A0"][i % 3], sash: GOLD, beard: true, hold: i % 2 === 0 ? "spear" : null });
export const ZERUBBABEL: Look = { robe: "#3A5A7A", head: "cloth", mantle: "#C8B890", sash: GOLD, beard: true };
export const JESHUA: Look = { robe: ROBES.white, head: "cloth", mantle: "#E8E0CC", sash: "#3A3A7A", beard: true };
export const TATTENAI: Look = { robe: "#6A4A2A", head: "turban", cap: "#E0D0A8", sash: GOLD, beard: true };
/** Nehemiah: the king's cupbearer in Persian court dress (add hold: "cup" at court). */
export const NEHEMIAH: Look = { robe: "#2A5A5A", head: "turban", cap: "#E8DCC0", sash: GOLD, beard: true };
export const SANBALLAT: Look = { robe: "#5A2A2A", head: "cloth", mantle: "#8A5A3A", sash: "#9A7A3A", beard: true };
export const TOBIAH: Look = { robe: "#3A3A2A", head: "turban", cap: "#8A7A5A", beard: true };
/** Jewish builders of the wall: one hand on the work, the other on a weapon (Nehemiah 4:17). */
export const BUILDER = (i = 0): Look => ({ robe: [ROBES.sand, ROBES.brown, ROBES.olive, ROBES.umber][i % 4], head: i % 3 ? "cloth" : "hair", short: true, beard: i % 2 === 0, hold: (["stone", "mallet", "sword", "basket", "spear"] as const)[i % 5] });
// Tobit.
export const TOBIT: Look = { robe: "#5A5A6A", head: "cloth", mantle: "#8A8070", beard: "white" };
export const TOBIT_BLIND: Look = { ...TOBIT, blind: true, staff: "staff" };
export const ANNA: Look = { robe: "#6A4A3A", head: "veil", mantle: "#9A8A7A" };
export const TOBIAS: Look = { robe: "#3A5A7A", head: "hair", sash: "#9A6A3A", short: true };
export const SARAH: Look = { robe: "#7A3A50", head: "veil", mantle: "#EDE4D2", sash: "#E0B050", diadem: true };
export const RAGUEL: Look = { robe: ROBES.brown, head: "cloth", mantle: "#A89A7A", beard: true };
export const EDNA: Look = { robe: "#4A5A4A", head: "veil", mantle: "#8A7A6A" };
/** Raphael disguised as Azarias, a traveller: a plain good oatmeal robe and a staff; RAPHAEL_ANGEL when he is revealed. */
export const RAPHAEL: Look = { robe: "#BCB29A", head: "hair", sash: "#8A7A5A", staff: "staff" };
export const RAPHAEL_ANGEL: Look = { robe: "#F2ECDD", head: "hair", mantle: "#FFF6DE", glow: 0.9, staff: "staff" };
// Judith.
export const JUDITH_WIDOW: Look = { robe: SACKCLOTH, head: "veil", mantle: "#4A4238" };
export const JUDITH: Look = { robe: "#7A2A5A", head: "veil", mantle: "#E0C890", sash: "#E8C060", diadem: true };
export const JUDITH_MAID: Look = { robe: ROBES.sand, head: "veil", mantle: "#7A6A50", hold: "bundle" };
/** Holofernes: Assyrian general, gilded scale armour, iron cone helmet; HOLOFERNES_FEAST for the banquet tent. */
export const HOLOFERNES: Look = { robe: "#5A1E2A", head: "cone", armor: "#B8963E", sash: "#E8C060", beard: true, short: true };
export const HOLOFERNES_FEAST: Look = { robe: "#5A1E2A", head: "hair", sash: "#E8C060", mantle: "#B8963E", beard: true };
export const ACHIOR: Look = { robe: "#5A4A6A", head: "cloth", mantle: "#9A8A6A", sash: "#9A7A3A", beard: true };
export const UZZIAH: Look = { robe: ROBES.grey, head: "cloth", mantle: "#8A8070", beard: "white", staff: "staff" };
export const BAGOAS: Look = { robe: "#6A5A2A", head: "turban", cap: "#D8C8A0", sash: GOLD };
// Esther.
export const ESTHER: Look = { robe: "#2E4E86", head: "veil", mantle: "#E8DCC0", sash: "#E8C060", diadem: true };
export const VASHTI: Look = { robe: "#6A2A2A", head: "veil", mantle: "#C8A878", sash: "#E8C060", diadem: true };
export const MORDECAI: Look = { robe: "#4A4A5A", head: "cloth", mantle: "#7A8AA0", beard: "white" };
export const MORDECAI_SACK: Look = { robe: SACKCLOTH, head: "hair", beard: "white" };
/** Mordecai honoured: royal blue and white, a gold circlet over a white turban (Esther 6:11, 8:15). */
export const MORDECAI_HONOURED: Look = { robe: "#2E4A80", head: "turban", cap: "#E8E0CC", sash: "#E8C060", beard: "white", diadem: true };
/** Haman: blood-red court robe, a tall black hat. */
export const HAMAN: Look = { robe: "#6A1A1E", head: "tiara", cap: "#1E1616", mantle: "#2A1A1A", sash: GOLD, beard: true };

// ── Places ──────────────────────────────────────────────────────────────────────────────

type CamT = ReturnType<typeof useCam>;
type SkyP = React.ComponentProps<typeof Sky>;
type SetP = { cam: CamT; seed: string; tod?: number; near?: React.ReactNode; mid?: React.ReactNode; far?: React.ReactNode; front?: React.ReactNode; fx?: React.ReactNode; sky?: SkyP; storm?: number };

/** Flagstone paving on the current band's ground (a temple court, a palace yard), drawn in perspective. */
export const Paving: React.FC<{ color?: string; rows?: number }> = ({ color = "30,22,16", rows = 8 }) => {
  const band = useBand();
  const { W } = useLayout();
  const k = band.k;
  const ds = Array.from({ length: rows }, (_, i) => 4 + Math.pow(i / (rows - 1), 1.6) * 260);
  const line = (d: number) => {
    const pts: string[] = [];
    for (let xx = -300; xx <= W + 300; xx += 40) pts.push(`${xx === -300 ? "M" : "L"} ${xx} ${(band.gy(xx) + d * k).toFixed(1)}`);
    return pts.join(" ");
  };
  return (
    <g>
      {ds.map((d, i) => (
        <path key={i} d={line(d)} stroke={`rgba(${color},${0.28 + 0.1 * (i / rows)})`} strokeWidth={1 + i * 0.15} fill="none" />
      ))}
      {ds.slice(0, -1).map((d, i) => {
        const step = (70 + i * 34) * k;
        const n = Math.ceil((W + 600) / step);
        return Array.from({ length: n }, (_, j) => {
          const xx = -300 + j * step + (i % 2) * step * 0.5;
          const lean = (xx - W / 2) * 0.06 * (i + 1) * 0.15;
          return <line key={`${i}-${j}`} x1={xx} y1={band.gy(xx) + d * k} x2={xx + lean} y2={band.gy(xx) + ds[i + 1] * k} stroke={`rgba(${color},0.25)`} strokeWidth={1} />;
        });
      })}
    </g>
  );
};

/** An ashlar court wall with a course of cedar beams on top (1 Kings 6:36), along the band's ground from x0 to x1.
 *  Monumental scale like the temple: h = 56 is about one and a half men. */
const CourtWall: React.FC<{ x0: number; x1: number; h?: number; seed: string }> = ({ x0, x1, h = 56, seed }) => {
  const band = useBand();
  const k = band.k;
  const pts: string[] = [];
  const pb: string[] = [];
  for (let xx = x0; xx <= x1; xx += 20) {
    pts.push(`${xx === x0 ? "M" : "L"} ${xx} ${(band.gy(xx) - h * k).toFixed(1)}`);
    pb.unshift(`L ${xx} ${(band.gy(xx) + 2).toFixed(1)}`);
  }
  return (
    <g>
      <path d={`${pts.join(" ")} ${pb.join(" ")} Z`} fill="#8E7C60" stroke="rgba(255,220,170,0.35)" strokeWidth={1.2} />
      {[1, 2].map((r) => (
        <path key={r} d={pts.join(" ")} transform={`translate(0 ${((h * r) / 3.6) * k})`} stroke="rgba(40,30,20,0.35)" strokeWidth={1} fill="none" />
      ))}
      <path d={pts.join(" ")} stroke="#5A3A22" strokeWidth={7 * k} fill="none" />
      {Array.from({ length: Math.floor((x1 - x0) / (60 * k)) }, (_, i) => {
        const xx = x0 + (i + 0.5) * 60 * k + range(`${seed}${i}`, -6, 6);
        return <line key={i} x1={xx} y1={band.gy(xx) - h * k * 0.72} x2={xx} y2={band.gy(xx) - h * k * 0.36} stroke="rgba(40,30,20,0.3)" strokeWidth={1} />;
      })}
    </g>
  );
};

/**
 * Jerusalem's temple court: SolomonTemple in the middle band at `tx` (scale `ts`), ashlar court walls running off to the
 * sides, a paved court in the near band with the bronze altar at `ax` (and the bronze Sea at `sx` with `sea`).
 * People stand on the near band in front (Person s ≈ 1). Coordinates for a scene (geo = useLandGeo(preset, seed),
 * K = useBandK()): temple base y = ridgeY(geo.mid, tx); porch top = base - TEMPLE_H.porch * ts * K.mid; door centre
 * = base - 150 * ts * K.mid; a figure on the temple steps (mid band) is a Person at s ≈ 0.23 * ts; altar fire base
 * = ridgeY(geo.near, ax) - 140 * as * K.near (as = altar scale, default p(0.8, 0.75)).
 *  glow lights the house; cloud fills it with the cloud of glory (doors open; a white haze over the scene);
 *  built 0..1 shows it under construction; burn 0..1 burns it (586 BC: fire, smoke, red sky, broken walls);
 *  second draws the plainer second temple; fire 0..1 lights the altar.
 */
export const TempleSet: React.FC<
  SetP & { tx?: number; ts?: number; ax?: number; as?: number; altar?: boolean; fire?: number; sea?: boolean; sx?: number; glow?: number; cloud?: number; built?: number; burn?: number; second?: boolean; open?: number; preset?: LandPreset }
> = ({ cam, seed, tod = 0.42, near, mid, far, front, fx, sky, storm = 0, tx, ts, ax, as, altar = true, fire = 0, sea = false, sx, glow = 0, cloud = 0, built = 1, burn = 0, second = false, open, preset = "hills" }) => {
  const { p, W } = useLayout();
  const x = tx ?? p(1150, 600);
  const s = ts ?? p(0.95, 0.95);
  const K = useBandK();
  const half = 0.6 * 560 * s * K.mid + 40;
  const night = tod > 0.74 || tod < 0.22;
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={Math.max(storm, burn * 0.55)}
      colors={{ mid: "#8E8068", near: "#857560", front: "#3E3428" }}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3, stars: night ? 1 : 0 }}
      far={far}
      mid={
        <>
          <CourtWall x0={-300} x1={x - half} seed={`${seed}cw1`} />
          <CourtWall x0={x + half} x1={W + 300} seed={`${seed}cw2`} />
          <SolomonTemple x={x} s={s} glow={glow + (night && burn <= 0 ? 0.3 : 0)} cloud={cloud} built={built} burn={burn} second={second} open={open} seed={`${seed}t`} />
          {mid}
        </>
      }
      near={
        <>
          <Paving />
          {sea ? <BronzeSea x={sx ?? p(1640, 830)} s={p(0.7, 0.62)} /> : null}
          {altar ? <BronzeAltar x={ax ?? p(470, 230)} s={as ?? p(0.8, 0.75)} fire={fire} seed={`${seed}al`} /> : null}
          {near}
        </>
      }
      front={front}
      fx={
        <>
          {cloud > 0 ? <Tint color="#FFF6E6" opacity={0.18 * cloud} blend="screen" /> : null}
          {burn > 0 ? <Tint color="#FF5A1A" opacity={0.16 * Math.min(1, burn * 2)} blend="soft-light" /> : null}
          {fx}
        </>
      }
    />
  );
};

/**
 * The royal hall of the Persian kings at Susa (Esther, Nehemiah 1–2): tall fluted columns with double-bull capitals, a
 * glazed-brick frieze of striding lions (or archers) in blue and gold, white and blue linen hangings tied with purple
 * cords, hanging lamps, a raised PersianThrone at `tx` facing left (tflip false: right). Interior like HallSet: children
 * stand on the floor (near band, Person s ≈ 1). `king` is drawn seated on the throne (a Person at x = 0, y = 0 with
 * sit: 1; it faces the throne's way). The throne (scale p(0.95, 0.9)) has its dais top at
 * ridgeY(useLandGeo("plain", seed).near, tx) - 36 * p(0.95, 0.9) * K.near.
 * `night` dims it to lamplight, `lamp` sets the lamps.
 */
export const CourtSet: React.FC<{
  cam: CamT;
  seed: string;
  children?: React.ReactNode;
  fx?: React.ReactNode;
  tx?: number;
  tflip?: boolean;
  throne?: boolean;
  king?: React.ReactNode;
  canopy?: boolean;
  night?: number;
  lamp?: number;
  frieze?: "lions" | "archers";
  hangings?: boolean;
}> = ({ cam, seed, children, fx, tx, tflip = true, throne = true, king, canopy = true, night = 0.3, lamp = 1, frieze = "lions", hangings = true }) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const flick = 0.88 + 0.12 * Math.sin(f * 0.33) * Math.sin(f * 0.11 + 1);
  const cols = p(5, 3);
  const ttx = tx ?? p(1440, 790);
  const capY = p(150, 430);
  const fy0 = p(330, 760);
  const fh = p(96, 90);
  const colW = p(50, 56);
  const colX = (i: number) => (W / cols) * (i + 0.5);
  const blue = "#24427A";
  const goldF = "#D8A840";
  const lion = (lx: number, ly: number, sc: number, key: string) => (
    <path
      key={key}
      transform={`translate(${lx} ${ly}) scale(${sc})`}
      d="M -30 0 L -26 -16 Q -30 -24 -20 -26 L 10 -28 Q 18 -40 30 -36 Q 38 -30 34 -22 L 30 -16 L 32 0 L 26 0 L 24 -12 L 14 -12 L 12 0 L 6 0 L 4 -14 L -14 -14 L -16 0 L -22 0 L -22 -12 Q -34 -12 -40 -24 Q -34 -16 -26 -18 L -24 0 Z"
      fill={goldF}
    />
  );
  const archer = (lx: number, ly: number, sc: number, key: string) => (
    <g key={key} transform={`translate(${lx} ${ly}) scale(${sc})`}>
      <path d="M -10 0 L -8 -40 Q 0 -46 8 -40 L 10 0 Z" fill="#E8DCC0" />
      <path d="M -8 -40 L -6 -20 L 6 -20 L 8 -40 Z" fill={goldF} />
      <circle cx={2} cy={-50} r={6} fill="#5A3A28" />
      <ellipse cx={1} cy={-55} rx={7} ry={4} fill={goldF} />
      <line x1={14} y1={4} x2={16} y2={-66} stroke="#C8B080" strokeWidth={2.4} />
      <path d={`M 16 -66 l -3 7 l 6 0 Z`} fill="#E8DCC0" />
    </g>
  );
  const lamps = Array.from({ length: cols - 1 }, (_, i) => ({ x: (W / cols) * (i + 1), y: capY + p(250, 330) }));
  return (
    <Stage cam={cam} tod={0.5 + night * 0.4} rim="255,196,130" rimA={0.55}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #1E1612 0%, #3A2C20 55%, #1A120C 100%)" }} />
      <Band depth={0.3} k={K.mid}>
        <rect x={-400} y={capY + p(40, 40)} width={W + 800} height={H} fill="#4E3E30" />
        {Array.from({ length: 30 }, (_, r) => (
          <line key={r} x1={-400} y1={capY + p(40, 40) + r * 24} x2={W + 400} y2={capY + p(40, 40) + r * 24} stroke="rgba(30,20,12,0.25)" strokeWidth={1} />
        ))}
        <rect x={-400} y={fy0 - 14} width={W + 800} height={fh + 28} fill="#E8DCC0" opacity={0.85} />
        <rect x={-400} y={fy0} width={W + 800} height={fh} fill={blue} />
        {Array.from({ length: Math.ceil((W + 800) / 18) }, (_, i) => (
          <g key={`rz${i}`}>
            <circle cx={-400 + i * 18 + 9} cy={fy0 - 7} r={4} fill={i % 2 ? goldF : blue} />
            <circle cx={-400 + i * 18 + 9} cy={fy0 + fh + 7} r={4} fill={i % 2 ? goldF : blue} />
          </g>
        ))}
        {Array.from({ length: Math.ceil((W + 800) / 32) }, (_, i) => (
          <line key={`bk${i}`} x1={-400 + i * 32} y1={fy0} x2={-400 + i * 32} y2={fy0 + fh} stroke="rgba(10,20,40,0.35)" strokeWidth={1} />
        ))}
        {[0.33, 0.66].map((t) => (
          <line key={t} x1={-400} y1={fy0 + fh * t} x2={W + 400} y2={fy0 + fh * t} stroke="rgba(10,20,40,0.35)" strokeWidth={1} />
        ))}
        {Array.from({ length: Math.ceil((W + 800) / p(150, 130)) }, (_, i) =>
          frieze === "lions" ? lion(-400 + i * p(150, 130) + 60, fy0 + fh * 0.84, (fh / 44) * 0.9, `l${i}`) : archer(-400 + i * p(110, 100) + 50, fy0 + fh * 0.92, (fh / 70) * 0.95, `a${i}`),
        )}
        <rect x={-400} y={capY + p(18, 18)} width={W + 800} height={p(26, 24)} fill="#5A3A22" stroke="rgba(255,200,140,0.25)" strokeWidth={1.2} />
        {hangings
          ? Array.from({ length: cols - 1 }, (_, i) => {
              const a = colX(i) + colW / 2;
              const b = colX(i + 1) - colW / 2;
              const top = capY + p(44, 42);
              const sag = p(70, 60);
              const c1 = i % 2 ? "#2E4E86" : "#E8E4DA";
              const c2 = i % 2 ? "#E8E4DA" : "#2E4E86";
              return (
                <g key={`hg${i}`} opacity={0.92}>
                  <path d={`M ${a} ${top} Q ${(a + b) / 2} ${top + sag * 2} ${b} ${top} L ${b} ${top + 16} Q ${(a + b) / 2} ${top + sag * 2 + 20} ${a} ${top + 16} Z`} fill={c1} />
                  {[a, b].map((xx, j) => (
                    <g key={j}>
                      <path d={`M ${xx} ${top} L ${xx + (j ? -34 : 34)} ${top} Q ${xx + (j ? -26 : 26)} ${top + p(160, 150)} ${xx + (j ? -10 : 10)} ${top + p(300, 330)} L ${xx} ${top + p(300, 330)} Z`} fill={c2} />
                      <circle cx={xx + (j ? -14 : 14)} cy={top + p(150, 150)} r={5} fill="#6A2A6A" />
                      <circle cx={xx + (j ? -4 : 4)} cy={top + 6} r={4} fill="#C8CCD4" />
                    </g>
                  ))}
                </g>
              );
            })
          : null}
        {Array.from({ length: cols }, (_, i) => {
          const x = colX(i);
          return (
            <g key={`c${i}`}>
              <rect x={x - colW / 2} y={capY + p(60, 56)} width={colW} height={H} fill="#B8A890" stroke="rgba(255,220,170,0.35)" strokeWidth={1.4} />
              {[-0.3, -0.1, 0.1, 0.3].map((u) => (
                <line key={u} x1={x + colW * u} y1={capY + p(64, 60)} x2={x + colW * u} y2={H} stroke="rgba(60,44,30,0.35)" strokeWidth={1.4} />
              ))}
              <rect x={x - colW / 2 + 4} y={capY + p(60, 56)} width={7} height={H} fill="rgba(255,236,200,0.18)" />
              <path d={`M ${x - colW * 0.7} ${capY + p(60, 56)} Q ${x - colW * 0.8} ${capY + p(44, 40)} ${x - colW * 0.55} ${capY + p(36, 34)} L ${x + colW * 0.55} ${capY + p(36, 34)} Q ${x + colW * 0.8} ${capY + p(44, 40)} ${x + colW * 0.7} ${capY + p(60, 56)} Z`} fill="#A8987E" />
              {[-1, 1].map((d) => (
                <g key={d} transform={`translate(${x} ${capY + p(36, 34)}) scale(${d * p(1, 1.05)} 1)`}>
                  <path d="M 0 0 L 0 -40 L 34 -40 Q 54 -46 66 -34 Q 72 -24 62 -18 L 50 -16 L 50 0 L 40 0 L 40 -12 L 30 -12 L 30 0 Z" fill="#8A7A62" stroke="rgba(255,220,170,0.35)" strokeWidth={1.1} />
                  <path d="M 56 -40 Q 62 -54 74 -52" stroke="#C8B48A" strokeWidth={3} fill="none" strokeLinecap="round" />
                  <circle cx={60} cy={-30} r={2} fill="#2A1E14" />
                </g>
              ))}
            </g>
          );
        })}
        {lamps.map((l, i) => (
          <g key={`lp${i}`}>
            <line x1={l.x} y1={capY + p(44, 42)} x2={l.x} y2={l.y - 12} stroke="#8A7048" strokeWidth={1.4} />
            <path d={`M ${l.x - 16} ${l.y - 12} Q ${l.x} ${l.y + 8} ${l.x + 16} ${l.y - 12} Z`} fill="#9A7A3A" />
            {lamp > 0 ? <ellipse cx={l.x} cy={l.y - 20} rx={4} ry={9 * flick} fill="#FFB050" opacity={lamp} /> : null}
          </g>
        ))}
      </Band>
      <Band depth={0.8} ridge={geo.near} fill="#5E4C3C" fill2="#22180F" haze={0} edge={0.25} k={K.near}>
        <Paving color="20,14,10" />
        <path
          d={`M ${ttx - p(900, 600)} ${ridgeY(geo.near, ttx - p(900, 600)) + 8} L ${ttx + p(60, 40)} ${ridgeY(geo.near, ttx) + 8} L ${ttx + p(20, 10)} ${ridgeY(geo.near, ttx) + p(70, 80)} L ${ttx - p(860, 560)} ${ridgeY(geo.near, ttx - p(900, 600)) + p(70, 80)} Z`}
          fill="#6A1E28"
          opacity={0.7}
          stroke="rgba(220,180,90,0.45)"
          strokeWidth={2}
        />
        {throne ? <PersianThrone x={ttx} s={p(0.95, 0.9)} flip={tflip} canopy={canopy} seat={king} /> : null}
        {children}
      </Band>
      {lamps.map((l, i) => {
        const q = projectPt(cam, W, H, l.x, l.y - 20, 0.3);
        return <Glow key={i} x={q.x} y={q.y} size={p(560, 500)} color="255,170,90" opacity={lamp * (0.25 + 0.3 * night) * flick} />;
      })}
      <Glow x={W * 0.5} y={p(260, 560)} size={p(1700, 1400)} color="255,190,120" opacity={0.22 * (1 - 0.5 * night)} />
      <Tint color="#06050A" opacity={0.3 * night} />
      {fx}
    </Stage>
  );
};

/**
 * A walled city under siege (Samaria 2 Kings 17, Jerusalem 2 Kings 18 and 25, Lachish, Bethulia in Judith): a FortCity on
 * the middle ridge at `cx` (width cw, scale cs) and the enemy before it on the left: an encampment of tents, an Army
 * drawn up (helm "cone" for Assyria, "round" for Babylon), a siege ramp to the wall with an engine (`ramp`, `engine`).
 *  besiege 0..1 brings the army in and builds the ramp; breach 0..1 breaks the wall at the ramp; burn 0..1 burns the city;
 *  smoke adds smoke over the camp; temple puts the temple on the summit (Jerusalem).
 * Coordinates (geo = useLandGeo(preset, seed), K = useBandK(), local units × cs × K.mid): the wall walk is at
 * ridgeY(geo.mid, x) - h * cs * K.mid with h = 130 (defenders: Person s ≈ 0.23 * cs); the city spans about
 * cx ± cw * K.mid / 2 and the breach is at screen x = cx - 0.26 * cw * K.mid. Commanders who shout to the wall stand
 * on the near band.
 */
export const SiegeSet: React.FC<
  SetP & { cx?: number; cw?: number; cs?: number; besiege?: number; breach?: number; burn?: number; smoke?: number; helm?: "cone" | "round"; color?: string; ramp?: boolean; engine?: boolean; tents?: boolean; temple?: boolean; lit?: number; preset?: LandPreset; armyTint?: string; march?: number }
> = ({ cam, seed, tod = 0.42, near, mid, far, front, fx, sky, storm = 0, cx, cw, cs, besiege = 1, breach = 0, burn = 0, smoke = 0, helm = "cone", color = "#9A8466", ramp = true, engine = true, tents = true, temple = false, lit, preset = "hills", armyTint, march = 0 }) => {
  const { p } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const geo = useLandGeo(preset, seed);
  const x = cx ?? p(1240, 650);
  const w = cw ?? p(900, 600);
  const s = cs ?? p(1, 0.9);
  const wl = w / s;
  const night = tod > 0.74 || tod < 0.22;
  const km = s * K.mid;
  const bxLocal = -wl * 0.26;
  const wallX = x + bxLocal * km;
  const rampLen = 230;
  const rampX = wallX - rampLen * km;
  const rise = 130 * 0.86;
  const rp = Math.min(1, Math.max(0, (besiege - 0.3) / 0.6));
  const ang = (Math.atan2(rise, rampLen * 0.92) * 180) / Math.PI;
  const ex = rampX + rampLen * 0.62 * km;
  const eyy = ridgeY(geo.mid, rampX) - rise * rp * 0.64 * km;
  const babylon = helm === "round";
  const tint = armyTint ?? (babylon ? "#2A3E6A" : "#6A2A24");
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={Math.max(storm, burn * 0.5)}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.35, stars: night ? 1 : 0 }}
      far={far}
      mid={
        <>
          {tents
            ? Array.from({ length: p(7, 4) }, (_, i) => (
                <Tent key={i} x={p(-60, -60) + i * p(110, 100)} s={0.9} w={range(`${seed}tw${i}`, 120, 170)} light={night ? 0.7 : 0.25} color={i % 2 ? "#8A7A60" : "#7A6A52"} />
              ))
            : null}
          <FortCity x={x} s={s} w={wl} seed={`${seed}fc`} color={color} breach={breach} bx={bxLocal} burn={burn} temple={temple} lit={lit ?? (night ? 0.6 : 0)} gate={wl * 0.12} />
          {ramp ? <SiegeRamp x={rampX} s={s} len={rampLen} rise={rise} p={rp} seed={`${seed}rp`} /> : null}
          {ramp && engine && rp > 0.4 ? <SiegeEngine x={ex} y={eyy} s={s * 0.9} tilt={ang} ram={breach > 0 && breach < 1 ? 0.5 + 0.5 * Math.sin(f * 0.25) : 0} /> : null}
          <Army x0={p(-120, -140)} x1={rampX - p(30, 20)} n={p(30, 14)} rows={3} seed={`${seed}ar`} helm={helm} tint={tint} metal={babylon ? "#A8844A" : "#8A8478"} p={besiege} march={march} banners={p(3, 2)} />
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
          {smoke > 0 ? (
            <Svg>
              <g opacity={smoke}>
                {Array.from({ length: 3 }, (_, i) => (
                  <ellipse key={i} cx={p(200, 120) + i * p(260, 180)} cy={p(520, 980) - i * 20} rx={p(260, 200)} ry={p(60, 50)} fill="rgba(120,110,100,0.18)" />
                ))}
              </g>
            </Svg>
          ) : null}
          {fx}
        </>
      }
    />
  );
};

/**
 * A foreign capital for establishing shots (Nineveh, Babylon, Susa, Ecbatana): its Skyline on the far plain at `cx`
 * (scale cs), a river in front (`river`, the Tigris, Euphrates or Choaspes; false for a plain), palms and reeds on the
 * near bank where people stand (Person s ≈ 1). Susa and Ecbatana get mountains behind. `lit` lights the city at night.
 * The skyline's base is at ridgeY(...) of the city band: hz + p(40, 50).
 */
export const EmpireCity: React.FC<SetP & { kind: "babylon" | "nineveh" | "susa" | "ecbatana"; cx?: number; cs?: number; river?: boolean; lit?: number; palms?: boolean }> = ({
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
  kind,
  cx,
  cs,
  river = true,
  lit,
  palms = true,
}) => {
  const { p, W, hz } = useLayout();
  const g = useLandGeo("plain", seed);
  const K = useBandK();
  const night = tod > 0.74 || tod < 0.22;
  const mountains = kind === "susa" || kind === "ecbatana";
  const plainC = kind === "nineveh" ? "#6A7048" : kind === "babylon" ? "#8A7A56" : "#6A7050";
  const cityBase = hz + p(40, 50);
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} storm={storm} clouds={0.3} stars={night ? 1 : 0} sun={{ x: p(1720, 940), y: p(330, 780) }} {...sky} />
      <Band depth={0.1} ridge={{ base: hz - 10, amp: mountains ? 150 : 22, seed: `${seed}m` }} peaks={mountains} fill={mountains ? "#5A6478" : "#7A7A78"} haze={0.6} edge={0.35} k={K.far}>
        {far}
      </Band>
      <Band depth={0.22} ridge={{ base: cityBase, amp: 6, seed: `${seed}c` }} fill={plainC} haze={0.35} edge={0.35} k={K.far}>
        <Skyline x={cx ?? W / 2} s={cs ?? p(0.95, 0.92)} kind={kind} lit={lit ?? (night ? 0.8 : 0)} seed={`${seed}sk`} palms={palms} />
        {mid}
      </Band>
      {river ? <Water depth={0.34} y={cityBase + p(26, 36)} haze={0.25} k={K.mid} color={kind === "babylon" ? "#3A5A60" : "#2E4E5E"} rough={0.12} /> : null}
      <Band depth={0.8} ridge={g.near} fill={river ? "#5A5236" : "#5C4C32"} haze={0.06} edge={0.55} k={K.near}>
        {river ? <Reeds x0={-300} x1={W + 300} n={36} seed={`${seed}r`} h={64} /> : null}
        {palms ? (
          <>
            <Palm x={p(120, 60)} s={p(1.2, 1.05)} seed={`${seed}p1`} />
            <Palm x={p(1800, 1010)} s={p(1.05, 0.95)} lean={-0.3} seed={`${seed}p2`} />
          </>
        ) : null}
        {near}
        {lushGrass(`${seed}g`)}
      </Band>
      <Band depth={1} ridge={g.front} fill="#33291A" haze={0} edge={0.3} k={K.front}>
        {front}
      </Band>
      {fx}
    </Stage>
  );
};
