import React from "react";
import { AbsoluteFill } from "remotion";
import { Shot } from "./cel/Shot";
import { CAST } from "./cel/cast";
import { Human, blinkAt } from "./cel/human";
import { V3 } from "./cel/geo";
import { seg, stepped } from "./cel/cam";
import { table } from "./cel/props";
import { room } from "./cel/sets";
import { shot } from "./scenes/common";
import { JOURNEYS, MapFontsGate, MapInsert, MapSpec, Route, mapCam, mapProp, routePoint } from "./mg";

const PAUL1 = { via: JOURNEYS.paul1, smooth: true };
const PAUL1_PINS = ["antioch", "seleucia", "salamis", "paphos", "perga", "pisidian_antioch", "iconium", "lystra", "derbe"];

/** Map lab 0: Paul's first journey, gold line art (full-frame insert). */
const Journey: React.FC = () => (
  <MapInsert
    spec={(f, c) => {
      const go = seg(f, 40, 150);
      const pins = PAUL1_PINS.map((at, i) => ({ at, a: seg(f, 40 + i * 12, 52 + i * 12), dy: at === "seleucia" ? 30 : undefined }));
      return {
        view: mapCam([[0, { lon: c.p(31.5, 32.8), lat: 35.6, span: c.p(9, 7) }], [150, { lon: c.p(32.6, 33.5), lat: 36.4, span: c.p(6.2, 5.6) }]], f),
        draw: seg(f, 0, 45),
        routes: [{ ...PAUL1, p: go, arrow: true }],
        head: { at: routePoint(PAUL1, go), a: seg(f, 40, 50) * (1 - seg(f, 150, 165)) },
        pins: [...pins, { at: "cyprus", a: seg(f, 20, 40), kind: "region" }, { at: "galatia", a: seg(f, 90, 110) }, { at: "great_sea", a: seg(f, 10, 30), dy: 40 }],
        light: { at: "antioch", r: seg(f, 8, 60) * 0.32 },
        frame: f,
      };
    }}
  />
);

/** Map lab 1: Galilee to Jerusalem, detailed coast, the Jordan and the two seas (full-frame insert). */
const HolyLand: React.FC = () => (
  <MapInsert
    spec={(f, c) => {
      const via: Route = { via: ["nazareth", [35.52, 32.45], [35.5, 32.1], "jericho", "jerusalem"], smooth: true, p: 0 };
      return {
        view: mapCam([[0, { lon: 35.35, lat: 32.25, span: c.p(2.6, 2.0) }], [170, { lon: 35.32, lat: 32.05, span: c.p(2.0, 1.6) }]], f),
        draw: seg(f, 0, 40),
        rivers: seg(f, 15, 60),
        routes: [{ ...via, p: seg(f, 60, 150), arrow: true }],
        pins: [
          { at: "galilee", a: seg(f, 30, 50) }, { at: "samaria_r", a: seg(f, 34, 54) }, { at: "judea", a: seg(f, 38, 58) },
          { at: "galilee_sea", a: seg(f, 40, 60), dx: c.p(120, 0), dy: c.p(10, -40) }, { at: "dead_sea", a: seg(f, 44, 64), dx: c.p(90, 0), dy: c.p(0, 60) },
          { at: "jordan_r", a: seg(f, 50, 70), dx: 50 },
          { at: "nazareth", a: seg(f, 55, 65) }, { at: "jericho", a: seg(f, 120, 130), dx: c.p(-70, -60) }, { at: "jerusalem", a: seg(f, 140, 150), big: true, dy: 38 },
          { at: "great_sea", label: "The Great Sea", kind: "sea", a: seg(f, 20, 40), dx: c.p(-200, -120) },
        ],
        light: { at: "jerusalem", r: seg(f, 140, 175) * 0.25 },
        frame: f,
      };
    }}
  />
);

/** Map lab 2: the same map in the world, ink on a parchment scroll on a table; Peter points at Jerusalem. */
const TableMap = shot("lamplight", (k) => {
  k.add(room({ w: 7, d: 6, h: 3.2, wall: "#c9ad86", floor: "#8a6a4e", beams: true, window: [0, 2.0, 1.0, 0.7] }));
  const t = table({ w: 1.7, d: 1.1, h: 0.74, color: "#6e4a2e" });
  k.add(t);
  const m = mapProp({ w: 1.15, h: 0.78, kind: "scroll" });
  m.group.position.set(0, 0.745, -0.12);
  k.add(m.group);
  const j = k.add(new Human(CAST.PETER));
  j.place(-0.2, -0.72, 0, 0);
  return (f) => {
    const fs = stepped(f);
    const spec: MapSpec = {
      view: { lon: 35.3, lat: 32.0, span: 2.1 },
      draw: 1,
      rivers: 1,
      routes: [{ via: ["nazareth", [35.52, 32.45], [35.5, 32.1], "jericho", "jerusalem"], smooth: true, p: seg(fs, 10, 90) }],
      pins: [{ at: "nazareth", a: 1 }, { at: "jericho", a: 1, dx: 40, dy: 40 }, { at: "jerusalem", a: 1, big: true, dx: -50 }, { at: "galilee_sea", a: 1, dx: 120 }],
    };
    m.draw(spec);
    const target = m.pointOn(spec, "jerusalem");
    j.pose({ spine: [10, 0, 0], chest: [22, 0, 0], neck: [10, 0, 0], head: [18, 0, 0], handR: "point", handL: "flat", shL: [30, 0, 8], elL: [50, 0, 0] });
    j.reach("R", target.clone().add(V3(0, 0.03, 0)), V3(0.4, -1, 0.1), seg(fs, 0, 16));
    j.lookAt(target, 0.5);
    j.expr({ blink: blinkAt(fs, 2), brow: 0.2 });
    k.cam({ target: V3(-0.05, 1.1, -0.15), size: k.p(2.2, 1.9), yaw: 16, pitch: 26, lens: 40 });
    k.key(35, 40, { lightCol: "#ffd6a0" });
  };
});

const Table: React.FC = () => (
  <MapFontsGate>
    <Shot def={TableMap} />
  </MapFontsGate>
);

const VIEWS = [Journey, HolyLand, Table];
export const MapLab: React.FC<{ v: number }> = ({ v }) => {
  const V = VIEWS[v];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <V />
    </AbsoluteFill>
  );
};
