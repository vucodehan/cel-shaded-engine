import React from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { Shot, ShotDef, newScene, setEnv } from "./cel/Shot";
import { Frame, applyCam, frameCam } from "./cel/cam";
import { Human, LOOKS, blinkAt } from "./cel/human";
import { V3 } from "./cel/geo";
import { cloud, galileeHeight, grass, hillRing, oliveTree, rockMesh, sky, terrain } from "./cel/world";

const H = galileeHeight(2, [0, 0, 5]);

const VIEWS: ((j: Human) => Frame)[] = [
  (j) => ({ target: j.point("head"), size: "CU", yaw: 12, pitch: 2, lens: 85, sx: 0.12, sy: 0.08 }),
  (j) => ({ target: j.point("eyes"), size: "MCU", yaw: -18, pitch: 0, lens: 70, sx: -0.3, sy: 0.32 }),
  (j) => ({ target: j.point("chest"), size: "MS", yaw: 25, pitch: 4, lens: 50, sx: 0.3, sy: 0.2 }),
  (j) => ({ target: j.point("hips"), size: "WS", yaw: -30, pitch: 6, lens: 35, sx: -0.25, sy: 0.05 }),
  (j) => ({ target: j.point("hips"), size: "EWS", yaw: 20, pitch: 10, lens: 28, sx: 0.3, sy: -0.25 }),
  (j) => ({ target: j.point("eyes"), size: "ECU", yaw: 5, pitch: 0, lens: 100, sx: 0, sy: 0 }),
  (j) => ({ target: j.point("head"), size: "CU", yaw: 42, pitch: 0, lens: 85, sx: 0.2, sy: 0.08 }),
  (j) => ({ target: j.point("head"), size: "CU", yaw: 85, pitch: 0, lens: 85, sx: 0.2, sy: 0.08 }),
];

const lab = (v: number): ShotDef => (ctx) => {
  const { scene, camera } = newScene();
  const sun = V3(-0.85, 0.42, 0.3).normalize();
  scene.add(sky({ zenith: "#4f86c6", horizon: "#f6dcb4", low: "#e8c9a0", sun: V3(-0.6, 0.12, -0.8), sunCol: "#ffd9a0", glow: 0.45, streaks: 0.5, streakCol: "#fff3e6" }));
  scene.add(terrain({ size: 500, res: 260, h: H, color: (x, z, y) => new THREE.Color("#a7b46a").lerp(new THREE.Color("#c9b47a"), Math.min(1, Math.max(0, (y - 1) * 0.12 + 0.3 + Math.sin(x * 0.07) * 0.2))) }));
  scene.add(hillRing({ r: 700, h: 70, color: "#8fa3c4", shade: "#7f8fb5", seed: 3 }));
  scene.add(hillRing({ r: 420, h: 38, color: "#9eb07c", shade: "#7d8ea6", seed: 9, peaks: 5 }));
  scene.add(cloud({ x: -260, y: 150, z: -700, w: 360, h: 70, seed: 4 }));
  scene.add(cloud({ x: 220, y: 190, z: -800, w: 300, h: 60, seed: 8 }));
  scene.add(cloud({ x: 40, y: 230, z: -900, w: 420, h: 90, seed: 12 }));
  for (const [x, z, s, sd] of [[-6, -9, 1.1, 1], [7, -14, 1.3, 2], [-14, -22, 1.2, 3], [16, -30, 1.4, 4], [3, -40, 1.2, 5]] as const)
    scene.add(oliveTree({ x, z, y: H(x, z) - 0.05, s, seed: sd }));
  scene.add(rockMesh({ x: 1.8, z: -1.2, y: H(1.8, -1.2), r: 0.55, seed: 2 }));
  scene.add(rockMesh({ x: -2.4, z: 1.5, y: H(-2.4, 1.5), r: 0.35, seed: 5 }));
  scene.add(grass({ n: 6000, area: [-14, -14, 14, 10], h: H, seed: 2, size: 0.5 }));

  const jesus = new Human(LOOKS.JESUS);
  jesus.place(0, 0, 0, H(0, 0));
  scene.add(jesus.root);

  return {
    scene,
    camera,
    update: (f) => {
      setEnv({ light: sun, shadowTint: "#7b6fa8", rim: V3(0.5, 0.35, -0.8), rimCol: "#ffe2b0", rimAmt: 0.6, fogCol: "#ecd9bd", fogNear: 40, fogFar: 900, fogAmt: 0.75 });
      jesus.pose({
        chest: [2, 0, 0], head: [4, 0, 2],
        shR: [38, 0, 10], elR: [62, 0, 0], wrR: [10, 0, -10], handR: "open",
        shL: [4, 0, 8], elL: [14, 0, 0], handL: "relax",
      });
      jesus.expr({ smile: 0.35, blink: blinkAt(f, 1), light: -1, lookX: 0.05 });
      const fr = VIEWS[v](jesus);
      applyCam(camera, frameCam(fr, ctx.aspect), ctx.aspect);
    },
    post: () => ({ bloom: 0.5, rays: 0.25, sunDir: V3(-0.6, 0.12, -0.8), paraTop: new THREE.Color("#ffe9c9"), paraBot: new THREE.Color("#c9b4e0"), paraAmt: 0.18, dof: v === 0 || v === 1 || v >= 5 ? 0.8 : 0, focus: 1.6, focusRange: 6 }),
    shadow: { center: V3(0, 1, 0), size: 2.2 },
  };
};

const DEFS = VIEWS.map((_, i) => lab(i));

export const Lab: React.FC<{ v: number }> = ({ v }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shot def={DEFS[v]} />
  </AbsoluteFill>
);
