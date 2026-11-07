import React from "react";
import { lerp } from "./anim";
import { Tint } from "./Atmos";
import { useLayout } from "./layout";
import { Look, ROBES } from "./Person";
import { Grass, Palm, Reeds } from "./Plants";
import { Palace, Pyramid, Tent } from "./Props";
import { Bricks, Camp, Mountain, Walls } from "./Props2";
import { Band, Land, LandPreset, Sky, Stage, Water, useBandK, useCam, useLandGeo } from "./Stage";

/** Recurring people and places for Exodus through Ruth, so every film draws them the same way. */

export const SKIN_EG = "#7A5236";
export const MOSES: Look = { robe: ROBES.umber, head: "cloth", mantle: "#8A7A5A", beard: true };
export const MOSES_OLD: Look = { ...MOSES, beard: "white", mantle: "#A89A80" };
export const AARON: Look = { robe: ROBES.blue, head: "cloth", mantle: "#8A8AA0", beard: true };
export const AARON_PRIEST: Look = { robe: ROBES.white, head: "cloth", mantle: "#2A3A6A", sash: "#8A2A22", beard: "white" };
export const MIRIAM: Look = { robe: ROBES.teal, head: "veil", mantle: "#7A8A80" };
export const JOSHUA: Look = { robe: ROBES.red, head: "cloth", mantle: "#8A6A50", beard: true };
export const CALEB: Look = { robe: ROBES.olive, head: "cloth", mantle: "#8A8060", beard: true };
export const PHARAOH: Look = { robe: ROBES.linen, head: "nemes", short: true, skin: SKIN_EG, mantle: "#C89A40", sash: "#2A4A7A" };
export const EGYPT = (i = 0): Look => ({ robe: ROBES.linen, head: "wig", short: true, skin: SKIN_EG, sash: ["#2A4A7A", "#8A2A22", "#C89A40"][i % 3] });
export const MASTER = (i = 0): Look => ({ ...EGYPT(i), staff: "raised" });
export const SOLDIER_EG = (i = 0): Look => ({ ...EGYPT(i), hold: "spear" });
export const SLAVE = (i: number): Look => ({ robe: [ROBES.sand, ROBES.brown, ROBES.olive, ROBES.umber, ROBES.grey][i % 5], head: i % 3 === 0 ? "hair" : "cloth", short: true, beard: i % 2 === 0 });
export const MAN = (i: number): Look => ({ robe: [ROBES.brown, ROBES.olive, ROBES.blue, ROBES.sand, ROBES.grey, ROBES.umber, ROBES.wine, ROBES.teal][i % 8], head: i % 4 === 3 ? "hair" : "cloth", beard: i % 3 !== 2 });
export const WOMAN = (i: number): Look => ({ robe: [ROBES.wine, ROBES.teal, ROBES.sand, ROBES.olive][i % 4], head: "veil", mantle: ["#8A7A68", "#7A8A80", "#9A8A70", "#7A6A5A"][i % 4] });
export const CHILD = (i: number): Look => ({ robe: [ROBES.sand, ROBES.olive, ROBES.blue, ROBES.brown, ROBES.wine][i % 5], head: "hair", child: 0.8 });
export const ELDER = (i: number): Look => ({ robe: [ROBES.brown, ROBES.grey, ROBES.indigo, ROBES.olive, ROBES.umber][i % 5], head: "cloth", beard: i % 2 ? "white" : true, staff: i % 3 === 0 ? "staff" : null });
export const PRIEST = (i = 0): Look => ({ robe: ROBES.white, head: "cloth", mantle: "#E8E0CC", sash: ["#2A3A6A", "#8A2A22", "#6A2A44"][i % 3], beard: true });
export const WARRIOR = (i = 0): Look => ({ robe: [ROBES.brown, ROBES.olive, ROBES.umber, ROBES.red][i % 4], head: "helmet", beard: true, short: true, hold: i % 2 ? "sword" : "spear" });
export const ANGEL: Look = { robe: "#F2ECDD", head: "hair", glow: 0.9, mantle: "#FFF6DE" };

export const sandGrass = (seed: string) => <Grass x0={-300} x1={2300} n={60} seed={seed} h={[8, 22]} color={["#6A5A34", "#A8925A"]} />;
export const lushGrass = (seed: string) => <Grass x0={-300} x1={2300} n={110} seed={seed} dy={[2, 40]} />;
export const dryGrass = (seed: string) => <Grass x0={-300} x1={2300} n={50} seed={seed} h={[8, 22]} color={["#5A4A30", "#9A8A5A"]} />;
export const GOSHEN = { mid: "#6A7A3A", near: "#4E6A2A", front: "#2A3A18" };

type CamT = ReturnType<typeof useCam>;
type SkyP = React.ComponentProps<typeof Sky>;

/** A wide river between the far bank and the near bank (the Nile, the Jordan). `blood` 0..1 turns it red. */
export const RiverSet: React.FC<{ cam: CamT; seed: string; tod?: number; sky?: SkyP; far?: React.ReactNode; onWater?: React.ReactNode; near?: React.ReactNode; fx?: React.ReactNode; blood?: number; palms?: boolean; bank?: string; farFill?: string }> = ({
  cam,
  seed,
  tod = 0.4,
  sky,
  far,
  onWater,
  near,
  fx,
  blood = 0,
  palms = true,
  bank = "#7E6038",
  farFill = "#A88A62",
}) => {
  const { p, hz } = useLayout();
  const g = useLandGeo("egypt", seed);
  const K = useBandK();
  const nearRidge = { ...g.near, base: g.near.base + p(30, 40) };
  const hex = (a: number, b: number) => Math.round(lerp(a, b, blood)).toString(16).padStart(2, "0");
  return (
    <Stage cam={cam} tod={tod}>
      <Sky tod={tod} clouds={0.3} sun={{ x: p(1720, 940), y: p(330, 780) }} {...sky} />
      <Band depth={0.12} ridge={g.far} fill={farFill} haze={0.5} edge={0.35} k={K.far}>
        {palms ? (
          <>
            <Palm x={p(300, 120)} s={0.5} />
            <Palm x={p(380, 200)} s={0.42} lean={-0.3} />
            <Palm x={p(1500, 860)} s={0.5} />
          </>
        ) : null}
        {far}
      </Band>
      <Water depth={0.45} y={hz + p(26, 40)} color={`#${hex(0x2a, 0x7a)}${hex(0x5a, 0x16)}${hex(0x6a, 0x12)}`} deep={blood > 0.5 ? "#2A0606" : "#08161E"} rough={0.15} k={K.mid} front={onWater} />
      <Band depth={0.8} ridge={nearRidge} fill={bank} haze={0.06} edge={0.55} k={K.near}>
        <Reeds x0={-300} x1={2300} n={44} seed={`${seed}r3`} h={74} />
        {near}
      </Band>
      <Band depth={1} ridge={g.front} fill="#45331E" haze={0} edge={0.3} k={K.front} />
      {fx}
    </Stage>
  );
};

/** Pharaoh's court: a lotus-columned palace behind the near ground. */
export const PalaceSet: React.FC<{ cam: CamT; seed: string; tod?: number; near: React.ReactNode; fx?: React.ReactNode; dim?: number; sky?: SkyP; storm?: number }> = ({ cam, seed, tod = 0.42, near, fx, dim = 0, sky, storm = 0 }) => {
  const { p } = useLayout();
  return (
    <Land
      preset="egypt"
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1720, 940), y: p(300, 760) }, clouds: 0.2 }}
      mid={<Palace x={p(980, 540)} w={p(1300, 900)} h={300} s={0.85} cols={p(10, 6)} lit={0.5} />}
      near={
        <>
          {near}
          {sandGrass(`${seed}g`)}
        </>
      }
      fx={
        <>
          {fx}
          <Tint color="#06040A" opacity={dim} />
        </>
      }
    />
  );
};

/** Brick-making grounds under the store cities: drying bricks, a half-built wall, pyramids beyond. */
export const BrickField: React.FC<{ cam: CamT; seed: string; tod?: number; built?: number; near: React.ReactNode; fx?: React.ReactNode; sky?: SkyP }> = ({ cam, seed, tod = 0.38, built = 0.5, near, fx, sky }) => {
  const { p } = useLayout();
  return (
    <Land
      preset="egypt"
      seed={seed}
      tod={tod}
      cam={cam}
      sky={sky ?? { sun: { x: p(1720, 940), y: p(320, 760) }, clouds: 0.15 }}
      far={
        <>
          <Pyramid x={p(260, 120)} h={150} />
          <Pyramid x={p(520, 330)} h={110} />
        </>
      }
      mid={
        <>
          <Walls x={p(1250, 700)} w={p(1100, 700)} h={lerp(60, 170, built)} seed={`${seed}w`} rahab={false} />
          <Bricks x={p(300, 120)} rows={4} cols={7} />
          <Bricks x={p(560, 330)} rows={3} cols={5} />
        </>
      }
      near={
        <>
          {[0, 1, 2, 3].map((i) => (
            <Bricks key={i} x={p(-60, -120) + i * p(560, 400)} rows={1} cols={12} s={0.8} />
          ))}
          {near}
          {sandGrass(`${seed}g`)}
        </>
      }
      fx={fx}
    />
  );
};

/** A great mountain beyond the wilderness (Sinai/Horeb, Nebo, Hor, Tabor). */
export const MountainSet: React.FC<{
  cam: CamT;
  seed: string;
  tod?: number;
  near?: React.ReactNode;
  mid?: React.ReactNode;
  far?: React.ReactNode;
  fx?: React.ReactNode;
  sky?: SkyP;
  storm?: number;
  mx?: number;
  mw?: number;
  mh?: number;
  mseed?: string;
  mcolor?: string;
  preset?: LandPreset;
  grass?: "dry" | "lush" | "sand" | "none";
  dome?: boolean;
}> = ({ cam, seed, tod = 0.4, near, mid, far, fx, sky, storm = 0, mx, mw, mh, mseed = "sinai", mcolor = "#7A6458", preset = "wilderness", grass = "dry", dome = false }) => {
  const { p } = useLayout();
  return (
    <Land
      preset={preset}
      seed={seed}
      tod={tod}
      cam={cam}
      storm={storm}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 }}
      far={
        <>
          <Mountain x={mx ?? p(1000, 560)} w={mw ?? p(1300, 1000)} h={mh ?? p(400, 540)} seed={mseed} color={mcolor} dome={dome} />
          {far}
        </>
      }
      mid={mid}
      near={
        <>
          {near}
          {grass === "dry" ? dryGrass(`${seed}g`) : grass === "lush" ? lushGrass(`${seed}g`) : grass === "sand" ? sandGrass(`${seed}g`) : null}
        </>
      }
      fx={fx}
    />
  );
};

/** The camp of Israel in the wilderness: rows of tents in the middle distance. */
export const CampSet: React.FC<{ cam: CamT; seed: string; tod?: number; near?: React.ReactNode; mid?: React.ReactNode; far?: React.ReactNode; fx?: React.ReactNode; sky?: SkyP; light?: number; preset?: LandPreset; tents?: number; storm?: number }> = ({
  cam,
  seed,
  tod = 0.4,
  near,
  mid,
  far,
  fx,
  sky,
  light = 0.4,
  preset = "wilderness",
  tents,
  storm = 0,
}) => {
  const { p } = useLayout();
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
          <Camp x0={p(-100, -120)} x1={p(2000, 1200)} n={tents ?? p(14, 9)} seed={`${seed}c`} light={light} s={0.75} />
          {mid}
        </>
      }
      near={
        <>
          {near}
          {dryGrass(`${seed}g`)}
        </>
      }
      fx={fx}
    />
  );
};

/** A village of tents and huts at night or day, used for Goshen and Israel's homes. */
export const VillageSet: React.FC<{ cam: CamT; seed: string; tod?: number; near?: React.ReactNode; mid?: React.ReactNode; fx?: React.ReactNode; sky?: SkyP; light?: number }> = ({ cam, seed, tod = 0.4, near, mid, fx, sky, light = 0.5 }) => {
  const { p } = useLayout();
  return (
    <Land
      preset="egypt"
      seed={seed}
      tod={tod}
      cam={cam}
      colors={GOSHEN}
      sky={sky ?? { sun: { x: p(1740, 960), y: p(360, 800) }, clouds: 0.3 }}
      mid={
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <Tent key={i} x={p(150, 40) + i * p(300, 220)} w={p(170, 130)} light={light} />
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
      fx={fx}
    />
  );
};
