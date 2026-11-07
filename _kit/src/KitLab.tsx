import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { Shot, ShotDef } from "./cel/Shot";
import { CAST, crowdField, villagers } from "./cel/cast";
import { Human, blinkAt } from "./cel/human";
import { V3 } from "./cel/geo";
import { stepped } from "./cel/cam";
import { basin, basket, bird, loaf, fish, oilLamp, pitcher, stoneJar, table } from "./cel/props";
import { colonnade, gardenTomb, golgotha, paving, room } from "./cel/sets";
import { flame, glow, miracleSparkles } from "./cel/fx";
import { galilee, shore, shot } from "./scenes/common";

const K0 = shot("night", (k) => {
  const set = galilee(k, { seed: 4, flat: [0, 0, 6], grass: 1500 });
  const j = k.add(new Human(CAST.JESUS_KNEEL));
  j.place(0, 0, 20, set.h(0, 0));
  return (f) => {
    j.pose({ root: { p: [0, -0.43, 0] }, hipL: [0, 0, 4], hipR: [0, 0, 4], knL: [90, 0, 0], knR: [90, 0, 0], anL: [40, 0, 0], anR: [40, 0, 0], chest: [6, 0, 0], head: [16, 0, 0], shL: [42, 0, -14], shR: [42, 0, -14], elL: [96, 0, 0], elR: [96, 0, 0], handL: "flat", handR: "flat" });
    j.expr({ blink: 1, closedStyle: "calm", sad: 0.3 });
    k.cam({ target: j.point("head").add(V3(0, -0.4, 0)), size: "FS", yaw: -35, pitch: 6, lens: 40, facing: 20, sx: k.p(0.25, 0), sy: k.p(0, 0.1) });
    k.key(60, 35);
  };
});

const K1 = shot("golden", (k) => {
  const set = shore(k, {});
  const j = k.add(new Human(CAST.JESUS));
  j.place(0, 2, -20, set.h(0, 2));
  const d = bird();
  k.add(d.group);
  const sp = miracleSparkles(V3(0, 1.4, 2), { n: 50 });
  k.add(sp.obj);
  return (f) => {
    j.pose({ shR: [70, 0, 20], elR: [30, 0, 0], handR: "open" });
    j.expr({ smile: 0.4, blink: blinkAt(stepped(f), 1) });
    d.group.position.set(-0.6, 2.4, 2.2);
    d.flap(stepped(f) / 12);
    sp.update(stepped(f) / 30);
    k.cam({ target: j.point("chest"), size: "MS", yaw: 30, pitch: 4, lens: 45, facing: -20, sx: k.p(-0.25, 0) });
    k.key(45, 25);
  };
});

const K2 = shot("day", (k) => {
  k.add(paving({ w: 30, d: 30 }));
  k.add(colonnade({ x0: -10, x1: 10, z: -6, n: 7 }));
  for (let i = 0; i < 6; i++) {
    const jar = stoneJar({});
    jar.group.position.set(-2.5 + i * 0.75, 0, -2);
    k.add(jar.group);
    if (i > 2) jar.liquidM.uniforms.uColor.value.set("#8a1f3a");
  }
  const t = table({ cloth: "#e8dcc0" });
  t.position.set(2.5, 0, 1);
  k.add(t);
  const vs = villagers(5, 3);
  vs.forEach((v, i) => { k.add(v); v.place(-3 + i * 1.6, 2 + (i % 2), 180 + (i - 2) * 15, 0); });
  const lamp = oilLamp(); lamp.position.set(2.5, 0.75, 1); k.add(lamp);
  const fl = flame(V3(2.55, 0.81, 1.05)); k.add(fl.group); k.add(fl.glow.obj); k.faces.push(fl);
  return (f) => {
    vs.forEach((v, i) => v.expr({ blink: blinkAt(stepped(f), i), smile: 0.3 }));
    k.cam({ target: V3(0, 1.0, 0), size: 7, yaw: 10, pitch: 10, lens: 30 });
  };
});

const K3 = shot("golden", (k) => {
  const set = galilee(k, { seed: 8, sea: true, seaZ: -60, grass: 0, trees: [[30, -10, 1.3]] });
  const c = crowdField({ n: 900, place: (i, R) => { const x = (R() - 0.5) * 70, z = -5 - R() * 40; return [x, set.h(x, z), z, Math.PI + (R() - 0.5) * 0.6]; } });
  k.add(c.group);
  return () => k.cam({ target: V3(0, 2 + set.h(0, -20), -20), size: 60, yaw: 180, pitch: 18, lens: 32 });
});

const K4 = shot("lamplight", (k) => {
  k.add(room({ w: 8, d: 6, h: 3.2, wall: "#c9ad86", floor: "#8a6a4e", beams: true, window: [0, 2.0, 1.0, 0.7] }));
  const t = table({ w: 2.6, d: 1.0, h: 0.42, cloth: "#d8c8a8" }); t.position.set(0, 0, -1); k.add(t);
  const b = basin(); b.position.set(0.6, 0, 1.0); k.add(b);
  const p = pitcher(); p.position.set(1.1, 0, 1.2); k.add(p);
  for (let i = 0; i < 4; i++) { const l = loaf(); l.position.set(-0.8 + i * 0.4, 0.43, -1); k.add(l); }
  const fsh = fish(); fsh.position.set(0.9, 0.46, -1.1); k.add(fsh);
  const bk = basket({ full: true }); bk.position.set(-1.6, 0, 0.6); k.add(bk);
  const lamp = oilLamp(); lamp.position.set(0.2, 0.42, -1.1); k.add(lamp);
  const fl = flame(V3(0.26, 0.48, -1.05), 1.2); k.add(fl.group); k.add(fl.glow.obj); k.faces.push(fl);
  const g = glow(V3(0.26, 0.6, -1.05), 3, { color: "#ffb060", opacity: 0.25 }); k.add(g.obj); k.faces.push(g);
  const j = k.add(new Human(CAST.JESUS_SERVE));
  j.place(-0.5, 0.9, 30, 0);
  return (f) => {
    j.expr({ blink: blinkAt(stepped(f), 2), smile: 0.2 });
    k.cam({ target: V3(0, 0.9, 0), size: 4.2, yaw: 0, pitch: 12, lens: 32 });
    k.key(50, 30, { lightCol: "#ffcf96" });
  };
});

const K5 = shot("dawn", (k) => {
  const set = galilee(k, { seed: 11, flat: [0, 0, 10], grass: 1200, trees: [[-6, -2, 1.0], [7, -3, 1.2]] });
  const t = gardenTomb({ open: 1 });
  t.position.set(0, set.h(0, -4), -4);
  k.add(t);
  const gol = golgotha({ x: 120, z: -260 });
  gol.position.y = -2;
  k.add(gol);
  const g = glow(V3(0, set.h(0, -4) + 1.2, -2.8), 3, { color: "#fff0c8", opacity: 0.6 }); k.add(g.obj); k.faces.push(g);
  return () => {
    k.cam({ target: V3(0, 1.5 + set.h(0, -4), -3), size: 9, yaw: 15, pitch: 6, lens: 28 });
  };
});

const DEFS: ShotDef[] = [K0, K1, K2, K3, K4, K5];
void THREE;
export const KitLab: React.FC<{ v: number }> = ({ v }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shot def={DEFS[v]} />
  </AbsoluteFill>
);
