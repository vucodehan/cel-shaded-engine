/**
 * Hand lab: the reference for hands and objects (grip, placeHand, holdBoth). HandLab0 hammer, 1 drinking from a cup,
 * 2 both hands on a basket, 3 a hand on a shoulder with a stone held in the other hand. Render from _kit:
 * node scripts/celstills.mjs "HandLab0:20" "HandLab1:60" ...
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { Shot } from "./cel/Shot";
import { CAST, crowdLook } from "./cel/cast";
import { Human, blinkAt } from "./cel/human";
import { V3 } from "./cel/geo";
import { ease, seg, stepped } from "./cel/cam";
import { basket, cup, hammer, stone, workbench } from "./cel/props";
import { room } from "./cel/sets";
import { shot } from "./scenes/common";

const interior = (k: Parameters<Parameters<typeof shot>[1]>[0]) => k.add(room({ w: 8, d: 7, h: 3.2, wall: "#c9ad86", floor: "#8a6a4e", beams: true, window: [0, 2.0, 1.0, 0.7] }));

/** Hammer: wrap grip near the handle end, raised with the wrist cocked, then the strike from elbow and wrist. */
const H0 = shot("lamplight", (k) => {
  interior(k);
  const wb = workbench({});
  wb.position.set(0, 0, 0.45);
  k.add(wb);
  const j = k.add(new Human(CAST.JESUS_WORK));
  j.place(0, -0.15, 0, 0);
  const h = hammer();
  // grip 3.5 cm from the handle end; roll so the striking face points along the fingers (the swing direction)
  j.grip("R", h, { kind: "wrap", r: 0.0145, at: V3(0, 0.035, 0), roll: -Math.PI / 2 });
  const GRIP_TO_HEAD = 0.3 - 0.035;
  return (f) => {
    const fs = stepped(f);
    const { left, up, fwd } = j.axes();
    // 0 raised (head up by the shoulder, elbow bent), 1 struck (handle level, head flat on the nail)
    const s = ease.in(seg(fs % 40, 10, 20)) * (1 - ease.out(seg(fs % 40, 24, 40)));
    j.pose({ spine: [10, 0, 0], chest: [12, 8, 0], head: [24, 0, 0], handL: "pinch" });
    const nail = V3(-0.04, 0.86, 0.3).applyMatrix4(j.root.matrixWorld);
    const palm = left.clone();
    // thumb = handle axis toward the head: up and back when raised, forward and level at the strike
    const axisUp = up.clone().addScaledVector(fwd, -0.45).normalize(), axisHit = fwd.clone().addScaledVector(left, 0.35).normalize();
    const axis = axisUp.clone().lerp(axisHit, s).normalize();
    const raised = j.point("chest").addScaledVector(left, -0.2).addScaledVector(up, 0.02).addScaledVector(fwd, 0.22);
    // at the strike the head's face (along the fingers, i.e. down) sits on the nail: grip = head - axis * length;
    // `thumb: axis` makes the handle follow the axis exactly (the palm is squared to it)
    const head = nail.clone().addScaledVector(up, 0.065);
    const struck = head.clone().addScaledVector(axisHit, -GRIP_TO_HEAD);
    j.placeHand("R", raised.lerp(struck, s), { palm, thumb: axis, ref: "grip" });
    j.placeHand("L", nail.clone().addScaledVector(left, 0.035).addScaledVector(up, 0.012), { palm: up.clone().negate(), fingers: fwd.clone().addScaledVector(left, -0.7).normalize(), ref: "tips" });
    j.expr({ blink: blinkAt(fs, 3), brow: 0.15 });
    k.cam({ target: V3(0, 1.05, 0.15), size: k.p(1.5, 1.2), yaw: 38, pitch: 10, lens: 45 });
    k.key(40, 30, { lightCol: "#ffd8a8" });
  };
});

/** Drinking: cup in a wrap grip, thumb up; raised to the lips and tilted toward the face, head back a little. */
const H1 = shot("lamplight", (k) => {
  interior(k);
  const j = k.add(new Human(CAST.STEWARD));
  j.place(0, 0, 0, 0);
  const c = cup();
  j.grip("R", c, { kind: "wrap", r: 0.043, at: V3(0, 0.05, 0) });
  return (f) => {
    const fs = stepped(f);
    const { left, up, fwd } = j.axes();
    const d = ease.inOut(seg(fs, 10, 40)) * (1 - ease.inOut(seg(fs, 90, 120)));
    const tilt = d * 0.75;
    j.pose({ head: [-8 * d, 0, 0], neck: [-4 * d, 0, 0] });
    const mouth = j.point("mouth");
    const low = j.point("chest").addScaledVector(fwd, 0.22).addScaledVector(left, -0.1).addScaledVector(up, -0.1);
    const lips = mouth.clone().addScaledVector(fwd, 0.085).addScaledVector(up, -0.045).addScaledVector(left, -0.02);
    const axis = up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(fwd, -Math.sin(tilt));
    const palm = left.clone().addScaledVector(fwd, 0.25).normalize();
    j.placeHand("R", low.lerp(lips, d), { palm, thumb: axis });
    j.expr({ blink: d > 0.6 ? 1 : blinkAt(fs, 2), closedStyle: "calm", smile: 0.2 });
    k.cam({ target: j.point("mouth").addScaledVector(up, -0.08), size: "MCU", yaw: 35, pitch: 0, lens: 70 });
    k.key(40, 26, { lightCol: "#ffd8a8" });
  };
});

/** Both hands on a basket: palms in on either side of the rim, never crossed. */
const H2 = shot("golden", (k) => {
  interior(k);
  const boy = k.add(new Human(CAST.BOY));
  boy.place(0, 0, 0, 0);
  const b = basket({ r: 0.16, h: 0.12, full: true });
  k.add(b);
  return (f) => {
    const fs = stepped(f);
    const { up, fwd } = boy.axes();
    boy.pose({ head: [10, 0, 0] });
    const c = boy.point("chest").addScaledVector(fwd, 0.26).addScaledVector(up, -0.22);
    b.position.copy(c).addScaledVector(up, -0.08);
    boy.holdBoth(c, { half: 0.17, fingers: fwd.clone().addScaledVector(up, -0.8).normalize() });
    boy.expr({ blink: blinkAt(fs, 4), smile: 0.5 });
    k.cam({ target: c.clone().addScaledVector(up, 0.15), size: k.p(0.9, 0.75), yaw: 25, pitch: 6, lens: 55 });
    k.key(40, 26);
  };
});

/** A hand on another's shoulder (palm down, fingers over the shoulder) and a stone in a ball grip. */
const H3 = shot("day", (k) => {
  interior(k);
  const j = k.add(new Human(CAST.JESUS));
  const m = k.add(new Human(crowdLook(7, "man")));
  j.place(-0.32, 0, 30, 0);
  m.place(0.32, 0.2, -150, 0);
  const st = stone(0.045, 3);
  m.grip("R", st, { kind: "ball", r: 0.045 });
  return (f) => {
    const fs = stepped(f);
    j.pose({ head: [6, 0, 0] });
    m.pose({ head: [4, 0, 0], shR: [20, 0, 10], elR: [60, 0, 0] });
    const sh = m.j.shL.getWorldPosition(V3()).add(V3(0, 0.06, 0));
    const { fwd } = m.axes();
    j.placeHand("R", sh, { palm: V3(0, -1, 0), fingers: fwd.clone().negate().addScaledVector(V3(0, -1, 0), 0.6), ref: "palm" });
    j.expr({ blink: blinkAt(fs, 1), smile: 0.3 });
    m.expr({ blink: blinkAt(fs, 5), sad: 0.4 });
    k.cam({ target: V3(0, 1.35, 0.1), size: k.p(1.4, 1.1), yaw: 20, pitch: 4, lens: 45 });
    k.key(40, 26);
  };
});

const DEFS = [H0, H1, H2, H3];
export const HandLab: React.FC<{ v: number }> = ({ v }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shot def={DEFS[v]} />
  </AbsoluteFill>
);
