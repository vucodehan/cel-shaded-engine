/**
 * Contact and occlusion, enforced every frame by <Shot> after the shot's update (no per-shot code):
 *
 * 1. Solid props. A round prop (basket, basin, jar) carries its walls in `obj.userData.solid = { outer, inner? }`
 *    ([radius, height] pairs from the base up, local units; the prop functions set it). A Human hand whose points
 *    enter the material of a solid (the wall between the inner and outer surface, or the base) is moved out rigidly,
 *    keeping its orientation and its elbow side: out through the wall or down under the base when the hand is
 *    outside (supporting it from beneath, holding it by the side), in toward the middle or up off the floor when the
 *    hand is inside it (taking bread out of a basket). Above the rim is free; the cavity is free for a hand inside it
 *    and closed to a hand outside it below the top 3 cm (fingers hooked over the rim are fine, fingers rising through
 *    the floor are not). Corrections are capped at MAX_PUSH (3 cm): a deeper hand is a wrong pose, fixed in the shot.
 *    Objects a figure holds (parented to its hand) are skipped for that figure: they move with the hand.
 * 2. Ground clearing. A prop resting on the ground (`obj.userData.footprint = r`, local units) and every seated or
 *    kneeling Human clear the grass rooted under them: the grass shader drops blades inside these discs (G.uClear),
 *    so no blade pokes up through a basket's floor or a sitter's robe. Something held in the air clears nothing.
 *
 * Fixing a contact in the shot is still the job when the pose itself is wrong (curled fingers into the wicker, palms
 * waiting at an angle); this pass is the safety net that stops the remaining millimetres and centimetres from showing.
 */
import * as THREE from "three";
import { G } from "./engine";
import { V3 } from "./geo";
import { innerRadius } from "./contain";
import type { Human } from "./human";

export type Solid = { outer: [number, number][]; inner?: [number, number][] };
export const MAX_CLEAR = 48;

type Reg = { humans: Human[]; solids: THREE.Object3D[]; grounds: THREE.Object3D[] };

function registry(scene: THREE.Scene): Reg {
  const ud = scene.userData as { contact?: Reg };
  if (ud.contact) return ud.contact;
  const reg: Reg = { humans: [], solids: [], grounds: [] };
  scene.traverse((o) => {
    if (o.userData.human) reg.humans.push(o.userData.human as Human);
    if (o.userData.solid) reg.solids.push(o);
    if (o.userData.footprint) reg.grounds.push(o);
  });
  ud.contact = reg;
  return reg;
}

/** How far below the rim fingers may hook over it into the cavity (or a hand inside may reach out over it). */
const HOOK = 0.03;

/**
 * Is local point l free for a hand whose palm is outside the solid (`inside` false) or in its cavity (true)? For a
 * hand outside, the cavity is closed except just under the rim (fingers hooked over it): fingers deeper in the cavity
 * must have gone through the wall. For a hand inside, the outside is closed the same way.
 */
function free(s: Solid, l: THREE.Vector3, m: number, inside: boolean, hook: number) {
  const rim = s.outer[s.outer.length - 1][1];
  if (l.y < -m || l.y > rim + m) return true;
  const d = Math.hypot(l.x, l.z);
  if (d >= innerRadius(s.outer, l.y) + m) return !inside || l.y > rim - hook;
  if (s.inner && l.y >= s.inner[0][1] + m && d <= innerRadius(s.inner, l.y) - m) return inside || l.y > rim - hook;
  return false;
}

/**
 * The world offset that brings every point out of the solid's material (null when none is in it). `margins` is the
 * skin margin of each point (the palm-centre reference already lies 3 mm off the skin; fingertips are capsule centres
 * 9 mm inside theirs). Candidate exits: radially out and down when the palm is outside the cavity, radially in and up
 * when it is inside; the shortest wins.
 */
export function solidPush(obj: THREE.Object3D, pts: THREE.Vector3[], palm: THREE.Vector3, margins: number[]) {
  const s = obj.userData.solid as Solid;
  obj.updateWorldMatrix(true, false);
  const sc = obj.getWorldScale(V3()).x;
  const ms = margins.map((m) => m / sc);
  const hook = HOOK / sc;
  const lp = pts.map((p) => obj.worldToLocal(p.clone()));
  const pl = obj.worldToLocal(palm.clone());
  const rim = s.outer[s.outer.length - 1][1];
  // inside only when clearly in the cavity: a palm pressed on the outer wall near the rim is not
  const inside = !!s.inner && pl.y >= s.inner[0][1] && pl.y < rim - 0.01 / sc && Math.hypot(pl.x, pl.z) < innerRadius(s.inner, pl.y) - 0.02 / sc;
  const ok = (t: number, d: THREE.Vector3) => lp.every((l, i) => free(s, l.clone().addScaledVector(d, t), ms[i], inside, hook));
  const rad = V3(pl.x, 0, pl.z);
  if (rad.lengthSq() < 1e-8) rad.set(1, 0, 0);
  rad.normalize();
  if (ok(0, rad)) return null;
  const dirs = inside ? [rad.clone().negate(), V3(0, 1, 0)] : [rad, V3(0, -1, 0)];
  let best: { d: THREE.Vector3; t: number } | null = null;
  for (const d of dirs) {
    let t = 0;
    while (t < 0.25 / sc && !ok(t, d)) t += 0.002 / sc;
    if (!best || t < best.t) best = { d, t };
  }
  if (!best || best.t <= 0) return null;
  const q = obj.getWorldQuaternion(new THREE.Quaternion());
  return best.d.clone().applyQuaternion(q).multiplyScalar(best.t * sc);
}

const isUnder = (o: THREE.Object3D, root: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true;
  return false;
};

/** Largest automatic correction: a hand deeper in a prop than this is a wrong pose, fixed in the shot, not here. */
export const MAX_PUSH = 0.03;

/**
 * Move every hand out of every solid prop it entered (2 passes: the IK may not land exactly). Corrections larger
 * than MAX_PUSH are not applied (a hand pushed 4 cm off a basket floats in the air) but logged as "[contact] ..."
 * (celstills.mjs prints them under the still) and kept in scene.userData.contactWarn.
 */
export function resolveHands(scene: THREE.Scene) {
  const reg = registry(scene);
  if (!reg.solids.length) return;
  for (const h of reg.humans) {
    if (!h.root.visible) continue;
    for (const sd of ["L", "R"] as const) {
      if (!h.hasFingers(sd)) continue;
      for (const obj of reg.solids) {
        if (!obj.visible || isUnder(obj, h.root)) continue;
        const s = obj.userData.solid as Solid;
        const c = obj.getWorldPosition(V3());
        const reach = s.outer.reduce((a, [r, y]) => Math.max(a, r, y), 0) * obj.getWorldScale(V3()).x + 0.25;
        if (h.point(sd === "L" ? "handL" : "handR").distanceTo(c) > reach) continue;
        for (let pass = 0; pass < 2; pass++) {
          const pts = h.handPoints(sd);
          const push = solidPush(obj, pts, pts[1], pts.map((_, i) => (i === 1 ? 0.002 : i === 0 ? 0.012 : 0.009)));
          if (!push) break;
          if (push.length() > MAX_PUSH) {
            const w = (scene.userData.contactWarn ??= new Set<string>()) as Set<string>;
            const msg = `[contact] ${h.look.name} hand ${sd}: ${Math.round(push.length() * 100)} cm into a prop (fix the pose)`;
            if (!w.has(msg)) console.warn(msg);
            w.add(msg);
            break;
          }
          h.nudgeHand(sd, push);
        }
      }
    }
  }
}

/** Fill G.uClear with the ground discs nearest the camera: resting props, then seated and kneeling people. */
export function clearGround(scene: THREE.Scene, camera: THREE.Camera) {
  const reg = registry(scene);
  const discs: { v: THREE.Vector4; d: number }[] = [];
  const cam = camera.getWorldPosition(V3());
  for (const o of reg.grounds) {
    if (!o.visible) continue;
    const p = o.getWorldPosition(V3());
    const r = (o.userData.footprint as number) * o.getWorldScale(V3()).x;
    discs.push({ v: new THREE.Vector4(p.x, p.y, p.z, r), d: p.distanceTo(cam) });
  }
  for (const h of reg.humans) {
    const f = h.seatFootprint();
    if (f) discs.push({ v: f, d: cam.distanceTo(V3(f.x, f.y, f.z)) });
  }
  discs.sort((a, b) => a.d - b.d);
  const n = Math.min(MAX_CLEAR, discs.length);
  for (let i = 0; i < n; i++) G.uClear.value[i].copy(discs[i].v);
  G.uClearN.value = n;
}

/** The per-frame pass <Shot> runs after update(): hands out of solids, then the grass discs. */
export function contactPass(scene: THREE.Scene, camera: THREE.Camera) {
  resolveHands(scene);
  clearGround(scene, camera);
}
