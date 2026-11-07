import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { Dust, Glow, GlowS, Mist, Rays, Tint, useUid } from "./Atmos";
import { lerp, mod, range } from "./anim";
import { mixHex, skyAt, tone } from "./color";
import { Svg } from "./Film";
import { Lightning, Rain, Smoke } from "./Fx";
import { useLayout } from "./layout";
import { Herd } from "./Animals";
import { CHILD, ELDER, MAN, WOMAN, dryGrass, lushGrass } from "./Cast";
import { Paving } from "./Cast3";
import { Look, Person, Pose, ROBES, useRig, walkPhase } from "./Person";
import { Bush, Field, Palm, Rock, Tree } from "./Plants";
import { City, House, Well } from "./Props";
import { Hearth, Mountain, StoneWall } from "./Props2";
import {
  Acropolis, BethlehemStar, CityGate, ClassicTemple, Colonnade, Cross, FishingBoat, HerodTemple, HouseFront, JerusalemCity, JudgmentSeat, MerchantShip, PrisonChains,
  RockTomb, RomanHouse, RomeSkyline, SilverShrines, Stable, Stocks, SupperTable, TempleGate, Theatre, UnknownAltar,
} from "./Props6";
import { Band, Land, NoScale, Sky, Stage, Water, projectPt, useBand, useBandK, useCam, useInk, useLandGeo, useRim } from "./Stage";

/**
 * Recurring people and places for the Gospels and Acts (films 67–89), so every film draws them the same way.
 * Jesus is always the cream robe with the deep-red mantle (`drape`) and dark hair and beard; the risen Jesus is in white
 * with a soft glow; the transfigured Jesus radiant white. Mary wears the blue veil. Peter has the golden mantle over a
 * blue-grey tunic, young John the red mantle over green, Judas the dull ochre with a dark hood. Roman soldiers wear the
 * "galea" (red crest) and iron armour with a red tunic; a centurion has a white crest and a red cloak with his vine staff;
 * governors a white toga with a purple edge. Variants carry a suffix (JESUS_RISEN, LAZARUS_BOUND, SAUL_BLIND).
 * Jordan, wilderness and mountain scenes reuse RiverSet, WildSet and MountainSet; the people below fit them.
 */

// ── People ──────────────────────────────────────────────────────────────────────────────

const GOLD = "#C89A40";
const CREAM = "#E6DCC6";

// Jesus.
export const JESUS: Look = { robe: CREAM, drape: "#7E1E24", head: "hair", beard: true, skin: "#74503A" };
export const JESUS_BOY: Look = { robe: CREAM, sash: "#7E1E24", head: "hair", skin: "#74503A", child: 0.55 };
/** At the trial: the crown of thorns and the purple robe (John 19:2), with restraint. */
export const JESUS_THORNS: Look = { ...JESUS, head: "thorns", drape: "#4A2448" };
/** The risen Lord: white garments, a soft glow. */
export const JESUS_RISEN: Look = { ...JESUS, robe: "#F4EEE2", drape: "#E8DECC", glow: 0.55 };
/** Transfigured (Matthew 17:2): face shining like the sun, clothes radiantly white. */
export const JESUS_GLORY: Look = { ...JESUS, robe: "#FFFDF6", drape: "#FFFFFF", glow: 1, halo: 0.6 };
// The nativity and Luke 1–2.
export const MARY: Look = { robe: "#D8CDB8", head: "veil", mantle: "#2E4E86", sash: "#7A2E34" };
/** Mary at the cross and in Acts 1: a darker blue. */
export const MARY_OLDER: Look = { robe: "#5A5048", head: "veil", mantle: "#2A3A62" };
export const JOSEPH: Look = { robe: "#6A5A3E", head: "cloth", mantle: "#8A7A50", beard: true, sash: "#4A3A2A" };
/** Zechariah serving as priest (Luke 1:8): white linen, a linen turban, a blue sash; ZECHARIAH_HOME in plain dress. */
export const ZECHARIAH: Look = { robe: "#E8E2D4", head: "turban", cap: "#F0EAE0", sash: "#2A3A7A", beard: "white" };
export const ZECHARIAH_HOME: Look = { robe: "#5A5A6A", head: "cloth", mantle: "#9A9488", beard: "white" };
export const ELIZABETH: Look = { robe: "#6A4A5A", head: "veil", mantle: "#B8A890" };
/** John the Baptist: camel's hair with a leather belt, a wild beard (Matthew 3:4). */
export const JOHN_BAPTIST: Look = { robe: "#7A5A34", head: "hair", hairy: true, sash: "#4A3020", beard: "wild", skin: "#7A4E34" };
export const GABRIEL: Look = { robe: "#F4EEE2", head: "hair", sash: "#E8C060", glow: 0.9 };
/** The angel at the tomb, his clothing white as snow (Matthew 28:3). */
export const ANGEL_WHITE: Look = { robe: "#FBF8F2", head: "hair", glow: 1 };
export const SHEPHERD = (i = 0): Look => ({
  robe: [ROBES.brown, ROBES.sand, ROBES.umber, ROBES.olive][i % 4],
  head: i % 3 === 2 ? "hood" : "cloth",
  mantle: ["#8A7A5A", "#6A5E4A", "#7A6A50"][i % 3],
  beard: i % 4 === 3 ? false : i % 2 ? "white" : true,
  short: i % 2 === 0,
  staff: i % 2 === 0 ? "crook" : null,
  child: i % 4 === 3 ? 0.7 : 0,
});
/** The Magi (Matthew 2:11), exotic court dress: gold (casket), frankincense (censer) and myrrh (urn). */
export const MAGUS = (i = 0): Look =>
  [
    { robe: "#4A2266", head: "turban", cap: "#E0C070", drape: "#C8A050", beard: "white", sash: GOLD, hold: "gift" },
    { robe: "#1E5A4A", head: "tiara", cap: "#C89090", drape: "#6A2A44", beard: true, sash: GOLD, hold: "urn" },
    { robe: "#7A1E2A", head: "turban", cap: "#F0E8D8", drape: "#2A3A6A", skin: "#4A2E20", sash: GOLD, hold: "censer" },
  ][i % 3] as Look;
export const HEROD: Look = { robe: "#5A1E3A", head: "crown", drape: "#2A1A2A", sash: GOLD, beard: true };
/** Herod Antipas, tetrarch of Galilee (Luke 23:7). */
export const HEROD_ANTIPAS: Look = { robe: "#3A2A5A", head: "crown", drape: "#8A6A2A", sash: GOLD, beard: true };
export const SIMEON: Look = { robe: "#5A5A6A", head: "cloth", mantle: "#C8C0B0", beard: "white" };
export const ANNA_PROPHETESS: Look = { robe: "#3A3A4A", head: "veil", mantle: "#8A8478", staff: "staff" };
// The Twelve.
/** Peter: a golden mantle over a blue-grey tunic; PETER_FISHER in a short working tunic. */
export const PETER: Look = { robe: "#3A5468", drape: "#B8862E", head: "hair", beard: true };
export const PETER_FISHER: Look = { robe: "#3A5468", head: "hair", beard: true, short: true, sash: "#6A4A2A" };
export const ANDREW: Look = { robe: "#5A6A3A", head: "hair", beard: true, short: true, sash: "#6A4A2A" };
export const JAMES: Look = { robe: "#7A4A2A", head: "cloth", mantle: "#9A7A5A", beard: true };
/** John, the youngest of the Twelve: red mantle over green, no beard. */
export const JOHN_APOSTLE: Look = { robe: "#3E6A4A", drape: "#A83A2C", head: "hair" };
export const MATTHEW: Look = { robe: "#5A4A7A", head: "cloth", mantle: "#B8A060", beard: true };
/** Levi at the tax booth (Mark 2:14). */
export const MATTHEW_TAX: Look = { ...MATTHEW, head: "turban", cap: "#C8A060", sash: GOLD, hold: "purse" };
export const THOMAS: Look = { robe: "#4E5E5A", head: "hair", drape: "#7A6A4A", beard: true };
export const PHILIP: Look = { robe: "#7A6A4A", head: "cloth", mantle: "#6A7A8A", beard: true };
export const NATHANAEL: Look = { robe: "#4A5A3A", head: "cloth", mantle: "#9A8A60", beard: true };
/** Judas: dull ochre, a dark hood; give him hold: "purse" (the money bag, John 12:6; thirty silver coins). */
export const JUDAS_ISCARIOT: Look = { robe: "#7A6A2E", head: "hood", mantle: "#3A3428", beard: true };
/** The other apostles (James son of Alphaeus, Thaddaeus, Simon the Zealot, Bartholomew, Matthias). */
export const APOSTLE = (i = 0): Look => ({
  robe: ["#5A4A3A", "#3A4A5A", "#6A3A3A", "#4A5A4A", "#6A5A4A"][i % 5],
  head: (["cloth", "hair", "cloth", "hair", "hood"] as const)[i % 5],
  mantle: ["#8A7A5A", "#7A7A6A", "#9A8A6A", "#6A6A5A", "#7A6A5A"][i % 5],
  drape: i % 2 ? undefined : ["#6A5A3A", "#4A4A5A", "#5A3A2A"][i % 3],
  beard: i % 4 === 3 ? "white" : true,
});
// Disciples and friends.
export const MARY_MAGDALENE: Look = { robe: "#7A2A3A", head: "veil", mantle: "#C8B08A", sash: "#C8A060" };
export const MARTHA: Look = { robe: "#5A6A4A", head: "veil", mantle: "#9A8A6A", sash: "#6A4A2A" };
export const MARY_BETHANY: Look = { robe: "#4A5A7A", head: "veil", mantle: "#C8BCA8" };
export const LAZARUS: Look = { robe: "#7A6A50", head: "cloth", mantle: "#A89A7A", beard: true };
/** Lazarus coming out, bound hand and foot in linen, his face wrapped (John 11:44). */
export const LAZARUS_BOUND: Look = { robe: "#E6DECC", head: "bare", wrapped: true };
export const NICODEMUS: Look = { robe: "#3A3A5A", head: "turban", cap: "#D8CCB0", drape: "#6A5A8A", beard: "white" };
export const SAMARITAN_WOMAN: Look = { robe: "#8A4A2A", head: "veil", mantle: "#D8B880", hold: "jar" };
export const JAIRUS: Look = { robe: "#3A4A6A", head: "turban", cap: "#D8CCB0", drape: "#8A7A5A", beard: true };
export const JAIRUS_DAUGHTER: Look = { robe: "#E2DACA", head: "veil", mantle: "#C8B8A0", child: 0.62 };
/** Zacchaeus, chief tax collector, rich and short (draw him at s ≈ 0.82). */
export const ZACCHAEUS: Look = { robe: "#5A4A7A", head: "turban", cap: "#C8A050", sash: GOLD, beard: true };
export const SIMON_CYRENE: Look = { robe: "#6A5A3A", head: "cloth", mantle: "#9A8A6A", beard: true, skin: "#5A3A28", short: true };
export const JOSEPH_ARIMATHEA: Look = { robe: "#3A4A3A", head: "turban", cap: "#D8D0B8", drape: "#7A6A4A", beard: true };
// Crowds, the sick, the authorities.
export const CROWD = (i = 0): Look => [MAN(i), WOMAN(i), ELDER(i), MAN(i + 3), WOMAN(i + 1), CHILD(i), MAN(i + 5), ELDER(i + 2)][i % 8];
/** The sick, shown with restraint: 0 lame (a staff), 1 blind (a pale film, a staff), 2 a leper (pale skin, hooded),
 *  3 a woman ill for years (Mark 5:25). */
export const SICK = (i = 0): Look =>
  [
    { robe: "#6A6050", head: "cloth", mantle: "#7A7060", beard: true, staff: "staff", short: true },
    { robe: "#5A5048", head: "cloth", mantle: "#6A625A", beard: "white", blind: true, staff: "staff" },
    { robe: "#8A8070", head: "hood", mantle: "#9A9488", skin: "#A89C90", hand: "#D8D2C8", beard: true },
    { robe: "#5A4A4A", head: "veil", mantle: "#7A6A62" },
  ][i % 4] as Look;
export const PHARISEE = (i = 0): Look => ({
  robe: ["#E2DACA", "#3A4A6A", "#6A5A3A"][i % 3],
  head: "turban",
  cap: ["#E8E0CC", "#D8CCB0", "#C8B890"][i % 3],
  drape: ["#3A4A7A", "#C8B890", "#5A2A3A"][i % 3],
  sash: "#2A3A7A",
  beard: i % 2 ? "white" : true,
});
export const SCRIBE = (i = 0): Look => ({ robe: ["#5A5448", "#4A4A3A", "#6A5E4E"][i % 3], head: "cloth", mantle: ["#8A8070", "#7A7464", "#9A8E7A"][i % 3], beard: i % 2 ? "white" : true, hold: "scroll" });
export const SADDUCEE = (i = 0): Look => ({ robe: ["#5A2A3A", "#2A3A5A", "#4A3A2A"][i % 3], head: "turban", cap: ["#E8DCC0", "#D8C8A0", "#E0D4B8"][i % 3], drape: ["#C8A060", "#8A2A3A", "#3A4A6A"][i % 3], sash: GOLD, beard: true });
/** Caiaphas the high priest: the blue robe, a white turban with the gold plate. ANNAS his father-in-law. */
export const CAIAPHAS: Look = { robe: "#2A3A7A", head: "turban", cap: "#F0EAE0", diadem: "#E2B850", sash: GOLD, drape: "#8A2A3A", beard: true };
export const ANNAS: Look = { ...CAIAPHAS, beard: "white", drape: "#5A3A5A" };
export const GAMALIEL: Look = { robe: "#E2DACA", head: "turban", cap: "#E8E0CC", drape: "#3A4A7A", beard: "white" };
/** Pontius Pilate: a white toga with the purple edge, a laurel wreath; clean-shaven. */
export const PILATE: Look = { robe: "#E8E2D4", drape: "#F2ECE2", drapeEdge: "#5A1E4A", head: "laurel", skin: "#8A6448" };
/** Roman legionaries: galea with a red crest, iron armour, red tunic; 0 pilum and scutum, 1 scutum, 2 sword, 3 spear. */
export const ROMAN = (i = 0): Look => ({
  robe: ["#8A2A22", "#7A2620", "#922E24"][i % 3],
  head: "galea",
  armor: "#8E9096",
  short: true,
  skin: ["#7A5038", "#8A6048", "#6A4632"][i % 3],
  hold: (["pilum", "scutum", "sword", "spear"] as const)[i % 4],
  hold2: i % 4 === 0 ? "scutum" : null,
});
/** A centurion: polished armour, a white crest, a red cloak and the vine staff. JULIUS of the Augustan Cohort (Acts 27:1). */
export const CENTURION: Look = { robe: "#8A2A22", head: "galea", cap: "#E8E4DC", armor: "#A8AAB2", drape: "#8A2422", sash: GOLD, short: true, staff: "staff", skin: "#7A5038" };
export const JULIUS: Look = { ...CENTURION, drape: "#6A2A44", skin: "#8A6048" };
/** Cornelius, centurion of the Italian Regiment (Acts 10): in armour, or at home in a red tunic and cream mantle. */
export const CORNELIUS: Look = { ...CENTURION, drape: "#7A3A2A", beard: true };
export const CORNELIUS_HOME: Look = { robe: "#7A2A24", head: "hair", drape: "#D8CCB0", beard: true, skin: "#7A5038" };
// Acts.
export const STEPHEN: Look = { robe: "#E2DACA", drape: "#4A6A8A", head: "hair", beard: true };
/** Stephen before the council, his face like the face of an angel (Acts 6:15). */
export const STEPHEN_RADIANT: Look = { ...STEPHEN, glow: 0.45 };
/** Saul of Tarsus, the Pharisee with the high priest's letters (SAUL is King Saul in Cast2); SAUL_BLIND after the light (Acts 9:8). */
export const SAUL_TARSUS: Look = { robe: "#3A3A4A", head: "turban", cap: "#C8BCA8", drape: "#7A3A2A", beard: true, hold: "scroll" };
export const SAUL_BLIND: Look = { ...SAUL_TARSUS, hold: null, blind: true };
/** Paul the apostle: balding, a dark beard, a brown travelling mantle; PAUL_CHAINED with a chain on the wrist. */
export const PAUL: Look = { robe: "#5A4A3A", drape: "#7A3E2A", head: "bare", beard: true };
export const PAUL_CHAINED: Look = { ...PAUL, hold: "chain" };
export const BARNABAS: Look = { robe: "#4A5A3A", drape: "#A8905A", head: "hair", beard: true };
export const SILAS: Look = { robe: "#6A4A3A", drape: "#4A5A6A", head: "hair", beard: true };
export const TIMOTHY: Look = { robe: "#4A6A7A", head: "hair", sash: "#8A6A3A" };
export const PHILIP_EVANGELIST: Look = { robe: "#6A6A4A", head: "cloth", mantle: "#8A9AA0", beard: true };
/** The Ethiopian official of Queen Candace (Acts 8:27): fine linen, a green mantle, a gold turban; seat him in a Carriage. */
export const ETHIOPIAN: Look = { robe: "#E8DCC0", drape: "#2A6A5A", head: "turban", cap: "#C89A40", sash: GOLD, skin: "#3A2418", hold: "scroll" };
export const ANANIAS_DAMASCUS: Look = { robe: "#5A5A4A", head: "cloth", mantle: "#8A8670", beard: "white" };
/** James the Lord's brother, leader of the Jerusalem church (Acts 15:13). */
export const JAMES_ELDER: Look = { robe: "#E2DACA", head: "cloth", mantle: "#8A7A6A", drape: "#6A5A4A", beard: "white" };
/** Lydia, a dealer in purple cloth from Thyatira (Acts 16:14). */
export const LYDIA: Look = { robe: "#5A1E5A", head: "veil", mantle: "#C8A0C8", sash: GOLD, hold: "cloth" };
export const JAILER: Look = { robe: "#5A4A3A", head: "cloth", mantle: "#6A5E4A", beard: true, short: true, hold: "torch" };
/** Athenian philosophers, Epicurean and Stoic (Acts 17:18): himation over a chiton, some with scrolls. */
export const ATHENIAN = (i = 0): Look => ({
  robe: ["#E2DACA", "#D8CCB4", "#C8C0B0", "#E8E0D0"][i % 4],
  drape: ["#5A6A8A", "#8A5A3A", "#6A6A5A", "#7A3A4A"][i % 4],
  head: (["hair", "bare", "hair", "laurel"] as const)[i % 4],
  beard: i % 3 === 1 ? "white" : true,
  hold: i % 2 ? "scroll" : null,
});
export const PRISCILLA: Look = { robe: "#6A3A4A", head: "veil", mantle: "#C8A88A", sash: "#8A6A3A" };
export const AQUILA: Look = { robe: "#5A5A3A", head: "cloth", mantle: "#8A8460", beard: true };
/** Demetrius the silversmith (Acts 19:24). */
export const DEMETRIUS: Look = { robe: "#6A4A2A", head: "cloth", mantle: "#8A7A5A", beard: true, short: true, sash: "#C8CCD4", hold: "mallet" };
/** Roman governors and a proconsul: white toga, purple edge. */
export const FELIX: Look = { robe: "#D8D0C0", drape: "#EEE8DE", drapeEdge: "#3A1E5A", head: "laurel", skin: "#8A6448" };
export const FESTUS: Look = { robe: "#E2DACA", drape: "#F0EAE0", drapeEdge: "#5A1E4A", head: "hair", skin: "#8A6448" };
export const PROCONSUL: Look = { robe: "#E2DACA", drape: "#F0EAE0", drapeEdge: "#6A1E3A", head: "hair", skin: "#8A6448", beard: true };
/** King Agrippa and Bernice, who came "with great pomp" (Acts 25:23). */
export const AGRIPPA: Look = { robe: "#4A2266", head: "crown", drape: "#C8A050", sash: GOLD };
export const BERNICE: Look = { robe: "#7A2A5A", head: "veil", mantle: "#E0C890", sash: "#E8C060", diadem: true };
export const SAILOR = (i = 0): Look => ({
  robe: ["#4A5A6A", "#6A5A3A", "#5A4A3A", "#3A4A5A"][i % 4],
  head: i % 3 === 1 ? "cloth" : "hair",
  mantle: "#7A6A50",
  beard: i % 2 === 0,
  short: true,
  sash: ["#8A6A3A", "#6A3A2A"][i % 2],
  skin: ["#7A5038", "#6A4632", "#8A5A3C"][i % 3],
});

// ── Places ──────────────────────────────────────────────────────────────────────────────

type CamT = ReturnType<typeof useCam>;
type SkyP = React.ComponentProps<typeof Sky>;
type SetP = { cam: CamT; seed: string; tod?: number; near?: React.ReactNode; mid?: React.ReactNode; far?: React.ReactNode; front?: React.ReactNode; fx?: React.ReactNode; sky?: SkyP; storm?: number };

const isNight = (tod: number) => tod > 0.74 || tod < 0.22;

/** Rolling dark swells with foam across the lower frame (storm water in front of a boat's waterline). */
const Swells: React.FC<{ y0: number; storm: number; seed: string; color?: string }> = ({ y0, storm, seed, color = "#1E3A48" }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const rows = 4;
  return (
    <Svg>
      {Array.from({ length: rows }, (_, r) => {
        const yy = lerp(y0, H + 40, r / rows);
        const amp = (10 + r * 10) * storm;
        const len = 260 + r * 120;
        const sp = (0.6 + r * 0.35) * (r % 2 ? -1 : 1);
        const pts: string[] = [];
        for (let x = -100; x <= W + 100; x += 20) {
          const ph = ((x + f * sp * 3) / len) * Math.PI * 2 + random(`${seed}${r}`) * 6;
          pts.push(`${x === -100 ? "M" : "L"} ${x} ${(yy - Math.max(0, Math.sin(ph)) * amp * 1.6 + Math.sin(ph * 0.5) * amp * 0.3).toFixed(1)}`);
        }
        const top = pts.join(" ");
        return (
          <g key={r}>
            <path d={`${top} L ${W + 100} ${H + 200} L -100 ${H + 200} Z`} fill={tone(color, -0.1 * r)} opacity={0.92} />
            <path d={top} stroke={`rgba(230,240,246,${(0.25 + 0.3 * storm).toFixed(3)})`} strokeWidth={1.6 + r * 0.4} fill="none" />
          </g>
        );
      })}
    </Svg>
  );
};

/** The crowd coming with torches and clubs (John 18:3): n dark walking figures, every other one with a raised torch. */
const Torches: React.FC<{ x0: number; x1: number; n?: number; a?: number; seed: string; s?: number }> = ({ x0, x1, n = 7, a = 1, seed, s = 0.85 }) => {
  const f = useCurrentFrame();
  const R = useRig();
  return (
    <g opacity={a}>
      {Array.from({ length: n }, (_, i) => {
        const x = lerp(x0, x1, (i + random(`${seed}${i}`) * 0.5) / n);
        const torch = i % 2 === 0;
        const look: Look = { robe: "#16141A", head: i % 3 === 1 ? "helmet" : "cloth", mantle: "#121016", short: i % 3 === 1, hold: torch ? "torch" : i % 4 === 1 ? "spear" : null };
        const pose: Pose = { arm: torch ? [125, 5] : [30, 20], walk: walkPhase(f, 0.55) + i * 1.3 };
        const r = R(x, s, look, pose);
        return (
          <g key={i}>
            <Person x={x} s={s} look={look} pose={pose} />
            {torch ? <GlowS x={r.hand[0] + 4 * r.sc} y={r.hand[1] - 38 * r.sc} r={90 * r.sc} color="255,160,70" opacity={0.75} /> : null}
          </g>
        );
      })}
    </g>
  );
};

/** An opaque boulder on the band's ground at x (the kit Rock reads as a translucent blob at dusk), w × h units at s = 1. */
const Boulder: React.FC<{ x: number; s?: number; w?: number; h?: number; seed: string; color?: string }> = ({ x, s = 1, w = 120, h = 56, seed, color = "#5E574C" }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const k = s * band.k;
  const gy = band.gy(x);
  const c = ink(color);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (i / 10);
    pts.push([-(w / 2) * Math.cos(a) + range(`${seed}x${i}`, -6, 6), -h * Math.pow(Math.sin(a), 0.75) + range(`${seed}y${i}`, -6, 6) * Math.sin(a)]);
  }
  const d = `M ${-w / 2 - 4} 3 ${pts.map((q) => `L ${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ")} L ${w / 2 + 4} 3 Z`;
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <ellipse cx={0} cy={2} rx={w * 0.6} ry={5} fill="rgba(0,0,0,0.35)" />
      <path d={d} fill={c} stroke={rim(0.8)} strokeWidth={1.2} />
      <path d={`M ${-w * 0.44} ${-h * 0.18} Q 0 ${-h * 0.04} ${w * 0.46} ${-h * 0.2} L ${w / 2 + 4} 3 L ${-w / 2 - 4} 3 Z`} fill={tone(c, -0.25)} />
      <path d={`M ${-w * 0.2} ${-h * 0.82} q ${w * 0.12} ${h * 0.2} ${w * 0.05} ${h * 0.5}`} stroke={tone(c, -0.3)} strokeWidth={1.4} fill="none" />
    </g>
  );
};

/** A marble statue on a plinth (the Athenian agora "full of idols", Acts 17:16): a Person in marble, 64-high plinth. */
const Statue: React.FC<{ x: number; s?: number; seed: string; flip?: boolean }> = ({ x, s = 1, seed, flip }) => {
  const band = useBand();
  const k = s * band.k;
  const gy = band.gy(x);
  const marble = "#D8D0C0";
  const i = Math.floor(random(seed) * 3);
  const look: Look = { robe: marble, skin: "#CFC6B6", drape: "#E2DACA", head: i === 2 ? "galea" : "hair", cap: "#D8D0C0", beard: i === 1 };
  return (
    <g>
      <rect x={x - 34 * k} y={gy - 64 * k} width={68 * k} height={64 * k} fill="#B8AC96" stroke="rgba(255,226,180,0.4)" strokeWidth={1} />
      <rect x={x - 40 * k} y={gy - 70 * k} width={80 * k} height={8 * k} fill="#C8BCA6" />
      <Person x={x} y={gy - 70 * k} s={s} look={look} flip={flip} pose={{ arm: i === 0 ? [100, 20] : [20, 30], head: -4 }} shadow={false} />
    </g>
  );
};

// ── Temple ────────────────────────────────────────────────────────────────────────────────

/** A golden seven-branched lampstand (Exodus 25:31), Person scale: 150 tall, flames at -150 (`lit` 0..1). */
const Menorah: React.FC<{ x: number; s?: number; lit?: number }> = ({ x, s = 1, lit = 1 }) => {
  const band = useBand();
  const f = useCurrentFrame();
  const k = s * band.k;
  const gy = band.gy(x);
  const g = "#D6AE52";
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <ellipse cx={0} cy={0} rx={40} ry={5} fill="rgba(0,0,0,0.35)" />
      <path d="M -26 0 L -8 -14 L -4 -150 L 4 -150 L 8 -14 L 26 0 Z" fill={g} stroke="rgba(255,240,200,0.7)" strokeWidth={1} />
      {[1, 2, 3].map((i) => (
        <path key={i} d={`M ${-i * 18} -150 Q ${-i * 18} ${-100 + i * 10} 0 ${-86 + i * 4} Q ${i * 18} ${-100 + i * 10} ${i * 18} -150`} stroke={g} strokeWidth={5} fill="none" />
      ))}
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={i * 18 - 6} y={-156} width={12} height={6} rx={2} fill={g} />
          {lit > 0 ? (
            <>
              <GlowS x={i * 18} y={-164} r={36} color="255,190,100" opacity={0.6 * lit} />
              <ellipse cx={i * 18} cy={-164} rx={3} ry={(7 + Math.sin(f * 0.4 + i) * 1.2) * lit} fill="#FFC060" />
              <ellipse cx={i * 18} cy={-162} rx={1.4} ry={3.4 * lit} fill="#FFF4D0" />
            </>
          ) : null}
        </g>
      ))}
    </g>
  );
};

/** The golden altar of incense before the curtain (Luke 1:9–11), Person scale: 110 tall, horns at -120; smoke when `smoke`. */
const IncenseAltar: React.FC<{ x: number; s?: number; smoke?: number; seed: string }> = ({ x, s = 1, smoke = 1, seed }) => {
  const band = useBand();
  const k = s * band.k;
  const gy = band.gy(x);
  const g = "#D2A848";
  return (
    <g>
      <g transform={`translate(${x} ${gy}) scale(${k})`}>
        <ellipse cx={0} cy={0} rx={56} ry={6} fill="rgba(0,0,0,0.35)" />
        <rect x={-38} y={-104} width={76} height={104} fill={g} stroke="rgba(255,240,200,0.75)" strokeWidth={1.2} />
        <rect x={-44} y={-110} width={88} height={10} fill={tone(g, 0.1)} />
        <rect x={-44} y={-60} width={88} height={6} fill={tone(g, -0.15)} />
        {[-1, 1].map((d) => (
          <path key={d} d={`M ${d * 40 - 6} -110 L ${d * 40 - 4} -120 Q ${d * 42} -128 ${d * 46} -122 L ${d * 40 + 6} -110 Z`} fill={g} />
        ))}
        <ellipse cx={0} cy={-112} rx={22} ry={4} fill="#FF9A3A" opacity={0.9 * smoke} />
        <GlowS x={0} y={-116} r={60} color="255,170,80" opacity={0.6 * smoke} />
      </g>
      {smoke > 0 ? <Smoke x={x} y={gy - 116 * k} s={0.55 * k} n={12} rise={1.1} drift={0.15} color="236,228,214" opacity={0.5 * smoke} seed={`${seed}sm`} /> : null}
    </g>
  );
};

/**
 * Herod's temple (Luke 1–2, Mark 11, John 2, Acts 3, Acts 21). `view`:
 *  "court" (default): HerodTemple in the middle band at `tx` (scale `ts`) with Solomon's Colonnade running off to both
 *    sides and the paved Court of the Gentiles in front (people on the near band, s ≈ 1; MoneyTable props go there).
 *    Temple base = ridgeY(useLandGeo("plain", seed).mid, tx); porch top = base - HEROD_H.porch × ts × K.mid.
 *  "colonnade": Solomon's Colonnade close up, its columns standing in the near band behind the people on the left, the
 *    temple beyond on the right (Acts 3:11, John 10:23).
 *  "gate": the Beautiful Gate (TempleGate) close up in the near band at `tx`, the temple's top beyond (Acts 3:2); `open`.
 *  "holy": inside the Holy Place: gold-panelled walls, the great curtain at the back (`torn` tears it from top to
 *    bottom), the golden lampstand on the left, the altar of incense at `ax` with its smoke (Luke 1:9–11). People on the
 *    floor (flat near band at p(880, 1380)).
 * glow lights the sanctuary; smoke raises the altar smoke behind the court; dark darkens the sky (Mark 15:33).
 */
export const HerodTempleSet: React.FC<
  SetP & { view?: "court" | "colonnade" | "gate" | "holy"; tx?: number; ts?: number; ax?: number; glow?: number; torn?: number; smoke?: number; dark?: number; open?: number; children?: React.ReactNode; incense?: number }
> = ({ cam, seed, tod = 0.4, near, mid, far, front, fx, sky, storm = 0, view = "court", tx, ts, ax, glow = 0, torn = 0, smoke = 0.35, dark = 0, open = 0, children, incense = 1 }) => {
  const { p, W, H } = useLayout();
  const K = useBandK();
  const f = useCurrentFrame();
  const geo = useLandGeo("plain", seed);
  if (view === "holy") {
    const base = p(790, 1270);
    const floor = p(880, 1380);
    const vw = p(560, 520);
    const vx = W / 2;
    const vTop = base - p(560, 760);
    const tr = Math.min(1, Math.max(0, torn));
    const stripes = ["#2A3A7A", "#7A1E2A", "#4A2266"];
    const flick = 0.9 + 0.1 * Math.sin(f * 0.37);
    const halfC = (side: -1 | 1) => {
      const pts: string[] = [];
      const n = 12;
      const ch = base - vTop;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const g = u < tr ? (1 - u / Math.max(0.001, tr)) * vw * 0.22 * tr + Math.sin(u * 40) * 4 * tr : 0;
        pts.push(`${i ? "L" : "M"} ${(vx + side * g).toFixed(1)} ${(vTop + u * ch).toFixed(1)}`);
      }
      pts.push(`L ${vx + side * vw / 2} ${base} L ${vx + side * vw / 2} ${vTop} Z`);
      return pts.join(" ");
    };
    return (
      <Stage cam={cam} tod={0.55} rim="255,210,140" rimA={0.6}>
        <AbsoluteFill style={{ background: "#120C06" }} />
        <Band depth={0.55} k={K.mid}>
          <rect x={-800} y={-800} width={W + 1600} height={base + 800} fill="#5A4220" />
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={-400 + i * ((W + 800) / 13)} y={vTop - p(200, 300)} width={(W + 800) / 13 - 14} height={base - vTop + p(160, 260)} fill="none" stroke="rgba(230,180,90,0.45)" strokeWidth={2} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <path key={`p${i}`} d={`M ${-400 + i * ((W + 800) / 13) + 30} ${base - p(240, 300)} q 20 -40 40 0 q 20 -40 40 0`} stroke="rgba(230,180,90,0.35)" strokeWidth={2} fill="none" />
          ))}
          <rect x={vx - vw / 2 - 26} y={vTop - 30} width={vw + 52} height={base - vTop + 30} fill="#3A2810" />
          {tr > 0 ? <rect x={vx - vw / 2} y={vTop} width={vw} height={base - vTop} fill="#080504" /> : null}
          {([-1, 1] as const).map((side) => (
            <g key={side}>
              <path d={halfC(side)} fill={stripes[side < 0 ? 0 : 1]} />
              {[0.2, 0.45, 0.7].map((u) => (
                <line key={u} x1={vx + side * vw * 0.5 * u + side * 6} y1={vTop} x2={vx + side * vw * 0.5 * u + side * 6} y2={base} stroke={stripes[(u * 10) % 3 === 0 ? 2 : side < 0 ? 1 : 2]} strokeWidth={10} opacity={tr > 0.02 ? 0.5 : 0.8} />
              ))}
            </g>
          ))}
          <rect x={vx - vw / 2 - 30} y={vTop - 34} width={vw + 60} height={14} fill="#D6AE52" />
          <rect x={-800} y={base} width={W + 1600} height={H + 800} fill="#3A2A14" />
          <line x1={-800} y1={base} x2={W + 800} y2={base} stroke="rgba(255,210,150,0.25)" strokeWidth={1.4} />
        </Band>
        <Band depth={0.62} gy={() => base + p(10, 14)} k={K.mid}>
          <Menorah x={p(360, 170)} s={1.1} lit={1} />
          <g>
            <rect x={W - p(470, 260) - 70 * K.mid} y={base + p(10, 14) - 64 * K.mid} width={140 * K.mid} height={10 * K.mid} fill="#D2A848" />
            {[-56, 48].map((lx) => (
              <rect key={lx} x={W - p(470, 260) + lx * K.mid} y={base + p(10, 14) - 56 * K.mid} width={8 * K.mid} height={56 * K.mid} fill="#B8903A" />
            ))}
            {[-30, 30].map((sx) =>
              [0, 1, 2, 3, 4, 5].map((j) => <ellipse key={`${sx}${j}`} cx={W - p(470, 260) + sx * K.mid} cy={base + p(10, 14) - (70 + j * 8) * K.mid} rx={20 * K.mid} ry={5 * K.mid} fill="#C8955A" stroke="rgba(255,226,170,0.5)" strokeWidth={0.6} />),
            )}
          </g>
        </Band>
        <Band depth={0.8} gy={() => floor} k={K.near}>
          <IncenseAltar x={ax ?? p(1100, 620)} s={p(1, 0.9)} smoke={incense} seed={`${seed}ia`} />
          {children}
          {near}
        </Band>
        <Glow x={p(360, 170)} y={base - p(230, 280)} size={p(900, 800)} color="255,180,90" opacity={0.4 * flick} />
        <Glow x={ax ?? p(1100, 620)} y={floor - p(170, 200)} size={p(700, 600)} color="255,170,80" opacity={0.35 * incense} />
        {tr > 0 ? <Glow x={vx} y={base - p(260, 340)} size={p(900, 800)} color="255,236,200" opacity={0.25 * tr} /> : null}
        <Glow x={W / 2} y={p(300, 600)} size={p(1700, 1400)} color="255,200,120" opacity={0.18 + 0.2 * glow} />
        {fx}
      </Stage>
    );
  }
  const x = tx ?? p(view === "colonnade" ? 1400 : 1000, view === "colonnade" ? 780 : 560);
  const s = ts ?? (view === "court" ? p(0.95, 0.9) : view === "colonnade" ? p(0.7, 0.62) : p(0.95, 0.9));
  const half = 0.5 * 480 * s * K.mid + 30;
  const night = isNight(tod);
  return (
    <Land
      preset="plain"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={Math.max(storm, dark * 0.85)}
      colors={{ mid: "#9A8C72", near: "#8A7A62", front: "#3E3428", far: "#7A7A80" }}
      sky={sky ?? { sun: dark > 0.3 || night ? null : { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 + dark * 0.5, stars: night ? 1 : 0 }}
      far={far}
      mid={
        <>
          {view === "court" ? (
            <>
              <Colonnade x0={-300} x1={x - half} h={260} />
              <Colonnade x0={x + half} x1={W + 300} h={260} />
            </>
          ) : (
            <Colonnade x0={-300} x1={W + 300} h={200} double={false} />
          )}
          {smoke > 0 ? <Smoke x={x - half * 0.55} y={geo.mid.base - 60} s={1.3} n={14} rise={1.2} drift={0.25} opacity={0.4 * smoke} seed={`${seed}as`} /> : null}
          {view !== "gate" ? <HerodTemple x={x} s={s} glow={glow + (night ? 0.35 : 0)} torn={torn} seed={`${seed}t`} /> : <HerodTemple x={x} s={s * 1.05} glow={glow} torn={torn} seed={`${seed}t`} />}
          {mid}
        </>
      }
      near={
        <>
          <Paving />
          {view === "colonnade" ? <Colonnade x0={-200} x1={p(980, 520)} h={p(430, 470)} gap={p(170, 190)} roof={false} wall="#4A3E30" lit={night ? 0.6 : 0} /> : null}
          {view === "gate" ? <TempleGate x={tx ?? p(960, 540)} s={p(0.8, 0.7)} open={open} glow={glow} /> : null}
          {near}
        </>
      }
      front={front}
      fx={
        <>
          {dark > 0 ? <Tint color="#140A06" opacity={0.3 * dark} /> : null}
          {fx}
        </>
      }
    />
  );
};

// ── Galilee ───────────────────────────────────────────────────────────────────────────────

/**
 * The Sea of Galilee: hills across the lake (a town on the far shore with `town`), the water filling the middle, fishing
 * boats far out (`boats`), and a pebbly near shore where people stand (Person s ≈ 1) unless `shore` is false (open water:
 * put boats and figures in `onWater` with their own y, e.g. FishingBoat y = p(860, 1400)). `onWater` items float on the
 * lake in the water band (waterline y = hz + p(36, 50) for distant things). `storm` 0..1 darkens the sky, raises the
 * waves, rain and rolling swells across the bottom; `flash` lists frames for lightning; `moon` for night scenes.
 */
export const GalileeSet: React.FC<SetP & { shore?: boolean; boats?: number; moon?: boolean; flash?: number[]; town?: boolean; onWater?: React.ReactNode; rough?: number; hills?: string; water?: string; swellY?: number }> = ({
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
  shore = true,
  boats = 2,
  moon = false,
  flash = [],
  town = true,
  onWater,
  rough,
  hills = "#4E5A4A",
  water = "#2E5868",
  swellY,
}) => {
  const { p, W, hz } = useLayout();
  const g = useLandGeo("hills", seed);
  const K = useBandK();
  const night = isNight(tod);
  const wy = hz + p(36, 50);
  const nearRidge = { ...g.near, base: g.near.base + p(40, 60), amp: p(10, 12) };
  const lake = mixHex(water, "#1A2630", storm * 0.6);
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} storm={storm} clouds={0.3 + storm * 0.6} stars={night ? 1 - storm : 0} sun={night || storm > 0.4 ? null : { x: p(1720, 940), y: p(340, 780) }} moon={moon ? { x: p(1450, 820), y: p(190, 430), r: p(26, 30) } : null} {...sky} />
      <Band depth={0.12} ridge={{ base: hz - 4, amp: p(70, 80), seed: `${seed}f` }} fill={hills} haze={0.5} edge={0.35} k={K.far}>
        {town
          ? Array.from({ length: 6 }, (_, i) => <House key={i} x={p(1280, 700) + i * p(34, 30) - (i % 2) * 10} s={0.42} w={50 + (i % 3) * 8} h={36} seed={`${seed}h${i}`} lit={night ? 0.7 : 0} />)
          : null}
        {far}
      </Band>
      <Water
        depth={0.4}
        y={wy}
        color={lake}
        deep="#06121A"
        rough={rough ?? 0.1 + storm * 0.85}
        k={K.mid}
        shine={night || storm > 0.3 ? null : { x: p(1700, 940), a: 0.5 }}
        front={
          <>
            {Array.from({ length: boats }, (_, i) => (
              <FishingBoat key={i} x={p(380, 200) + i * p(820, 420)} s={0.2 + (i % 2) * 0.04} sail={0.8} oars={false} water={lake} flip={i % 2 === 1} roll={storm * 6 * Math.sin(i + 1)} />
            ))}
            {mid}
            {onWater}
          </>
        }
      />
      {storm > 0.05 ? <Swells y0={swellY ?? p(shore ? 820 : 880, shore ? 1330 : 1420)} storm={storm} seed={`${seed}sw`} color={tone(lake, -0.2)} /> : null}
      {shore ? (
        <>
          <Band depth={0.8} ridge={nearRidge} fill="#7A6A50" fill2="#3A3024" haze={0.04} edge={0.5} k={K.near}>
            {Array.from({ length: 40 }, (_, i) => {
              const px = range(`${seed}px${i}`, -100, W + 100);
              return <ellipse key={i} cx={px} cy={nearRidge.base + range(`${seed}py${i}`, 6, 80)} rx={range(`${seed}pr${i}`, 3, 9)} ry={range(`${seed}pq${i}`, 2, 4)} fill="rgba(40,32,24,0.35)" />;
            })}
            {near}
          </Band>
          <Band depth={1} ridge={g.front} fill="#3A3024" haze={0} edge={0.3} k={K.front}>
            {front}
          </Band>
        </>
      ) : null}
      {storm > 0.05 ? <Rain intensity={storm} angle={18} seed={`${seed}rn`} /> : null}
      {flash.map((at, i) => (
        <Lightning key={i} at={at} x={p(600 + i * 500, 300 + i * 300)} y={hz - 20} seed={`${seed}lt${i}`} />
      ))}
      {storm > 0 ? <Tint color="#0A1018" opacity={0.22 * storm} /> : null}
      {fx}
    </Stage>
  );
};

// ── Nativity ──────────────────────────────────────────────────────────────────────────────

/**
 * Bethlehem by night (Luke 2, Matthew 2), with the star at (sx, sy) in screen space (`star` 0..1, `beam` its ray down).
 * `view`:
 *  "town": the little town on its hill, lamplit windows, olive trees in front.
 *  "stable" (default): the cave stable (Stable) in the near band at `stx`; its `inside` slot is clipped to the cave mouth
 *    and anchored on its floor (Manger at x = 0, Mary at x ≈ -110 kneeling, Joseph at x ≈ 120); the town on the hill.
 *  "fields": the shepherds' field, the flock (`flock`) and a small fire, the town on the far ridge; `glory` 0..1 is the
 *    glory of the Lord shining round them (Luke 2:9).
 */
export const BethlehemSet: React.FC<SetP & { view?: "town" | "stable" | "fields"; star?: number; sx?: number; sy?: number; beam?: number; lit?: number; inside?: React.ReactNode; stx?: number; sts?: number; glory?: number; flock?: boolean; fire?: number }> = ({
  cam,
  seed,
  tod = 0.9,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  view = "stable",
  star = 1,
  sx,
  sy,
  beam,
  lit,
  inside,
  stx,
  sts,
  glory = 0,
  flock = true,
  fire = 1,
}) => {
  const { p, W } = useLayout();
  const night = isNight(tod);
  const L = lit ?? (night ? 0.8 : 0);
  const geo = useLandGeo("hills", seed);
  const townAt = (cx: number, n: number, sc: number) =>
    Array.from({ length: n }, (_, i) => {
      const xx = cx + (i - n / 2) * 56 * sc * 1.2 + range(`${seed}tx${i}`, -10, 10);
      return <House key={i} x={xx} y={undefined} s={sc * range(`${seed}ts${i}`, 0.85, 1.1)} w={52 + (i % 3) * 10} h={40 + (i % 2) * 10} seed={`${seed}th${i}`} lit={L * (random(`${seed}tl${i}`) > 0.3 ? 1 : 0)} />;
    });
  const starX = sx ?? (view === "stable" ? (stx ?? p(1060, 560)) : p(1250, 700));
  const starY = sy ?? p(150, 360);
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#4A5038", near: "#3E4630", front: "#1E2416" }}
      sky={sky ?? { sun: night ? null : { x: p(1740, 960), y: p(360, 800) }, clouds: 0.15, stars: night ? 1 : 0 }}
      far={
        <>
          {view === "fields" ? townAt(p(1250, 700), p(9, 6), 0.75) : null}
          {far}
        </>
      }
      mid={
        <>
          {view === "town" ? (
            <>
              {townAt(p(1000, 540), p(14, 8), 1.05)}
              <Tree x={p(330, 140)} s={1.1} kind="olive" seed={`${seed}o1`} />
              <Tree x={p(1650, 960)} s={1} kind="olive" seed={`${seed}o2`} />
            </>
          ) : null}
          {view === "stable" ? townAt(p(1650, 900), p(7, 4), 0.8) : null}
          {view === "fields" ? (
            <>
              <Tree x={p(250, 120)} s={1} kind="olive" seed={`${seed}o3`} />
              <Boulder x={p(1500, 860)} s={1.6} w={90} h={40} seed={`${seed}r1`} color="#5A5448" />
            </>
          ) : null}
          {mid}
        </>
      }
      near={
        <>
          {view === "stable" ? (
            <>
              <Stable x={stx ?? p(1060, 560)} s={sts ?? p(1, 0.78)} lamp={night ? 1 : 0.4} inside={inside} seed={`${seed}sb`} />
              <Boulder x={p(300, 90)} s={1.3} w={90} h={50} seed={`${seed}r2`} color="#5A5448" />
            </>
          ) : null}
          {view === "town" ? <Tree x={p(1780, 1000)} s={1.5} kind="olive" seed={`${seed}o4`} /> : null}
          {view === "fields" && flock ? <Herd kind="sheep" n={p(8, 5)} x0={p(1100, 560)} x1={p(1800, 1040)} s={1} seed={`${seed}fl`} /> : null}
          {view === "fields" && fire > 0 ? <Hearth x={p(760, 420)} s={1.2} p={fire} /> : null}
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={
        <>
          {star > 0 ? <BethlehemStar x={starX} y={starY} r={p(9, 10)} p={star} beam={beam ?? (view === "stable" ? Math.max(0, geo.near.base - starY - p(330, 360)) : 0)} /> : null}
          {glory > 0 ? (
            <>
              <Rays x={p(960, 540)} y={p(-60, 160)} count={14} length={p(1300, 1500)} spread={[45, 135]} width={[40, 110]} color="255,236,190" opacity={0.3 * glory} blur={8} seed={`${seed}gr`} />
              <Glow x={p(960, 540)} y={p(200, 520)} size={p(1800, 1500)} color="255,228,170" opacity={0.6 * glory} />
              <Tint color="#FFE8B0" opacity={0.12 * glory} blend="soft-light" />
            </>
          ) : null}
          {fx}
        </>
      }
    />
  );
};

/** Nazareth in Galilee: a hill village of stone houses among olive trees by day; `house` puts a HouseFront in the near
 *  band at `hx` (door 100 × 200; `door`, `lit`, `inDoor`, `roof` passed through) for Mary's home or Joseph's workshop. */
export const NazarethSet: React.FC<SetP & { house?: boolean; hx?: number; hs?: number; lit?: number; door?: number; inDoor?: React.ReactNode; roof?: React.ReactNode }> = ({
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
  house = true,
  hx,
  hs,
  lit,
  door = 0,
  inDoor,
  roof,
}) => {
  const { p } = useLayout();
  const night = isNight(tod);
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: night ? null : { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3, stars: night ? 1 : 0 }}
      far={far}
      mid={
        <>
          {Array.from({ length: p(10, 6) }, (_, i) => (
            <House key={i} x={p(860, 420) + i * p(74, 66) - (i % 2) * 18} s={0.95} w={58 + (i % 3) * 8} h={42 + (i % 2) * 8} seed={`${seed}h${i}`} lit={lit ?? (night ? 0.7 : 0)} />
          ))}
          {[p(300, 100), p(520, 280), p(1700, 1000)].map((tx, i) => (
            <Tree key={i} x={tx} s={0.75} kind="olive" seed={`${seed}o${i}`} />
          ))}
          {mid}
        </>
      }
      near={
        <>
          {house ? <HouseFront x={hx ?? p(1300, 760)} s={hs ?? p(1, 0.85)} lit={lit ?? (night ? 0.8 : 0)} door={door} inDoor={inDoor} roof={roof} /> : null}
          <Tree x={p(180, 60)} s={1.4} kind="olive" seed={`${seed}on`} />
          {near}
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

// ── Jerusalem ─────────────────────────────────────────────────────────────────────────────

/**
 * Jerusalem (the triumphal entry, Jesus weeping over the city, Stephen driven out, Paul's arrest). `view`:
 *  "olives" (default): the view from the Mount of Olives, JerusalemCity across the valley in the middle band at `cx`
 *    (scale `cs`), olive trees on the near slope where people stand (Person s ≈ 1).
 *  "road": the road down from the Mount of Olives toward the city, palms beside it (lay PalmBranches on it).
 *  "gate": a person-height CityGate at `gx` in the near band, the city's roofs and the temple above the wall.
 * `lit` lights the city, `glow` the temple, `dark` darkens the sky (Luke 23:44), `torn` tears the temple curtain.
 */
export const JerusalemSet: React.FC<SetP & { view?: "olives" | "road" | "gate"; cx?: number; cs?: number; lit?: number; glow?: number; dark?: number; gx?: number; torn?: number }> = ({
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
  view = "olives",
  cx,
  cs,
  lit,
  glow = 0,
  dark = 0,
  gx,
  torn = 0,
}) => {
  const { p, W } = useLayout();
  const night = isNight(tod);
  const L = lit ?? (night ? 0.7 : 0);
  const geo = useLandGeo("hills", seed);
  const roadPts = (y0: number) => `M ${p(-100, -100)} ${y0 + p(120, 160)} Q ${p(700, 380)} ${y0 + p(40, 60)} ${p(1250, 700)} ${y0 + p(16, 24)} L ${p(1400, 780)} ${y0 + p(14, 22)} Q ${p(900, 520)} ${y0 + p(70, 90)} ${p(400, 240)} ${y0 + p(240, 320)} Z`;
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={Math.max(storm, dark * 0.85)}
      colors={{ mid: "#7A7058", near: "#5E5A3C", front: "#2A2618" }}
      sky={sky ?? { sun: night || dark > 0.3 ? null : { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 + dark * 0.4, stars: night ? 1 : 0 }}
      far={far}
      mid={
        <>
          <JerusalemCity x={cx ?? W / 2} s={cs ?? (view === "gate" ? p(1, 0.9) : p(0.62, 0.48))} lit={L} glow={glow} torn={torn} seed={`${seed}jc`} />
          {mid}
        </>
      }
      near={
        <>
          {view === "road" ? <path d={roadPts(geo.near.base)} fill="rgba(196,176,136,0.55)" /> : null}
          {view === "olives" ? (
            <>
              <Tree x={p(160, 40)} s={1.55} kind="olive" seed={`${seed}o1`} />
              <Tree x={p(1780, 1040)} s={1.35} kind="olive" seed={`${seed}o2`} />
              <Boulder x={p(1500, 900)} s={1.2} w={80} h={40} seed={`${seed}rk`} color="#6A6250" />
            </>
          ) : null}
          {view === "road" ? (
            <>
              <Palm x={p(140, 40)} s={1.5} seed={`${seed}p1`} />
              <Palm x={p(1800, 1050)} s={1.3} lean={-0.3} seed={`${seed}p2`} />
            </>
          ) : null}
          {view === "gate" ? <CityGate x={gx ?? p(960, 540)} s={p(1, 0.8)} lit={L} /> : null}
          {near}
          {view !== "gate" ? dryGrass(`${seed}g`) : null}
        </>
      }
      front={front}
      fx={
        <>
          {dark > 0 ? <Tint color="#140A06" opacity={0.3 * dark} /> : null}
          {fx}
        </>
      }
    />
  );
};

// ── Interiors ─────────────────────────────────────────────────────────────────────────────

type InteriorProps = {
  cam: CamT;
  seed: string;
  wall?: string;
  floorC?: string;
  back?: React.ReactNode;
  children?: React.ReactNode;
  fx?: React.ReactNode;
  glows?: { x: number; y: number; size: number; a: number; color?: string }[];
  dim?: number;
  cold?: number;
  warm?: number;
  shake?: { x: number; y: number };
  rim?: string;
};

/** Floor-line and standing line shared by the interiors: wall meets floor at `base`, people stand at `floor`. */
export const useInterior = () => {
  const { p } = useLayout();
  return { base: p(790, 1270), floor: p(880, 1380) };
};

const Interior: React.FC<InteriorProps> = ({ cam, seed, wall = "#6E5A44", floorC = "#3E3024", back, children, fx, glows = [], dim = 0, cold = 0, warm = 0, shake, rim = "255,204,150" }) => {
  const { W, H } = useLayout();
  const K = useBandK();
  const { base, floor } = useInterior();
  const wid = useUid("iw");
  const fid = useUid("if");
  const body = (
    <>
      <AbsoluteFill style={{ background: "#0E0906" }} />
      <Band depth={0.55} k={K.mid}>
        <defs>
          <linearGradient id={wid} gradientUnits="userSpaceOnUse" x1={0} y1={-300} x2={0} y2={base}>
            <stop offset="0" stopColor={tone(wall, -0.55)} />
            <stop offset="0.65" stopColor={wall} />
            <stop offset="1" stopColor={tone(wall, -0.12)} />
          </linearGradient>
          <linearGradient id={fid} gradientUnits="userSpaceOnUse" x1={0} y1={base} x2={0} y2={H + 100}>
            <stop offset="0" stopColor={tone(floorC, 0.12)} />
            <stop offset="1" stopColor={tone(floorC, -0.55)} />
          </linearGradient>
        </defs>
        <rect x={-800} y={-800} width={W + 1600} height={base + 800} fill={`url(#${wid})`} />
        {Array.from({ length: 10 }, (_, i) => (
          <ellipse key={i} cx={range(`${seed}px${i}`, -100, W + 100)} cy={range(`${seed}py${i}`, base * 0.2, base - 40)} rx={range(`${seed}pr${i}`, 60, 160)} ry={range(`${seed}pq${i}`, 14, 36)} fill={i % 2 ? "rgba(255,236,200,0.025)" : "rgba(0,0,0,0.035)"} />
        ))}
        <rect x={-800} y={base} width={W + 1600} height={H + 800} fill={`url(#${fid})`} />
        {back}
        <line x1={-800} y1={base} x2={W + 800} y2={base} stroke="rgba(255,210,150,0.18)" strokeWidth={1.4} />
      </Band>
      <Band depth={0.8} gy={() => floor} k={K.near}>
        {children}
      </Band>
      {glows.map((g, i) => {
        const q = projectPt(cam, W, H, g.x, g.y, 0.55);
        return <Glow key={i} x={q.x} y={q.y} size={g.size} color={g.color ?? "255,170,90"} opacity={g.a} />;
      })}
      <Tint color="#0A1428" opacity={0.42 * cold} />
      <Tint color="#FFB060" opacity={0.16 * warm} blend="soft-light" />
      <Tint color="#06050A" opacity={dim} />
      {fx}
    </>
  );
  return (
    <Stage cam={cam} tod={0.55} rim={rim} rimA={0.5}>
      {shake ? <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}>{body}</AbsoluteFill> : body}
    </Stage>
  );
};

/** An arched window in a wall band showing the sky at `tod` (stars at night), `x` centre, sill at `y`. */
const SkyWindow: React.FC<{ x: number; y: number; w: number; h: number; tod: number; wall: string; seed: string; moon?: boolean }> = ({ x, y, w, h, tod, wall, seed, moon }) => {
  const pal = skyAt(tod);
  const id = useUid("sw");
  const path = `M ${x - w / 2} ${y} L ${x - w / 2} ${y - h + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x + w / 2} ${y - h + w / 2} L ${x + w / 2} ${y} Z`;
  const night = isNight(tod);
  return (
    <g>
      <defs>
        <linearGradient id={id} x1={0} y1={y - h} x2={0} y2={y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={pal.top} />
          <stop offset="1" stopColor={pal.hz} />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${id})`} />
      {night
        ? Array.from({ length: 6 }, (_, i) => <circle key={i} cx={x + range(`${seed}sx${i}`, -w * 0.4, w * 0.4)} cy={y - range(`${seed}sy${i}`, h * 0.2, h * 0.9)} r={range(`${seed}sr${i}`, 0.8, 1.8)} fill="rgba(236,240,255,0.85)" />)
        : null}
      {moon && night ? <circle cx={x + w * 0.15} cy={y - h * 0.68} r={w * 0.13} fill="rgba(236,240,255,0.9)" /> : null}
      <path d={path} fill="none" stroke={tone(wall, -0.4)} strokeWidth={8} />
      <line x1={x} y1={y - h} x2={x} y2={y} stroke={tone(wall, -0.45)} strokeWidth={4} />
      <rect x={x - w / 2 - 8} y={y} width={w + 16} height={8} fill={tone(wall, 0.08)} />
    </g>
  );
};

/** A lamp niche with a clay lamp in a wall band at (x, y) (bottom of the niche), flame flickering, `lit` 0..1. */
const LampNiche: React.FC<{ x: number; y: number; lit?: number }> = ({ x, y, lit = 1 }) => {
  const f = useCurrentFrame();
  const flick = 0.86 + 0.14 * Math.sin(f * 0.37 + x) * Math.sin(f * 0.13 + 1);
  return (
    <g>
      <path d={`M ${x - 32} ${y} L ${x - 32} ${y - 46} Q ${x} ${y - 82} ${x + 32} ${y - 46} L ${x + 32} ${y} Z`} fill="#140C08" />
      <path d={`M ${x - 15} ${y - 4} Q ${x - 13} ${y - 13} ${x} ${y - 13} Q ${x + 15} ${y - 13} ${x + 19} ${y - 8} L ${x + 25} ${y - 12} L ${x + 23} ${y - 4} Z`} fill="#7A5434" />
      {lit > 0 ? (
        <>
          <ellipse cx={x + 21} cy={y - 20} rx={3.6} ry={8 * flick} fill="#FFB050" opacity={0.95 * lit} />
          <ellipse cx={x + 21} cy={y - 18} rx={1.8} ry={4.4} fill="#FFF0C0" opacity={lit} />
        </>
      ) : null}
    </g>
  );
};

/**
 * A synagogue (Nazareth, Capernaum, Pisidian Antioch): stone walls and columns, three tiers of stone benches along the
 * back (`crowd` 0..1 seats a congregation on them), the Torah niche with its curtain at `ax`, hanging lamps, high windows
 * with shafts of daylight (`day` 0..1), and the reading platform with its desk and an open scroll at `bx` in the near
 * band (`onBema` is anchored on the platform at its centre: a Person at y = 0 stands on it). Children stand on the floor
 * (flat near band at p(880, 1380)).
 */
export const SynagogueSet: React.FC<{ cam: CamT; seed: string; children?: React.ReactNode; fx?: React.ReactNode; crowd?: number; day?: number; lamp?: number; ax?: number; bx?: number; bema?: boolean; onBema?: React.ReactNode; scroll?: boolean }> = ({
  cam,
  seed,
  children,
  fx,
  crowd = 0.7,
  day = 1,
  lamp = 1,
  ax,
  bx,
  bema = true,
  onBema,
  scroll = true,
}) => {
  const { p, W } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const { base } = useInterior();
  const wall = "#7A6A52";
  const cols = p(5, 3);
  const colX = (i: number) => (W / cols) * (i + 0.5);
  const A = ax ?? p(960, 540);
  const B = bx ?? p(1300, 760);
  const flick = 0.88 + 0.12 * Math.sin(f * 0.33) * Math.sin(f * 0.11 + 1);
  const lamps = Array.from({ length: cols - 1 }, (_, i) => ({ x: (W / cols) * (i + 1), y: base - p(420, 560) }));
  const seated: React.ReactNode[] = [];
  if (crowd > 0)
    for (let t = 0; t < 2; t++) {
      const n = Math.round(p(16, 9) * crowd);
      for (let i = 0; i < n; i++) {
        const sx = range(`${seed}cx${t}${i}`, -40, W + 40);
        if (Math.abs(sx - A) < p(150, 120)) continue;
        seated.push(<Person key={`${t}-${i}`} x={sx} y={base - 26 - t * 26} s={0.62 - t * 0.04} look={CROWD(i + t * 3)} pose={{ sit: 1, arm: [30, 40] }} flip={random(`${seed}cf${t}${i}`) > 0.5} shadow={false} opacity={0.88} />);
      }
    }
  return (
    <Interior
      cam={cam}
      seed={seed}
      wall={wall}
      floorC="#4A3E30"
      glows={[...lamps.map((l) => ({ x: l.x, y: l.y + 10, size: p(520, 480), a: 0.3 * lamp * flick })), { x: W / 2, y: base - p(500, 640), size: p(1600, 1400), a: 0.16 * day, color: "255,236,200" }]}
      back={
        <>
          {Array.from({ length: cols }, (_, i) => (
            <g key={`c${i}`}>
              <rect x={colX(i) - 26} y={-200} width={52} height={base + 200} fill={tone(wall, 0.12)} stroke="rgba(255,220,170,0.3)" strokeWidth={1.2} />
              <rect x={colX(i) - 34} y={base - p(560, 760)} width={68} height={16} fill={tone(wall, 0.2)} />
              <rect x={colX(i) + 8} y={-200} width={6} height={base + 200} fill="rgba(255,236,200,0.12)" />
            </g>
          ))}
          {[0, 1, 2].map((t) => (
            <rect key={`b${t}`} x={-800} y={base - 26 * (t + 1)} width={W + 1600} height={26} fill={tone(wall, -0.1 - t * 0.06)} stroke="rgba(255,220,170,0.18)" strokeWidth={1} />
          ))}
          {seated}
          <g>
            <rect x={A - 90} y={base - 330} width={180} height={252} fill={tone(wall, -0.2)} stroke="rgba(255,220,170,0.35)" strokeWidth={1.2} />
            <path d={`M ${A - 104} ${base - 330} L ${A} ${base - 400} L ${A + 104} ${base - 330} Z`} fill={tone(wall, 0.1)} stroke="rgba(255,220,170,0.35)" strokeWidth={1.2} />
            <path d={`M ${A - 70} ${base - 80} L ${A - 70} ${base - 270} Q ${A} ${base - 320} ${A + 70} ${base - 270} L ${A + 70} ${base - 80} Z`} fill="#2A3A6A" />
            <path d={`M ${A - 70} ${base - 120} L ${A + 70} ${base - 120}`} stroke="#C8A050" strokeWidth={3} />
            {[-50, -25, 0, 25, 50].map((o) => (
              <line key={o} x1={A + o} y1={base - 280} x2={A + o} y2={base - 82} stroke="rgba(10,16,40,0.4)" strokeWidth={2} />
            ))}
            {[-1, 1].map((d) => (
              <rect key={d} x={A + d * 82 - 8} y={base - 330} width={16} height={252} fill={tone(wall, 0.16)} />
            ))}
          </g>
          {Array.from({ length: cols - 1 }, (_, i) => (
            <SkyWindow key={`w${i}`} x={(W / cols) * (i + 1)} y={base - p(600, 820)} w={p(54, 60)} h={p(110, 120)} tod={0.45} wall={wall} seed={`${seed}w${i}`} />
          ))}
          {day > 0
            ? Array.from({ length: cols - 1 }, (_, i) => {
                const wx = (W / cols) * (i + 1);
                const wy = base - p(600, 820);
                return <path key={`sh${i}`} d={`M ${wx - 20} ${wy} L ${wx + 20} ${wy} L ${wx + p(180, 160)} ${base} L ${wx + p(60, 50)} ${base} Z`} fill={`rgba(255,236,196,${(0.08 * day).toFixed(3)})`} />;
              })
            : null}
          {lamps.map((l, i) => (
            <g key={`l${i}`}>
              <line x1={l.x} y1={-100} x2={l.x} y2={l.y - 12} stroke="#6A5A3A" strokeWidth={1.4} />
              <path d={`M ${l.x - 18} ${l.y - 12} Q ${l.x} ${l.y + 8} ${l.x + 18} ${l.y - 12} Z`} fill="#9A7A3A" />
              {lamp > 0 ? <ellipse cx={l.x} cy={l.y - 20} rx={4} ry={9 * flick} fill="#FFB050" opacity={lamp} /> : null}
            </g>
          ))}
        </>
      }
      fx={fx}
    >
      {bema ? (
        <g>
          <BemaPlatform x={B} scroll={scroll} k={K.near} onBema={onBema} />
        </g>
      ) : null}
      {children}
    </Interior>
  );
};

const BemaPlatform: React.FC<{ x: number; k: number; scroll: boolean; onBema?: React.ReactNode }> = ({ x, k, scroll, onBema }) => {
  const band = useBand();
  const gy = band.gy(x);
  const wood = "#5E4430";
  return (
    <g transform={`translate(${x} ${gy}) scale(${k})`}>
      <ellipse cx={0} cy={2} rx={170} ry={8} fill="rgba(0,0,0,0.35)" />
      <rect x={-150} y={-30} width={300} height={30} fill={wood} stroke="rgba(255,210,150,0.45)" strokeWidth={1.2} />
      <rect x={-156} y={-36} width={312} height={8} fill={tone(wood, 0.12)} />
      {[-90, 0, 90].map((o) => (
        <line key={o} x1={o} y1={-28} x2={o} y2={0} stroke={tone(wood, -0.3)} strokeWidth={1.2} />
      ))}
      <g transform="translate(96 -36)">
        <path d="M -8 0 L -4 -76 L 4 -76 L 8 0 Z" fill={tone(wood, -0.1)} />
        <path d="M -40 -72 L 40 -86 L 42 -78 L -38 -64 Z" fill={tone(wood, 0.1)} stroke="rgba(255,210,150,0.45)" strokeWidth={1} />
        {scroll ? (
          <g>
            <path d="M -30 -76 L 30 -87 L 30 -82 L -30 -71 Z" fill="#E8DCC0" />
            <rect x={-36} y={-82} width={8} height={14} rx={3} fill="#C8B890" transform="rotate(-10 -32 -75)" />
            <rect x={28} y={-94} width={8} height={14} rx={3} fill="#C8B890" transform="rotate(-10 32 -87)" />
          </g>
        ) : null}
      </g>
      {onBema ? (
        <g transform="translate(0 -36)">
          <NoScale>{onBema}</NoScale>
        </g>
      ) : null}
    </g>
  );
};

/**
 * The upper room (Mark 14:15, Acts 1:13, John 20:19): plastered walls under dark ceiling beams, two arched windows on the
 * night sky (`night` 0..1; `moon`), lamp niches, a door on the left (`door` 0..1 open), and the low SupperTable at `tx`
 * (`table`; `len`, `bread`, `broken`, `cup` passed through; top at -58). `behind` is drawn before the table (guests seated
 * behind it: Person pose sit: 1 at y = floor; their laps hidden), children after it (in front). `fire` 0..1 fills the room
 * with warm light for Pentecost (put TonguesOfFire over the heads), `wind` 0..1 sends swirling streaks of light (Acts 2:2).
 * With table={false} it is any plain room: Mary's house, Cornelius's house, Paul's rented room.
 */
export const UpperRoomSet: React.FC<{
  cam: CamT;
  seed: string;
  children?: React.ReactNode;
  behind?: React.ReactNode;
  fx?: React.ReactNode;
  night?: number;
  moon?: boolean;
  lamps?: number;
  table?: boolean;
  tx?: number;
  len?: number;
  bread?: number;
  broken?: boolean;
  cup?: boolean;
  door?: number;
  fire?: number;
  wind?: number;
  wall?: string;
}> = ({ cam, seed, children, behind, fx, night = 1, moon = true, lamps = 1, table = true, tx, len, bread = 3, broken = false, cup = true, door = 0, fire = 0, wind = 0, wall = "#7A6650" }) => {
  const { p, W } = useLayout();
  const f = useCurrentFrame();
  const { base } = useInterior();
  const flick = 0.86 + 0.14 * Math.sin(f * 0.37) * Math.sin(f * 0.13 + 1);
  const T = tx ?? p(1000, 560);
  const tod = lerp(0.42, 0.9, night);
  const winX = [p(700, 380), p(1500, 860)];
  const dx = p(200, 120);
  return (
    <Interior
      cam={cam}
      seed={seed}
      wall={wall}
      floorC="#4A3A2A"
      warm={fire}
      glows={[
        { x: p(1180, 680), y: base - p(250, 300), size: p(1200, 1100), a: 0.35 * lamps * flick },
        { x: p(320, 170), y: base - p(250, 300), size: p(900, 800), a: 0.25 * lamps * flick },
        { x: W / 2, y: base - p(300, 400), size: p(1900, 1600), a: 0.45 * fire, color: "255,190,110" },
      ]}
      back={
        <>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={`bm${i}`} x={-400 + i * ((W + 800) / 8)} y={base - p(700, 900)} width={24} height={p(60, 70)} fill="#2A1E14" />
          ))}
          <rect x={-800} y={base - p(700, 900)} width={W + 1600} height={p(26, 30)} fill="#3A2A1C" />
          {winX.map((wx, i) => (
            <SkyWindow key={i} x={wx} y={base - p(330, 420)} w={p(90, 96)} h={p(200, 220)} tod={tod} wall={wall} seed={`${seed}w${i}`} moon={moon && i === 1} />
          ))}
          <LampNiche x={p(1180, 680)} y={base - p(230, 280)} lit={lamps} />
          <LampNiche x={p(320, 170)} y={base - p(230, 280)} lit={lamps} />
          <g>
            <rect x={dx - 70} y={base - 290} width={140} height={290} fill="#120C08" />
            <g transform={`translate(${dx - 70} 0) scale(${lerp(1, 0.15, door)} 1) translate(${-(dx - 70)} 0)`}>
              <rect x={dx - 70} y={base - 290} width={140} height={290} fill="#4A3220" stroke="rgba(255,200,140,0.35)" strokeWidth={1.2} />
              {[-35, 0, 35].map((o) => (
                <line key={o} x1={dx + o} y1={base - 286} x2={dx + o} y2={base - 4} stroke="rgba(10,6,4,0.45)" strokeWidth={2} />
              ))}
              <rect x={dx - 74} y={base - 150} width={148} height={10} fill="#2A1A10" />
            </g>
            <rect x={dx - 80} y={base - 300} width={160} height={12} fill={tone(wall, -0.3)} />
          </g>
        </>
      }
      fx={
        <>
          {wind > 0 ? (
            <Svg>
              {Array.from({ length: 9 }, (_, i) => {
                const ph = mod(f * 0.012 * (1 + (i % 3) * 0.3) + random(`${seed}wd${i}`), 1);
                const y0 = p(200, 400) + i * p(70, 110);
                const x0 = -300 + ph * (W + 600);
                return <path key={i} d={`M ${x0} ${y0} q ${p(160, 120)} ${-p(60, 50)} ${p(320, 240)} 0 t ${p(320, 240)} 0`} stroke={`rgba(255,240,214,${(0.22 * wind * Math.sin(Math.PI * ph)).toFixed(3)})`} strokeWidth={3} fill="none" strokeLinecap="round" />;
              })}
            </Svg>
          ) : null}
          {fx}
        </>
      }
    >
      {behind}
      {table ? <SupperTable x={T} s={1} len={len ?? p(900, 560)} bread={bread} broken={broken} cup={cup} lamps={2} lit={lamps} seed={`${seed}st`} /> : null}
      {children}
    </Interior>
  );
};

/**
 * A prison cell (Acts 5:19, 12:6, 16:24): dark stone walls, a small barred window high up with a shaft of moonlight, iron
 * chains on the wall at `cx`, a heavy door on the right (`door` 0..1 opens it onto light), a torch bracket (`torch`), and
 * wooden Stocks on the floor at `sx` (`stocks`; `open` lifts them). `quake` 0..1 shakes the cell and sifts dust down;
 * `light` 0..1 fills it with the light of an angel (Acts 12:7). Children stand or sit on the floor (p(880, 1380)).
 */
export const PrisonSet: React.FC<{ cam: CamT; seed: string; children?: React.ReactNode; fx?: React.ReactNode; door?: number; torch?: number; quake?: number; light?: number; stocks?: boolean; sx?: number; open?: number; cx?: number; loose?: number }> = ({
  cam,
  seed,
  children,
  fx,
  door = 0,
  torch = 0.8,
  quake = 0,
  light = 0,
  stocks = true,
  sx,
  open = 0,
  cx,
  loose = 0,
}) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const { base } = useInterior();
  const wall = "#4E4840";
  const flick = 0.85 + 0.15 * Math.sin(f * 0.41) * Math.sin(f * 0.17 + 2);
  const shake = quake > 0 ? { x: Math.sin(f * 1.7) * 10 * quake, y: Math.cos(f * 2.3) * 6 * quake } : undefined;
  const wx = p(760, 420);
  const wy = base - p(520, 700);
  const dX = W - p(260, 150);
  return (
    <Interior
      cam={cam}
      seed={seed}
      wall={wall}
      floorC="#2E2A24"
      shake={shake}
      rim="200,214,255"
      glows={[{ x: p(1500, 860), y: base - p(330, 420), size: p(900, 800), a: 0.4 * torch * flick }, { x: W / 2, y: base - p(300, 400), size: p(1800, 1500), a: 0.6 * light, color: "255,240,214" }]}
      back={
        <>
          {Array.from({ length: 14 }, (_, r) =>
            Array.from({ length: 16 }, (_, c) => (
              <rect key={`${r}-${c}`} x={-300 + c * ((W + 600) / 15) + (r % 2) * ((W + 600) / 30)} y={base - (r + 1) * p(64, 80)} width={(W + 600) / 15 - 6} height={p(60, 76)} fill="none" stroke="rgba(20,16,12,0.45)" strokeWidth={2} />
            )),
          )}
          <rect x={wx - 50} y={wy - 70} width={100} height={70} fill={mixHex("#0A1020", "#6A7AA0", 0.6)} />
          {[-30, -10, 10, 30].map((o) => (
            <line key={o} x1={wx + o} y1={wy - 70} x2={wx + o} y2={wy} stroke="#1A1A1E" strokeWidth={5} />
          ))}
          <path d={`M ${wx - 40} ${wy} L ${wx + 40} ${wy} L ${wx + p(260, 200)} ${base} L ${wx + p(80, 60)} ${base} Z`} fill="rgba(190,206,240,0.08)" />
          <PrisonChains x={cx ?? p(380, 200)} y={base - p(300, 360)} len={110} loose={loose} />
          <PrisonChains x={(cx ?? p(380, 200)) + p(140, 120)} y={base - p(300, 360)} len={130} loose={loose} seed={`${seed}c2`} />
          <rect x={dX - 90} y={base - 300} width={180} height={300} fill={door > 0 ? mixHex("#0C0806", "#E8D8B0", door * 0.7) : "#0C0806"} />
          <g transform={`translate(${dX + 90} 0) scale(${lerp(1, 0.12, door)} 1) translate(${-(dX + 90)} 0)`}>
            <rect x={dX - 90} y={base - 300} width={180} height={300} fill="#3A2C1E" stroke="rgba(200,214,255,0.3)" strokeWidth={1.2} />
            {[-60, -20, 20, 60].map((o) => (
              <line key={o} x1={dX + o} y1={base - 296} x2={dX + o} y2={base - 4} stroke="rgba(10,6,4,0.5)" strokeWidth={2} />
            ))}
            {[0.2, 0.75].map((t) => (
              <rect key={t} x={dX - 92} y={base - 300 + 300 * t} width={184} height={12} fill="#2A2A30" />
            ))}
          </g>
          {torch > 0 ? (
            <g>
              <path d={`M ${p(1500, 860) - 8} ${base - p(300, 380)} L ${p(1500, 860) + 8} ${base - p(300, 380)} L ${p(1500, 860) + 4} ${base - p(250, 330)} L ${p(1500, 860) - 4} ${base - p(250, 330)} Z`} fill="#3A3A40" />
              <ellipse cx={p(1500, 860)} cy={base - p(318, 398)} rx={8} ry={16 * flick} fill="#FF9A3A" opacity={torch} />
              <ellipse cx={p(1500, 860)} cy={base - p(314, 394)} rx={4} ry={8} fill="#FFF0C0" opacity={torch} />
            </g>
          ) : null}
        </>
      }
      fx={
        <>
          {quake > 0 ? <Dust count={60} seed={`${seed}du`} area={{ x: 0, y: 0, w: W, h: H }} color="200,190,170" opacity={0.6 * quake} vy={2.2} size={[1, 3]} /> : null}
          {fx}
        </>
      }
    >
      {stocks ? <Stocks x={sx ?? p(900, 520)} s={1} open={open} /> : null}
      {children}
    </Interior>
  );
};

// ── Passion and Easter (restrained) ───────────────────────────────────────────────────────

/**
 * Gethsemane at night (Matthew 26:36): olive trees on the slope, a flat rock at `rx` in the near band where Jesus kneels
 * (`rock`), the city's lamps on the far ridge (`city`), moonlight (`moon`) and low mist. `torches` 0..1 brings a line of
 * torches through the middle band from `tx0` (the crowd with Judas, John 18:3) – a picture of the arrest without violence.
 */
export const GethsemaneSet: React.FC<SetP & { moon?: boolean; torches?: number; tx0?: number; tx1?: number; rx?: number; rock?: boolean; city?: boolean; mist?: number }> = ({
  cam,
  seed,
  tod = 0.92,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  moon = true,
  torches = 0,
  tx0,
  tx1,
  rx,
  rock = true,
  city = true,
  mist = 0.16,
}) => {
  const { p, W } = useLayout();
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#34402E", near: "#2A3424", front: "#141A10" }}
      sky={sky ?? { clouds: 0.2, stars: 1, moon: moon ? { x: p(1480, 840), y: p(170, 400), r: p(24, 28) } : null }}
      far={
        <>
          {city ? <City x={p(420, 220)} w={p(620, 420)} s={0.6} seed={`${seed}c`} lit={0.75} color="#6A6250" /> : null}
          {far}
        </>
      }
      mid={
        <>
          {Array.from({ length: p(6, 4) }, (_, i) => (
            <Tree key={i} x={(W / p(6, 4)) * (i + 0.5) + range(`${seed}mx${i}`, -50, 50)} s={range(`${seed}ms${i}`, 1.0, 1.25)} kind="olive" seed={`${seed}m${i}`} />
          ))}
          {torches > 0 ? <Torches x0={tx0 ?? p(-60, -40)} x1={tx1 ?? p(700, 380)} n={p(8, 5)} a={torches} seed={`${seed}tc`} /> : null}
          {mid}
        </>
      }
      near={
        <>
          <Tree x={p(150, 30)} s={1.75} kind="olive" seed={`${seed}n1`} />
          <Tree x={p(1800, 1060)} s={1.55} kind="olive" flip seed={`${seed}n2`} />
          {rock ? <Boulder x={rx ?? p(1000, 560)} s={1.5} w={170} h={46} seed={`${seed}rk`} color="#3E3E3A" /> : null}
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={
        <>
          <Mist y={p(700, 1220)} h={p(200, 260)} opacity={mist} seed={`${seed}mi`} color="190,200,220" />
          {fx}
        </>
      }
    />
  );
};

/**
 * Golgotha seen from far off, reverent and restrained (John 19:17, Luke 23:44–49): a bare hill in the middle distance at
 * `gx` with three tall crosses as dark silhouettes (the middle one taller; `crosses` false leaves the hill empty), the
 * city wall on the far left, small figures at the foot of the hill, the near ground where the women watch from a distance
 * (Person s ≈ 1 in the near band). Never a figure on a cross. `dark` 0..1 is the darkness over the land from the sixth to
 * the ninth hour; `quake` 0..1 shakes the ground (Matthew 27:51); `light` 0..1 a thin break of light on the horizon.
 */
export const GolgothaSet: React.FC<SetP & { dark?: number; gx?: number; crosses?: boolean; quake?: number; city?: boolean; crowd?: number; light?: number }> = ({
  cam,
  seed,
  tod = 0.6,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  dark = 0,
  gx,
  crosses = true,
  quake = 0,
  city = true,
  crowd = 0.6,
  light = 0,
}) => {
  const { p, W, hz } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const geo = useLandGeo("hills", seed);
  const X = gx ?? p(1150, 620);
  const hw = p(330, 260);
  const hh = p(120, 120);
  const base = (x: number) => {
    const u = (x - X) / hw;
    return Math.abs(u) >= 1 ? 0 : hh * Math.pow(Math.cos((u * Math.PI) / 2), 1.6);
  };
  const shake = quake > 0 ? `translate(${(Math.sin(f * 1.9) * 9 * quake).toFixed(1)}px, ${(Math.cos(f * 2.7) * 5 * quake).toFixed(1)}px)` : undefined;
  const sil = mixHex("#2A2420", "#0E0C0A", dark);
  const set = (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={Math.max(storm, dark * 0.9)}
      colors={{ mid: "#6A6048", near: "#4E4634", front: "#221E16" }}
      sky={sky ?? { sun: dark > 0.25 ? null : { x: p(1740, 960), y: p(360, 800) }, clouds: 0.35 + dark * 0.5 }}
      far={
        <>
          {city ? (
            <g opacity={1 - 0.55 * dark}>
              <JerusalemCity x={p(300, 150)} s={p(0.3, 0.26)} w={1400} seed={`${seed}jc`} />
            </g>
          ) : null}
          {far}
        </>
      }
      mid={
        <>
          <MidHill X={X} hw={hw} base={base} dark={dark} />
          {crosses
            ? [-1, 0, 1].map((i) => {
                const cxx = X + i * p(92, 78);
                const sc = (i === 0 ? 0.42 : 0.34) * p(1, 0.95);
                return <CrossOnHill key={i} x={cxx} lift={base(cxx)} s={sc} color={sil} />;
              })
            : null}
          {crowd > 0
            ? Array.from({ length: Math.round(p(12, 8) * crowd) }, (_, i) => {
                const px = X - hw * 1.4 + (i / (p(12, 8) * crowd)) * hw * 2.8 + range(`${seed}cx${i}`, -12, 12);
                return <Person key={i} x={px} s={0.24} look={{ robe: sil, head: i % 3 ? "cloth" : "helmet", mantle: sil, short: i % 3 === 0 }} flip={px > X} shadow={false} />;
              })
            : null}
          {mid}
        </>
      }
      near={
        <>
          <Boulder x={p(260, 100)} s={1.6} w={90} h={44} seed={`${seed}r1`} color="#4A4438" />
          <Boulder x={p(1720, 1000)} s={1.3} w={80} h={36} seed={`${seed}r2`} color="#4A4438" />
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={
        <>
          {dark > 0 ? <Tint color="#120A06" opacity={0.38 * dark} /> : null}
          {dark > 0 ? <Glow x={W / 2} y={hz} size={p(2200, 1600)} squash={0.25} color="160,96,48" opacity={0.35 * dark} /> : null}
          {light > 0 ? <Glow x={p(1500, 860)} y={hz - p(30, 40)} size={p(1400, 1000)} squash={0.3} color="255,226,170" opacity={0.6 * light} /> : null}
          {quake > 0 ? <Dust count={50} seed={`${seed}du`} area={{ x: 0, y: geo.near.base - 200, w: W, h: 400 }} color="170,150,120" opacity={0.5 * quake} vy={-0.6} size={[1, 3]} /> : null}
          {fx}
        </>
      }
    />
  );
  void K;
  return shake ? <AbsoluteFill style={{ transform: shake }}>{set}</AbsoluteFill> : set;
};

const MidHill: React.FC<{ X: number; hw: number; base: (x: number) => number; dark: number }> = ({ X, hw, base, dark }) => {
  const band = useBand();
  const ink = useInk();
  const id = useUid("gh");
  const ground = ink("#6A6048");
  const crest = mixHex(ground, "#2A2620", 0.4 + dark * 0.35);
  const pts: string[] = [];
  const back: string[] = [];
  for (let x = X - hw - 24; x <= X + hw + 24; x += 12) pts.push(`${pts.length ? "L" : "M"} ${x} ${(band.gy(x) - base(x)).toFixed(1)}`);
  for (let x = X + hw + 24; x >= X - hw - 24; x -= 12) back.push(`L ${x} ${(band.gy(x) + 1).toFixed(1)}`);
  return (
    <g>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={band.gy(X) - base(X)} x2={0} y2={band.gy(X)}>
          <stop offset="0" stopColor={crest} />
          <stop offset="1" stopColor={ground} />
        </linearGradient>
      </defs>
      <path d={`${pts.join(" ")} ${back.join(" ")} Z`} fill={`url(#${id})`} />
      <path d={pts.join(" ")} stroke="rgba(255,214,160,0.25)" strokeWidth={1.4} fill="none" />
    </g>
  );
};
const CrossOnHill: React.FC<{ x: number; lift: number; s: number; color: string }> = ({ x, lift, s, color }) => {
  const band = useBand();
  return <Cross x={x} y={band.gy(x) - lift + 4} s={s} color={color} lit={0.35} />;
};

/**
 * The garden with the new tomb (John 19:41, Matthew 28, John 20): a RockTomb in the near band at `tx` (scale `ts`) among
 * olive trees, cypresses and flowering bushes, a low garden wall behind. `open`, `seal`, `glow`, `clothes`, `onStone`
 * pass to the RockTomb (door at screen x = tx, door top = ground - TOMB.door × ts × K.near). Default dawn (tod 0.27);
 * `light` 0..1 sends rays of resurrection light out of the open tomb.
 */
export const GardenTombSet: React.FC<SetP & { tx?: number; ts?: number; open?: number; seal?: number; glow?: number; light?: number; onStone?: React.ReactNode; clothes?: boolean; flowers?: boolean }> = ({
  cam,
  seed,
  tod = 0.27,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  tx,
  ts,
  open = 0,
  seal = 0,
  glow = 0,
  light = 0,
  onStone,
  clothes = true,
  flowers = true,
}) => {
  const { p, W } = useLayout();
  const geo = useLandGeo("hills", seed);
  const K = useBandK();
  const X = tx ?? p(1150, 620);
  const S = ts ?? p(1, 0.85);
  const doorY = geo.near.base - 90 * S * K.near;
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(300, 160), y: p(560, 1000), a: 0.7 }, clouds: 0.3 }}
      far={far}
      mid={
        <>
          <StoneWall x0={-200} x1={W + 200} h={40} seed={`${seed}w`} />
          <Tree x={p(260, 80)} s={1.15} kind="olive" seed={`${seed}o1`} />
          <Tree x={p(560, 300)} s={1} kind="olive" seed={`${seed}o2`} />
          <Tree x={p(1700, 980)} s={1.1} kind="olive" seed={`${seed}o3`} />
          {mid}
        </>
      }
      near={
        <>
          <RockTomb x={X} s={S} open={open} seal={seal} glow={Math.max(glow, light)} clothes={clothes} onStone={onStone} seed={`${seed}rt`} />
          <Bush x={p(260, 90)} s={1.4} seed={`${seed}b1`} color="#3A5030" />
          <Bush x={X + p(340, 260)} s={1.2} seed={`${seed}b2`} color="#34482A" />
          {flowers
            ? Array.from({ length: 16 }, (_, i) => {
                const fxp = i < 8 ? p(260, 90) + range(`${seed}fx${i}`, -50, 50) : X + p(340, 260) + range(`${seed}fx${i}`, -44, 44);
                return <circle key={i} cx={fxp} cy={geo.near.base - range(`${seed}fy${i}`, 10, 50) * K.near} r={3} fill={["#E8E0F0", "#E8C060", "#C86080"][i % 3]} opacity={0.85} />;
              })
            : null}
          {near}
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={
        <>
          {light > 0 ? (
            <>
              <Rays x={X} y={doorY} count={14} length={p(900, 900)} spread={[195, 345]} width={[18, 50]} color="255,240,214" opacity={0.42 * light} blur={5} seed={`${seed}ry`} />
              <Glow x={X} y={doorY} size={p(800, 700)} color="255,240,214" opacity={0.7 * light} />
            </>
          ) : null}
          {fx}
        </>
      }
    />
  );
};

/**
 * The Praetorium (John 18:28 – 19:16, Matthew 27:24): the governor's portico of columns hung with red banners behind a
 * paved court, the JudgmentSeat on its platform at `px` (scale `ps`) in the near band with `seat` (Pilate seated) and
 * `standing` (Jesus on the platform) slots, a basin on a tripod beside it (`basin`, Pilate washing his hands), and a
 * crowd of dark heads and shoulders along the bottom of the frame (`crowd` 0..1). People in the court stand on the near
 * band (Person s ≈ 1). Platform top = ridgeY(useLandGeo("plain", seed).near, px) - 78 × ps × K.near.
 */
export const PraetoriumSet: React.FC<SetP & { px?: number; ps?: number; seat?: React.ReactNode; standing?: React.ReactNode; crowd?: number; basin?: boolean; banners?: boolean }> = ({
  cam,
  seed,
  tod = 0.34,
  near,
  mid,
  far,
  front,
  fx,
  sky,
  storm = 0,
  px,
  ps,
  seat,
  standing,
  crowd = 0.7,
  basin = false,
  banners = true,
}) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const X = px ?? p(1250, 700);
  const S = ps ?? p(1, 0.85);
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  return (
    <Land
      preset="plain"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#9A8C72", near: "#8A7A62", front: "#3E3428" }}
      sky={sky ?? { sun: { x: p(300, 160), y: p(420, 860), a: 0.7 }, clouds: 0.3 }}
      far={far}
      mid={
        <>
          <Colonnade x0={-300} x1={W + 300} h={300} double color="#D8CCB4" />
          {banners
            ? Array.from({ length: p(4, 2) }, (_, i) => {
                const bx = p(260, 200) + i * p(460, 680);
                const top = geo.mid.base - 270 * K.mid;
                return (
                  <g key={i}>
                    <line x1={bx} y1={top - 30} x2={bx} y2={top + 130 * K.mid} stroke="#6A5A3A" strokeWidth={3} />
                    <path d={`M ${bx - 30 * K.mid} ${top} L ${bx + 30 * K.mid} ${top} L ${bx + 30 * K.mid} ${top + 90 * K.mid} L ${bx} ${top + 104 * K.mid} L ${bx - 30 * K.mid} ${top + 90 * K.mid} Z`} fill="#8A1E1E" stroke="#E0B850" strokeWidth={1.4} />
                    <circle cx={bx} cy={top - 34} r={6 * K.mid} fill="#E0B850" />
                    <text x={bx} y={top + 50 * K.mid} textAnchor="middle" fontSize={15 * K.mid} fontFamily="'Palatino Linotype', serif" fill="#E8C870" fontWeight={700}>
                      SPQR
                    </text>
                  </g>
                );
              })
            : null}
          {mid}
        </>
      }
      near={
        <>
          <Paving />
          <JudgmentSeat x={X} s={S} seat={seat} standing={standing} />
          {basin ? (
            <g>
              {[-1, 0, 1].map((d) => (
                <line key={d} x1={X - p(300, 240) + d * 12} y1={geo.near.base} x2={X - p(300, 240)} y2={geo.near.base - 80 * K.near} stroke="#8A6A3A" strokeWidth={3} />
              ))}
              <path d={`M ${X - p(300, 240) - 34} ${geo.near.base - 80 * K.near} Q ${X - p(300, 240)} ${geo.near.base - 60 * K.near} ${X - p(300, 240) + 34} ${geo.near.base - 80 * K.near} Z`} fill="#B8863A" stroke="rgba(255,226,170,0.6)" strokeWidth={1} />
              <ellipse cx={X - p(300, 240)} cy={geo.near.base - 80 * K.near} rx={30} ry={4} fill="rgba(150,190,210,0.7)" />
            </g>
          ) : null}
          {near}
        </>
      }
      front={
        <>
          {crowd > 0 ? (
            <g>
              {Array.from({ length: Math.round(p(26, 14) * crowd) }, (_, i) => {
                const cx = (i + 0.5) * (W / Math.round(p(26, 14) * crowd)) + range(`${seed}cx${i}`, -20, 20);
                const cy = H - p(30, 40) + Math.sin(f * 0.1 + i) * 2 + range(`${seed}cy${i}`, -10, 20);
                const sc = range(`${seed}cs${i}`, 0.9, 1.15) * p(1, 1.1);
                return (
                  <g key={i} transform={`translate(${cx} ${cy}) scale(${sc})`}>
                    <path d="M -46 40 Q -44 -10 -20 -16 L 20 -16 Q 44 -10 46 40 Z" fill="#14100C" stroke="rgba(255,200,150,0.25)" strokeWidth={1.2} />
                    <circle cx={0} cy={-36} r={20} fill="#14100C" stroke="rgba(255,200,150,0.25)" strokeWidth={1.2} />
                    {i % 4 === 0 ? (
                      <>
                        <line x1={18} y1={-12} x2={28 + (i % 3) * 4} y2={-50} stroke="#14100C" strokeWidth={9} strokeLinecap="round" />
                        <circle cx={29 + (i % 3) * 4} cy={-55} r={7} fill="#14100C" />
                      </>
                    ) : null}
                  </g>
                );
              })}
            </g>
          ) : null}
          {front}
        </>
      }
      fx={fx}
    />
  );
};

// ── Samaria ───────────────────────────────────────────────────────────────────────────────

/**
 * Jacob's well near Sychar at noon (John 4): the well in the near band at `wx` (Person-height well curb; the woman and
 * Jesus stand beside it, s ≈ 1), a terebinth for shade, Mount Gerizim behind (`mount`), the town on the middle ridge
 * (`town`) and fields ripe for harvest (`field`, John 4:35).
 */
export const WellSet: React.FC<SetP & { wx?: number; ws?: number; field?: boolean; town?: boolean; mount?: boolean }> = ({ cam, seed, tod = 0.5, near, mid, far, front, fx, sky, storm = 0, wx, ws, field = true, town = true, mount = true }) => {
  const { p } = useLayout();
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#7A7A4A", near: "#6A6440", front: "#2E2A1A" }}
      sky={sky ?? { sun: { x: p(960, 540), y: p(140, 360) }, clouds: 0.2 }}
      far={
        <>
          {mount ? <Mountain x={p(560, 300)} w={p(1000, 700)} h={p(240, 300)} seed={`${seed}gz`} color="#6A6A58" /> : null}
          {far}
        </>
      }
      mid={
        <>
          {field ? <Field x0={p(-100, -100)} x1={p(900, 480)} n={p(110, 70)} seed={`${seed}f`} ripe={1} /> : null}
          {town ? Array.from({ length: p(7, 4) }, (_, i) => <House key={i} x={p(1300, 720) + i * p(70, 64) - (i % 2) * 16} s={0.9} w={58 + (i % 3) * 8} h={42} seed={`${seed}h${i}`} />) : null}
          {mid}
        </>
      }
      near={
        <>
          <Tree x={p(1650, 960)} s={1.5} kind="terebinth" seed={`${seed}tr`} />
          <Well x={wx ?? p(900, 520)} s={ws ?? p(1.45, 1.25)} rope />
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

// ── Greece, Asia, Rome ────────────────────────────────────────────────────────────────────

/**
 * Athens (Acts 17). `view` "areopagus" (default): the rocky Hill of Ares in the near band where Paul stands among the
 * philosophers, the Acropolis across at `ax` (scale `as`) above the city; "agora": a stoa in the middle band crowded with
 * marble statues (`statues` count), the Acropolis beyond. `altar` puts the UnknownAltar in the near band at `altarX`.
 */
export const AthensSet: React.FC<SetP & { view?: "areopagus" | "agora"; ax?: number; as?: number; lit?: number; altar?: boolean; altarX?: number; statues?: number }> = ({
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
  view = "areopagus",
  ax,
  as,
  lit,
  altar = false,
  altarX,
  statues = 4,
}) => {
  const { p, W } = useLayout();
  const night = isNight(tod);
  const L = lit ?? (night ? 0.7 : 0);
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ far: "#7A8494", mid: "#9A9078", near: view === "areopagus" ? "#7A7268" : "#8A7E68", front: "#3A3430" }}
      sky={sky ?? { sun: night ? null : { x: p(1740, 960), y: p(360, 800) }, clouds: 0.25, stars: night ? 1 : 0 }}
      far={
        <>
          {view === "agora" ? <Acropolis x={ax ?? p(1250, 700)} s={as ?? p(0.5, 0.4)} lit={L} seed={`${seed}ac`} /> : null}
          {far}
        </>
      }
      mid={
        <>
          {view === "areopagus" ? (
            <>
              {Array.from({ length: p(14, 8) }, (_, i) => (
                <House key={i} x={p(200, 80) + i * p(120, 110)} s={0.8} w={52 + (i % 3) * 10} h={40 + (i % 2) * 12} seed={`${seed}h${i}`} lit={L} color="#C8B898" />
              ))}
              <Acropolis x={ax ?? p(1150, 620)} s={as ?? p(0.85, 0.66)} lit={L} seed={`${seed}ac`} />
            </>
          ) : (
            <>
              <Colonnade x0={-300} x1={W + 300} h={250} double />
              {Array.from({ length: statues }, (_, i) => (
                <Statue key={i} x={p(240, 120) + i * ((W - p(480, 240)) / Math.max(1, statues - 1))} s={0.8} seed={`${seed}st${i}`} flip={i % 2 === 1} />
              ))}
            </>
          )}
          {mid}
        </>
      }
      near={
        <>
          {view === "areopagus" ? (
            <>
              <Boulder x={p(200, 60)} s={2.6} w={120} h={46} seed={`${seed}r1`} color="#8A8276" />
              <Boulder x={p(1700, 1000)} s={2.2} w={110} h={40} seed={`${seed}r2`} color="#827A6E" />
            </>
          ) : (
            <Paving />
          )}
          {altar ? <UnknownAltarAt x={altarX ?? p(420, 220)} /> : null}
          {near}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};
const UnknownAltarAt: React.FC<{ x: number }> = ({ x }) => <UnknownAltar x={x} s={1} />;

/**
 * Ephesus (Acts 19). `view` "theatre" (default): the great Theatre on its hillside at `cx` (scale `cs`) with `crowd` and
 * `uproar` ("Great is Artemis of the Ephesians!"), a marble street in front; "temple": the temple of Artemis, a vast
 * double-colonnaded Ionic temple; "street": a colonnaded marble street with Demetrius's workshop (`shop` puts
 * SilverShrines in the near band at `shopX`), the theatre beyond.
 */
export const EphesusSet: React.FC<SetP & { view?: "theatre" | "temple" | "street"; cx?: number; cs?: number; crowd?: number; uproar?: number; shop?: boolean; shopX?: number }> = ({
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
  view = "theatre",
  cx,
  cs,
  crowd = 0.8,
  uproar = 0,
  shop = false,
  shopX,
}) => {
  const { p, W } = useLayout();
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#8A8466", near: "#8A7E68", front: "#3A3430" }}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.25 }}
      far={
        <>
          {view === "street" ? <Theatre x={p(960, 540)} s={0.5} crowd={crowd * 0.6} seed={`${seed}tf`} /> : null}
          {far}
        </>
      }
      mid={
        <>
          {view === "theatre" ? <Theatre x={cx ?? W / 2} s={cs ?? p(0.95, 0.72)} crowd={crowd} uproar={uproar} seed={`${seed}th`} /> : null}
          {view === "temple" ? <ClassicTemple x={cx ?? W / 2} s={cs ?? p(1.2, 0.95)} w={600} h={240} cols={8} order="ionic" double /> : null}
          {view === "street" ? (
            <>
              <Colonnade x0={-300} x1={p(700, 380)} h={240} />
              <Colonnade x0={p(1220, 700)} x1={W + 300} h={240} />
            </>
          ) : null}
          {mid}
        </>
      }
      near={
        <>
          <Paving color="40,30,20" />
          {shop ? <SilverShrines x={shopX ?? p(1400, 800)} s={1} /> : null}
          {near}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/**
 * Rome (Acts 28). `view` "skyline" (default): the city across the Tiber with RomeSkyline in the middle band at `rx`
 * (scale `rs`), a paved road on the near bank lined with umbrella pines (the brothers meeting Paul on the Appian Way);
 * "house": a Roman street with Paul's rented house (RomanHouse at `hx`; `door`, `inDoor`, `lit`), more insulae beyond.
 */
export const RomeSet: React.FC<SetP & { view?: "skyline" | "house"; rx?: number; rs?: number; lit?: number; hx?: number; door?: number; inDoor?: React.ReactNode }> = ({
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
  view = "skyline",
  rx,
  rs,
  lit,
  hx,
  door = 0,
  inDoor,
}) => {
  const { p, W, hz } = useLayout();
  const night = isNight(tod);
  const L = lit ?? (night ? 0.7 : 0);
  const K = useBandK();
  return (
    <Land
      preset="plain"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      colors={{ mid: "#7A7A56", near: view === "house" ? "#7A6E5A" : "#6A6A48", front: "#2E2A1E" }}
      sky={sky ?? { sun: night ? null : { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3, stars: night ? 1 : 0 }}
      far={far}
      mid={
        <>
          <RomeSkyline x={rx ?? W / 2} s={rs ?? (view === "house" ? p(0.6, 0.45) : p(0.85, 0.62))} lit={L} seed={`${seed}rm`} />
          {mid}
        </>
      }
      near={
        <>
          {view === "house" ? (
            <>
              <Paving color="30,24,18" />
              <RomanHouse x={hx ?? p(1150, 600)} s={p(1, 0.85)} lit={L} door={door} inDoor={inDoor} />
            </>
          ) : (
            <>
              <path d={`M -300 ${hz + p(330, 420)} L ${W + 300} ${hz + p(310, 400)} L ${W + 300} ${hz + p(400, 520)} L -300 ${hz + p(420, 540)} Z`} fill="rgba(150,140,120,0.5)" />
              {[p(140, 50), p(1780, 1030)].map((px, i) => (
                <g key={i} transform={`translate(${px} ${hz + p(270, 330)}) scale(${K.near * 1.2})`}>
                  <path d="M -4 0 Q -8 -80 0 -150 L 6 -150 Q 10 -80 6 0 Z" fill="#4A3A2A" />
                  <ellipse cx={0} cy={-160} rx={80} ry={26} fill="#34482A" />
                  <ellipse cx={-14} cy={-168} rx={52} ry={14} fill="#425A32" />
                </g>
              ))}
            </>
          )}
          {near}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/**
 * Paul's voyage (Acts 27–28). `view`:
 *  "sea" (default): the MerchantShip on the open sea at `sx` (scale `ss`), `sail`, rolling in a `storm` 0..1 (rain,
 *    lightning at `flash` frames, swells across the bottom); `deck` is anchored on its deck amidships.
 *  "wreck": the ship run aground on a reef and breaking up (`broken` 0..1), surf on the rocks, the shore beyond.
 *  "shore": Malta: a rocky beach in the near band where people stand (s ≈ 1) round a fire at `fireX` (`fire` 0..1,
 *    Acts 28:2), cold rain, the wreck far out on the reef.
 */
export const ShipSet: React.FC<{
  cam: CamT;
  seed: string;
  tod?: number;
  storm?: number;
  view?: "sea" | "wreck" | "shore";
  sx?: number;
  sy?: number;
  ss?: number;
  sail?: number;
  broken?: number;
  deck?: React.ReactNode;
  near?: React.ReactNode;
  onWater?: React.ReactNode;
  fx?: React.ReactNode;
  flash?: number[];
  fire?: number;
  fireX?: number;
  sky?: SkyP;
  coast?: boolean;
}> = ({ cam, seed, tod = 0.42, storm = 0, view = "sea", sx, sy, ss, sail = 1, broken = 0.5, deck, near, onWater, fx, flash = [], fire = 1, fireX, sky, coast = false }) => {
  const { p, W, hz } = useLayout();
  const f = useCurrentFrame();
  const K = useBandK();
  const g = useLandGeo("hills", seed);
  const night = isNight(tod);
  const sea = mixHex("#2A4A5A", "#1A2A32", storm * 0.6);
  const wy = hz + p(24, 36);
  const roll = storm * 5 * Math.sin(f * 0.05 + 1);
  const bob = storm * 10 * Math.sin(f * 0.07);
  const reef = (x: number, y: number, k: number, key: string) => (
    <g key={key}>
      {[-60, -20, 30, 70].map((o, i) => (
        <path key={i} d={`M ${x + o * k - 40 * k} ${y} L ${x + o * k - 14 * k} ${y - range(`${seed}${key}h${i}`, 20, 50) * k} L ${x + o * k + 10 * k} ${y - range(`${seed}${key}j${i}`, 14, 36) * k} L ${x + o * k + 36 * k} ${y} Z`} fill="#2A2824" stroke="rgba(255,226,180,0.3)" strokeWidth={1} />
      ))}
      {Array.from({ length: 10 }, (_, i) => {
        const age = mod(f * 1.4 + i * 9 + random(`${seed}${key}s${i}`) * 30, 40) / 40;
        return <ellipse key={`s${i}`} cx={x + range(`${seed}${key}x${i}`, -110, 110) * k} cy={y - age * 50 * k} rx={(10 + age * 26) * k} ry={(5 + age * 12) * k} fill={`rgba(236,242,246,${(0.5 * (1 - age)).toFixed(3)})`} />;
      })}
    </g>
  );
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} storm={storm} clouds={0.3 + storm * 0.6} stars={night ? 1 - storm : 0} sun={night || storm > 0.4 ? null : { x: p(1720, 940), y: p(340, 780) }} {...sky} />
      {view !== "sea" || coast ? (
        <Band depth={0.12} ridge={{ base: hz - 6, amp: p(60, 70), seed: `${seed}f` }} peaks fill="#4E5450" haze={0.5} edge={0.35} k={K.far} />
      ) : null}
      <Water
        depth={0.4}
        y={wy}
        color={sea}
        deep="#04101A"
        rough={0.12 + storm * 0.85}
        k={K.mid}
        shine={night || storm > 0.3 ? null : { x: p(1700, 940), a: 0.5 }}
        front={
          <>
            {view === "sea" ? <MerchantShip x={sx ?? W / 2} y={sy ?? p(860, 1320)} s={ss ?? p(0.62, 0.62)} sail={sail} storm={storm} roll={roll} bob={bob} deck={deck} water={sea} seed={`${seed}ms`} /> : null}
            {view === "wreck" ? (
              <>
                <MerchantShip x={sx ?? W / 2} y={sy ?? p(880, 1340)} s={ss ?? p(0.6, 0.6)} sail={0} storm={storm} aground={1} broken={broken} deck={deck} water={sea} seed={`${seed}ms`} />
                {reef((sx ?? W / 2) + p(80, 50), (sy ?? p(880, 1340)) + p(14, 18), 1.4 * K.mid, "r1")}
              </>
            ) : null}
            {view === "shore" ? (
              <>
                {reef(sx ?? p(1400, 800), sy ?? wy + p(20, 26), 0.5 * K.mid, "r2")}
                <MerchantShip x={sx ?? p(1400, 800)} y={sy ?? wy + p(20, 26)} s={ss ?? 0.16} sail={0} aground={1} broken={broken} water={sea} seed={`${seed}ms`} />
              </>
            ) : null}
            {onWater}
          </>
        }
      />
      {view !== "shore" && storm > 0.05 ? <Swells y0={p(900, 1420)} storm={storm} seed={`${seed}sw`} color={tone(sea, -0.2)} /> : null}
      {view === "shore" ? (
        <>
          <Band depth={0.8} ridge={{ ...g.near, base: g.near.base + p(20, 30) }} fill="#6A6050" fill2="#2A2620" haze={0.04} edge={0.5} k={K.near}>
            <Boulder x={p(200, 60)} s={2.2} w={100} h={50} seed={`${seed}r1`} color="#3A3632" />
            <Boulder x={p(1750, 1020)} s={1.8} w={90} h={44} seed={`${seed}r2`} color="#3A3632" />
            {fire > 0 ? <Hearth x={fireX ?? p(900, 520)} s={1.6} p={fire} /> : null}
            {near}
          </Band>
          <Band depth={1} ridge={g.front} fill="#2A2620" haze={0} edge={0.3} k={K.front} />
          {fire > 0 ? <Smoke x={fireX ?? p(900, 520)} y={g.near.base + p(20, 30) - 40 * K.near} s={1.2} n={10} rise={1.4} drift={0.5} opacity={0.35 * fire} seed={`${seed}sm`} /> : null}
        </>
      ) : null}
      {storm > 0.05 ? <Rain intensity={storm} angle={22} seed={`${seed}rn`} /> : null}
      {flash.map((at, i) => (
        <Lightning key={i} at={at} x={p(500 + i * 600, 260 + i * 360)} y={hz - 30} seed={`${seed}lt${i}`} />
      ))}
      {storm > 0 ? <Tint color="#0A1018" opacity={0.25 * storm} /> : null}
      {fx}
    </Stage>
  );
};
