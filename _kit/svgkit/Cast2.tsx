import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Mist, Tint } from "./Atmos";
import { range } from "./anim";
import { skyAt } from "./color";
import { Svg } from "./Film";
import { useLayout } from "./layout";
import { Look, ROBES } from "./Person";
import { Field, Rock, Tree } from "./Plants";
import { City, House } from "./Props";
import { Gate, StoneWall, Tabernacle } from "./Props2";
import { CaveMouth, Host, RoofHouse, Seat, Stream } from "./Props3";
import { Band, Land, LandPreset, Sky, Stage, ridgeY, useBandK, useCam, useLandGeo } from "./Stage";
import { dryGrass, lushGrass } from "./Cast";

/**
 * Recurring people and places for 1–2 Samuel (Hannah to Absalom), so every film draws them the same way.
 * Characters age across the films: use the variant that fits the scene (SAMUEL_BOY in Shiloh, SAMUEL as judge,
 * SAMUEL_OLD from Saul's anointing on; DAVID_YOUTH until Goliath, DAVID as a fugitive, DAVID_KING from Hebron on).
 */

// ── People ──────────────────────────────────────────────────────────────────────────────

export const HANNAH: Look = { robe: ROBES.blue, head: "veil", mantle: "#7A8AA0" };
export const PENINNAH: Look = { robe: ROBES.wine, head: "veil", mantle: "#9A7A68", sash: "#C89A40" };
export const ELKANAH: Look = { robe: ROBES.brown, head: "cloth", mantle: "#8A7A5A", beard: true };
export const ELI: Look = { robe: ROBES.white, head: "cloth", mantle: "#4A5A7A", sash: "#8A2A22", beard: "white" };
export const ELI_SON = (i = 0): Look => ({ robe: ROBES.white, head: "cloth", mantle: ["#6A2A44", "#8A2A22"][i % 2], sash: "#2A3A6A", beard: true });
/** Samuel as a boy minister in Shiloh: a linen ephod. Use child 0.6–0.8. */
export const SAMUEL_BOY: Look = { robe: ROBES.linen, head: "hair", child: 0.7, sash: "#C8B888" };
export const SAMUEL: Look = { robe: ROBES.umber, head: "cloth", mantle: "#6A6070", beard: true, staff: "staff" };
export const SAMUEL_OLD: Look = { robe: ROBES.umber, head: "cloth", mantle: "#7A7088", beard: "white", staff: "staff" };
export const PROPHET = (i = 0): Look => ({ robe: [ROBES.umber, ROBES.grey, ROBES.brown][i % 3], head: "hood", beard: i % 2 ? "white" : true });

/** Saul is "a head taller" than everyone: draw him at s ≈ 1.12 beside others at 1.0. */
export const SAUL: Look = { robe: ROBES.red, head: "cloth", mantle: "#6A2A44", beard: true };
export const SAUL_KING: Look = { robe: ROBES.red, head: "crown", mantle: "#6A2A44", sash: "#C89A40", beard: true, hold: "spear" };
export const SAUL_ARMED: Look = { robe: ROBES.red, head: "helmet", mantle: "#6A2A44", beard: true, armor: true, short: true, hold: "spear" };
export const JONATHAN: Look = { robe: ROBES.wine, head: "hair", mantle: "#C89A40", sash: "#C89A40", beard: true, short: true, hold: "bow" };
export const JESSE: Look = { robe: ROBES.olive, head: "cloth", mantle: "#8A8060", beard: "white", staff: "staff" };
export const BROTHER = (i: number): Look => ({ robe: [ROBES.brown, ROBES.olive, ROBES.umber, ROBES.blue, ROBES.grey, ROBES.sand, ROBES.teal][i % 7], head: "helmet", beard: i % 3 !== 2, short: true, hold: i % 2 ? "spear" : "sword" });
/** David: ruddy, a shepherd boy with a crook and a lyre; then a warrior; then a king. */
export const DAVID_SKIN = "#8A5A3C";
export const DAVID_YOUTH: Look = { robe: ROBES.sand, head: "hair", skin: DAVID_SKIN, sash: "#8A2A22", short: true };
export const DAVID: Look = { robe: ROBES.red, head: "hair", skin: DAVID_SKIN, mantle: "#8A6A50", beard: true, short: true };
export const DAVID_KING: Look = { robe: ROBES.blue, head: "crown", skin: DAVID_SKIN, mantle: "#2A3A6A", sash: "#C89A40", beard: true };
export const MICHAL: Look = { robe: ROBES.wine, head: "veil", mantle: "#B89A70", sash: "#C89A40" };
export const ABIGAIL: Look = { robe: ROBES.teal, head: "veil", mantle: "#9A8A70" };
export const AHIMELECH: Look = { robe: ROBES.white, head: "cloth", mantle: "#E8E0CC", sash: "#2A3A6A", beard: "white" };
export const ABNER: Look = { robe: ROBES.indigo, head: "helmet", beard: true, short: true, armor: "#6A6A6E", hold: "spear" };
export const JOAB: Look = { robe: ROBES.umber, head: "helmet", beard: true, short: true, armor: "#7A6A4A", hold: "sword" };
export const ABISHAI: Look = { robe: ROBES.olive, head: "helmet", beard: true, short: true, hold: "spear" };
export const NATHAN: Look = { robe: ROBES.indigo, head: "hood", mantle: "#5A5A6A", beard: "white", staff: "staff" };
export const BATHSHEBA: Look = { robe: ROBES.teal, head: "veil", mantle: "#C8B898", sash: "#C89A40" };
export const URIAH: Look = { robe: ROBES.olive, head: "helmet", beard: true, short: true, armor: "#6A6A6E", hold: "spear" };
/** Absalom's famous hair: long and heavy; no beard, a prince's gold sash. */
export const ABSALOM: Look = { robe: ROBES.wine, head: "long", mantle: "#C89A40", sash: "#C89A40" };
export const AMNON: Look = { robe: ROBES.indigo, head: "hair", sash: "#C89A40", beard: true };
export const TAMAR: Look = { robe: "#7A3A5A", head: "veil", mantle: "#C8A060", sash: "#E8C060" };
export const AHITHOPHEL: Look = { robe: ROBES.grey, head: "cloth", mantle: "#6A6A5A", beard: "white" };
export const HUSHAI: Look = { robe: ROBES.brown, head: "cloth", mantle: "#7A6A5A", beard: "white" };
export const ZADOK: Look = { robe: ROBES.white, head: "cloth", mantle: "#E8E0CC", sash: "#2A3A6A", beard: true };
export const ITTAI: Look = { robe: ROBES.red, head: "plume", short: true, beard: true, hold: "spear" };
export const SHIMEI: Look = { robe: ROBES.sand, head: "cloth", beard: true, hold: "stone" };
export const CUSHITE: Look = { robe: ROBES.linen, head: "bare", skin: "#3A2418", short: true };
export const MEDIUM: Look = { robe: ROBES.black, head: "veil", mantle: "#3A3040" };
export const AMALEKITE = (i = 0): Look => ({ robe: [ROBES.sand, ROBES.brown, ROBES.umber][i % 3], head: "cloth", short: true, beard: true, hold: i % 2 ? "sword" : "spear" });
export const ISRAELITE = (i: number): Look => ({ robe: [ROBES.brown, ROBES.olive, ROBES.umber, ROBES.blue, ROBES.grey][i % 5], head: i % 2 ? "helmet" : "cloth", beard: i % 3 !== 2, short: true, hold: i % 2 ? "spear" : "sword" });
export const PHIL = (i: number): Look => ({ robe: [ROBES.red, ROBES.white, ROBES.indigo][i % 3], head: "plume", short: true, hold: i % 2 ? "spear" : "sword" });
export const PHIL_LORD = (i: number): Look => ({ robe: [ROBES.wine, ROBES.indigo, ROBES.red][i % 3], head: "plume", mantle: "#C89A40", sash: "#C89A40" });
/** Goliath: bronze scale armour, helmet, a weaver's-beam spear. Draw at s ≈ 1.7–1.8 beside men at 1.0. */
export const GOLIATH: Look = { robe: ROBES.indigo, head: "helmet", beard: true, short: true, armor: "#9A7A44", hold: "spear" };
export const SHIELD_BEARER: Look = { robe: ROBES.white, head: "plume", short: true, hold: "shield" };

// ── Places ──────────────────────────────────────────────────────────────────────────────

type CamT = ReturnType<typeof useCam>;
type SkyP = React.ComponentProps<typeof Sky>;
type SetP = { cam: CamT; seed: string; tod?: number; near?: React.ReactNode; mid?: React.ReactNode; far?: React.ReactNode; front?: React.ReactNode; fx?: React.ReactNode; sky?: SkyP; storm?: number };

/** Shiloh: the tabernacle among terraced hills and olive trees. `glow` lights the sanctuary. */
export const ShilohSet: React.FC<SetP & { glow?: number }> = ({ cam, seed, tod = 0.42, near, mid, far, front, fx, sky, storm = 0, glow = 0 }) => {
  const { p } = useLayout();
  const night = tod > 0.74 || tod < 0.22;
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 }}
      far={far}
      mid={
        <>
          <Tabernacle x={p(1180, 640)} s={p(0.8, 0.7)} w={420} glow={glow + (night ? 0.4 : 0)} />
          <Tree x={p(420, 120)} s={0.7} kind="olive" seed={`${seed}o1`} />
          <Tree x={p(560, 260)} s={0.6} kind="olive" seed={`${seed}o2`} />
          {mid}
        </>
      }
      near={
        <>
          {near}
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/** A hill town (Ramah, Bethlehem, Gibeah, Ziklag): flat-roofed houses along the middle ridge, optional field. */
export const TownSet: React.FC<SetP & { houses?: number; field?: boolean; lit?: number; dry?: boolean; preset?: LandPreset }> = ({
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
  houses = 5,
  field = false,
  lit,
  dry = false,
  preset = "hills",
}) => {
  const { p } = useLayout();
  const night = tod > 0.74 || tod < 0.22;
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 }}
      far={far}
      mid={
        <>
          {Array.from({ length: houses }, (_, i) => (
            <House key={i} x={p(1020, 520) + i * p(78, 66) - (i % 2) * p(20, 16)} s={0.95} w={60 + (i % 3) * 8} h={44} seed={`${seed}h${i}`} lit={lit ?? (night ? 0.7 : 0)} />
          ))}
          {field ? <Field x0={p(-100, -100)} x1={p(860, 460)} n={p(110, 70)} seed={`${seed}f`} ripe={0.75} /> : null}
          {mid}
        </>
      }
      near={
        <>
          {near}
          {dry ? dryGrass(`${seed}g`) : lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/** A battle valley (Elah, Mizpah, Michmash, Aphek): an army on the left ridge and another on the right, a brook on the
 *  valley floor. `hostL`/`hostR` 0..1 fade the armies in; `plumeR` gives the right-hand army Philistine plumes. */
export const ValleySet: React.FC<SetP & { hostL?: number; hostR?: number; tintL?: string; tintR?: string; plumeR?: boolean; stream?: boolean; march?: number }> = ({
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
  hostL = 1,
  hostR = 1,
  tintL = "#5A4636",
  tintR = "#7A3A30",
  plumeR = true,
  stream = true,
  march = 0,
}) => {
  const { p, W } = useLayout();
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.35 }}
      far={far}
      mid={
        <>
          {hostL > 0 ? <Host x0={p(-120, -120)} x1={p(640, 330)} n={p(26, 14)} seed={`${seed}L`} tint={tintL} p={hostL} march={march} /> : null}
          {hostR > 0 ? <Host x0={p(1280, 750)} x1={W + p(120, 120)} n={p(26, 14)} seed={`${seed}R`} tint={tintR} plume={plumeR} p={hostR} march={march} flip /> : null}
          {mid}
        </>
      }
      near={
        <>
          {stream ? <Stream x0={p(-200, -200)} x1={W + p(200, 200)} w={p(26, 30)} dy={p(30, 40)} seed={`${seed}s`} /> : null}
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/** A royal hall at Gibeah or Jerusalem: stone walls, pillars, a hanging lamp, a throne (`throne`) at `tx`.
 *  Children stand on the floor (near band). `night` dims it to lamplight. */
export const HallSet: React.FC<{ cam: CamT; seed: string; children?: React.ReactNode; fx?: React.ReactNode; throne?: boolean; tx?: number; night?: number; lamp?: number }> = ({
  cam,
  seed,
  children,
  fx,
  throne = true,
  tx,
  night = 0.4,
  lamp = 1,
}) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const flick = 0.88 + 0.12 * Math.sin(f * 0.33) * Math.sin(f * 0.11 + 1);
  const cols = p(6, 4);
  const ttx = tx ?? p(1420, 800);
  return (
    <Stage cam={cam} tod={0.5 + night * 0.4} rim="255,190,120" rimA={0.55}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #2A2018 0%, #3A2C20 55%, #1C140E 100%)" }} />
      <Band depth={0.3} k={K.mid}>
        <rect x={-200} y={p(120, 300)} width={W + 400} height={14} fill="#4A3A2A" />
        {Array.from({ length: cols }, (_, i) => {
          const x = (W / cols) * (i + 0.5);
          return (
            <g key={i}>
              <rect x={x - p(26, 30)} y={p(130, 310)} width={p(52, 60)} height={H} fill="#5A4A38" stroke="rgba(255,200,140,0.25)" strokeWidth={1.5} />
              <rect x={x - p(34, 38)} y={p(120, 300)} width={p(68, 76)} height={20} fill="#6A5842" />
            </g>
          );
        })}
        {Array.from({ length: cols - 1 }, (_, i) => {
          const x = (W / cols) * (i + 1);
          return <path key={`h${i}`} d={`M ${x - p(50, 44)} ${p(170, 360)} L ${x + p(50, 44)} ${p(170, 360)} L ${x + p(42, 36)} ${p(420, 740)} L ${x - p(42, 36)} ${p(420, 740)} Z`} fill={["#5A2234", "#2E3452", "#6A4A22"][i % 3]} opacity={0.75} />;
        })}
      </Band>
      <Band depth={0.8} ridge={geo.near} fill="#4A3A2A" fill2="#2A1E14" haze={0} edge={0.2} k={K.near}>
        {throne ? <Seat x={ttx} s={1.1} royal /> : null}
        {children}
      </Band>
      <Glow x={W * 0.5} y={p(220, 420)} size={p(1500, 1300)} color="255,170,90" opacity={0.35 * flick * lamp} />
      <Tint color="#08060A" opacity={0.25 * night} />
      {fx}
    </Stage>
  );
};

/** A small room at night: plastered stone walls, a lamp in a niche (Endor, a bedchamber, David fasting). */
export const ChamberSet: React.FC<{ cam: CamT; seed: string; children?: React.ReactNode; fx?: React.ReactNode; lamp?: number; cold?: number }> = ({ cam, seed, children, fx, lamp = 1, cold = 0 }) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const flick = 0.85 + 0.15 * Math.sin(f * 0.37) * Math.sin(f * 0.13 + 1);
  const lx = p(1500, 880);
  const ly = p(470, 980);
  return (
    <Stage cam={cam} tod={0.9} rim="255,170,100" rimA={0.5}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #1A120C 0%, #2A1E16 60%, #160F0A 100%)" }} />
      <Svg>
        {Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 12 }, (_, c) => (
            <rect key={`${r}-${c}`} x={-60 + c * (W / 10) + (r % 2) * (W / 20)} y={r * (H / 10)} width={W / 10 - 6} height={H / 10 - 6} fill="none" stroke="rgba(60,44,32,0.35)" strokeWidth={2} />
          )),
        )}
        <path d={`M ${lx - 50} ${ly + 30} L ${lx - 50} ${ly - 40} Q ${lx} ${ly - 90} ${lx + 50} ${ly - 40} L ${lx + 50} ${ly + 30} Z`} fill="#120C08" />
        <path d={`M ${lx - 16} ${ly + 22} Q ${lx - 14} ${ly + 12} ${lx} ${ly + 12} Q ${lx + 16} ${ly + 12} ${lx + 20} ${ly + 18} L ${lx + 26} ${ly + 14} L ${lx + 24} ${ly + 22} Z`} fill="#6A4A30" opacity={lamp > 0 ? 1 : 0.5} />
        {lamp > 0 ? (
          <>
            <ellipse cx={lx + 22} cy={ly + 6} rx={4} ry={9 * flick} fill="#FFB050" opacity={0.95 * lamp} />
            <ellipse cx={lx + 22} cy={ly + 8} rx={2} ry={5} fill="#FFF0C0" opacity={lamp} />
          </>
        ) : null}
      </Svg>
      <Band depth={0.8} ridge={geo.near} fill="#3A2A1E" haze={0} edge={0.15} k={K.near}>
        {children}
      </Band>
      <Glow x={lx + 20} y={ly} size={p(1200, 1100)} color="255,150,70" opacity={0.45 * flick * lamp} />
      <Tint color="#0A1020" opacity={0.35 * cold} />
      {fx}
    </Stage>
  );
};

/** Inside a cave looking out (Adullam, En-gedi): a bright mouth framed by dark rock; children stand on the cave floor
 *  (near band). Figures deep inside read as silhouettes against the mouth. `tod` sets the sky seen through the mouth. */
export const CaveSet: React.FC<{ cam: CamT; seed: string; tod?: number; children?: React.ReactNode; outside?: React.ReactNode; fx?: React.ReactNode; mx?: number; fire?: number }> = ({
  cam,
  seed,
  tod = 0.45,
  children,
  outside,
  fx,
  mx,
  fire = 0,
}) => {
  const { p, W, H } = useLayout();
  const f = useCurrentFrame();
  const geo = useLandGeo("plain", seed);
  const K = useBandK();
  const cx = mx ?? p(1250, 640);
  const top = p(170, 520);
  const mw = p(620, 560);
  const pal = skyAt(tod);
  const flick = 0.85 + 0.15 * Math.sin(f * 0.4) * Math.sin(f * 0.15 + 2);
  const n = 18;
  const arch: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = Math.PI * t;
    const xx = cx - (mw / 2) * Math.cos(a) + range(`${seed}ax${i}`, -16, 16);
    const yy = H * 0.62 + 60 - (H * 0.62 + 60 - top) * Math.sin(a) + range(`${seed}ay${i}`, -14, 14);
    arch.push(`${i === 0 ? "M" : "L"} ${xx.toFixed(1)} ${yy.toFixed(1)}`);
  }
  const hole = `${arch.join(" ")} Z`;
  return (
    <Stage cam={cam} tod={0.85} rim="255,200,150" rimA={0.6}>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${pal.top} 0%, ${pal.mid} 45%, ${pal.hz} 70%, #6A5A48 100%)` }} />
      <Band depth={0.2} ridge={{ base: H * 0.62 + 20, amp: 30, seed: `${seed}o` }} fill="#7A6A58" haze={0.4} edge={0.3}>
        {outside}
      </Band>
      <Svg>
        <path d={`M -400 -400 L ${W + 400} -400 L ${W + 400} ${H + 400} L -400 ${H + 400} Z ${hole}`} fill="#1A1410" fillRule="evenodd" />
        <path d={hole} fill="none" stroke="rgba(255,210,160,0.45)" strokeWidth={3} />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M ${range(`${seed}rx${i}`, 0, W)} ${range(`${seed}ry${i}`, 0, H * 0.5)} q ${range(`${seed}rq${i}`, 30, 90)} ${range(`${seed}rr${i}`, 10, 40)} ${range(`${seed}rs${i}`, 60, 160)} 0`} stroke="rgba(60,48,38,0.6)" strokeWidth={3} fill="none" />
        ))}
      </Svg>
      <Band depth={0.8} ridge={geo.near} fill="#2A2018" fill2="#120E0A" haze={0} edge={0.25} k={K.near}>
        {children}
      </Band>
      <Glow x={cx} y={H * 0.5} size={p(1300, 1200)} color="255,236,200" opacity={0.25} />
      {fire > 0 ? <Glow x={p(500, 300)} y={p(820, 1500)} size={p(900, 800)} color="255,150,70" opacity={0.5 * fire * flick} /> : null}
      {fx}
    </Stage>
  );
};

/** The rocky wilderness of Judah (Ziph, Maon, the Rocks of the Wild Goats): crags, scrub, an optional cave mouth. */
export const WildSet: React.FC<SetP & { cave?: boolean; caveX?: number }> = ({ cam, seed, tod = 0.45, near, mid, far, front, fx, sky, storm = 0, cave = false, caveX }) => {
  const { p } = useLayout();
  return (
    <Land
      preset="wilderness"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1700, 940), y: p(380, 820) }, clouds: 0.2 }}
      far={far}
      mid={
        <>
          <Rock x={p(260, 80)} s={2.4} w={120} h={80} seed={`${seed}r1`} color="#7A6A5A" />
          <Rock x={p(1500, 900)} s={2.8} w={140} h={90} seed={`${seed}r2`} color="#6E5E50" />
          {cave ? <CaveMouth x={caveX ?? p(1100, 620)} s={0.8} seed={`${seed}cv`} /> : null}
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
      fx={fx}
    />
  );
};

/** Jerusalem: the walled City of David on its hill; `palace` adds David's cedar palace on the near ground at `px`. */
export const ZionSet: React.FC<SetP & { palace?: boolean; px?: number; lit?: number; roof?: React.ReactNode }> = ({ cam, seed, tod = 0.42, near, mid, far, front, fx, sky, storm = 0, palace = false, px, lit, roof }) => {
  const { p } = useLayout();
  const night = tod > 0.74 || tod < 0.22;
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 }}
      far={far}
      mid={
        <>
          <City x={p(980, 540)} w={p(900, 620)} s={0.9} seed={`${seed}c`} wall color="#8A7A62" lit={lit ?? (night ? 0.6 : 0)} />
          {mid}
        </>
      }
      near={
        <>
          {palace ? <RoofHouse x={px ?? p(1350, 760)} s={p(1, 0.85)} lit={lit ?? (night ? 0.7 : 0)} roof={roof} /> : null}
          {near}
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/** The forest of Ephraim: oaks crowding the middle and near ground, mist between the trunks. */
export const ForestSet: React.FC<SetP & { mist?: number }> = ({ cam, seed, tod = 0.4, near, mid, far, front, fx, sky, storm = 0, mist = 0.4 }) => {
  const { p, W } = useLayout();
  const n = p(9, 6);
  return (
    <Land
      preset="hills"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1600, 900), y: p(300, 700) }, clouds: 0.5 }}
      far={far}
      mid={
        <>
          {Array.from({ length: n }, (_, i) => (
            <Tree key={i} x={(W / n) * (i + 0.3) + range(`${seed}mx${i}`, -40, 40)} s={range(`${seed}ms${i}`, 0.9, 1.2)} kind="oak" seed={`${seed}m${i}`} />
          ))}
          {mid}
        </>
      }
      near={
        <>
          {near}
          {lushGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={
        <>
          <Mist y={p(640, 1180)} h={p(220, 300)} opacity={mist} seed={`${seed}mi`} />
          {fx}
        </>
      }
    />
  );
};

/** A city gate seen from outside, its walls running off both sides (Mahanaim, Gibeah). The gate's towers top out at
 *  214 units above its base: a watchman on a tower stands at y = ridgeY(geo.near, gx ± w/2) - 214 * s * K.near. */
export const GateSet: React.FC<SetP & { gx?: number; gs?: number; open?: number; lit?: number }> = ({ cam, seed, tod = 0.45, near, mid, far, front, fx, sky, storm = 0, gx, gs, open = 0, lit }) => {
  const { p, W } = useLayout();
  const night = tod > 0.74 || tod < 0.22;
  const x = gx ?? p(960, 540);
  return (
    <Land
      preset="plain"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 }}
      far={far}
      mid={
        <>
          <City x={p(980, 540)} w={p(900, 620)} s={0.8} seed={`${seed}c`} color="#7A6A58" lit={lit ?? (night ? 0.5 : 0)} />
          {mid}
        </>
      }
      near={
        <>
          <StoneWall x0={p(-200, -200)} x1={x - p(200, 170)} h={120} seed={`${seed}w1`} />
          <StoneWall x0={x + p(200, 170)} x1={W + p(200, 200)} h={120} seed={`${seed}w2`} />
          <Gate x={x} s={gs ?? p(1.1, 1)} w={300} open={open} />
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      front={front}
      fx={fx}
    />
  );
};

/** Ground height helper for sets built on a Land preset: `groundY(preset, seed, x)` inside a scene component. */
export const useGround = (preset: LandPreset, seed: string) => {
  const geo = useLandGeo(preset, seed);
  return (x: number) => ridgeY(geo.near, x);
};
