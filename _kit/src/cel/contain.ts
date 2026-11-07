/**
 * Containment: hands and feet inside open vessels (basins, bowls, jars, troughs) without crossing the walls.
 *
 * A Vessel is a round open container given by its inner wall, [radius, height] pairs from the floor up to the rim
 * in the object's local space (props export these with the prop, e.g. BASIN_INNER). The rule it enforces: a hand or
 * foot that is partly inside the vessel is wholly inside it below the rim. Points above the rim are free; a hand
 * entirely outside the vessel is left alone (holding it from outside is fine).
 *
 *   const v = vessel(basinObj, BASIN_INNER);
 *   keepIn(v, () => j.handPoints("R"), (s) => j.placeHand("R", at.clone().add(s), {...}));   // per frame, after placing
 *   fitVessel(v, [pe.footPoints("L"), pe.footPoints("R")])                                     // at build: scale/centre
 *   x -= clearOf(v, BASIN_OUTER, kneePoints, V3(-1, 0, 0))                                     // at build: kneel clear of it
 * Fit a vessel to what rests in it, not to everything that passes over it: fitted to a lifting foot as well, the
 * servant basin grew to 85 cm and the kneeling Jesus's legs ended up inside its wall.
 */
import * as THREE from "three";
import { V3 } from "./geo";

export type Vessel = { obj: THREE.Object3D; inner: [number, number][] };

export const vessel = (obj: THREE.Object3D, inner: [number, number][]): Vessel => ({ obj, inner });

/** Inner radius at local height y (clamped to the floor and the rim). */
export function innerRadius(inner: [number, number][], y: number) {
  if (y <= inner[0][1]) return inner[0][0];
  for (let i = 1; i < inner.length; i++) {
    const [r0, y0] = inner[i - 1], [r1, y1] = inner[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return inner[inner.length - 1][0];
}

type Probe = { inside: boolean; below: boolean; push: THREE.Vector3; depth: number };

/** One world point against the vessel: inside or not, below the rim or not, and the world push that brings it in. */
function probe(v: Vessel, p: THREE.Vector3, margin: number): Probe {
  v.obj.updateMatrixWorld(true);
  const s = v.obj.getWorldScale(V3()).x;
  const q = v.obj.getWorldQuaternion(new THREE.Quaternion());
  const l = v.obj.worldToLocal(p.clone());
  const m = margin / s;
  const floor = v.inner[0][1], rim = v.inner[v.inner.length - 1][1];
  const below = l.y < rim;
  const r = innerRadius(v.inner, Math.max(l.y, floor)) - m;
  const d = Math.hypot(l.x, l.z);
  const push = V3();
  if (below) {
    if (d > r) push.set((-l.x / Math.max(d, 1e-6)) * (d - r), 0, (-l.z / Math.max(d, 1e-6)) * (d - r));
    if (l.y < floor + m) push.y = floor + m - l.y;
  }
  const inside = below && d <= innerRadius(v.inner, Math.max(l.y, floor)) && l.y >= floor - 0.01 / s;
  push.applyQuaternion(q).multiplyScalar(s);
  return { inside, below, push, depth: push.length() };
}

/**
 * The correction for a set of points (a hand, a foot): null when none of them is in the vessel (nothing to enforce),
 * else the world vector that moves the whole set inside (zero when it already is).
 */
export function violation(v: Vessel, pts: THREE.Vector3[], margin = 0.008) {
  const ps = pts.map((p) => probe(v, p, margin));
  if (!ps.some((p) => p.inside)) return null;
  const out = V3();
  for (const p of ps) {
    if (!p.below) continue;
    // per axis, the largest push needed by any point
    for (const k of ["x", "y", "z"] as const) if (Math.abs(p.push[k]) > Math.abs(out[k])) out[k] = p.push[k];
  }
  return out;
}

/**
 * Per frame: after placing a hand, re-place it shifted until no part of it crosses the wall (2 passes). `place`
 * re-runs the placement with an extra world offset. Returns the total shift applied.
 */
export function keepIn(v: Vessel, pts: () => THREE.Vector3[], place: (shift: THREE.Vector3) => void, o: { margin?: number; passes?: number } = {}) {
  const total = V3();
  for (let i = 0; i < (o.passes ?? 2); i++) {
    const s = violation(v, pts(), o.margin ?? 0.008);
    if (!s || s.lengthSq() < 1e-8) break;
    total.add(s);
    place(total.clone());
  }
  return total;
}

/**
 * At build time: how far a body must move along `dir` (a horizontal world direction away from the vessel) so that
 * every given point (knees, shins, feet of someone kneeling or sitting beside it) clears the vessel's outer wall by
 * `margin`. `outer` is the outer wall, [radius, height] floor to rim, in the vessel's local space; points above the
 * rim are free. Returns 0 when already clear.
 */
export function clearOf(v: Vessel, outer: [number, number][], pts: THREE.Vector3[], dir: THREE.Vector3, margin = 0.02) {
  v.obj.updateMatrixWorld(true);
  const s = v.obj.getWorldScale(V3()).x;
  const rim = outer[outer.length - 1][1];
  const d = dir.clone().setY(0).normalize();
  const clear = (t: number) =>
    pts.every((p) => {
      const l = v.obj.worldToLocal(p.clone().addScaledVector(d, t));
      if (l.y > rim + margin / s) return true;
      return Math.hypot(l.x, l.z) * s >= innerRadius(outer, Math.max(l.y, outer[0][1])) * s + margin;
    });
  let t = 0;
  while (!clear(t) && t < 1) t += 0.005;
  return t;
}

/**
 * At build time: the smallest uniform scale (>= the current one) and the horizontal centre that hold every given
 * point set inside the vessel below the rim (feet resting in a basin across a shot's poses). Applies them to v.obj
 * when `apply` and returns { scale, center, fits }.
 */
export function fitVessel(v: Vessel, sets: THREE.Vector3[][], o: { margin?: number; apply?: boolean; maxScale?: number } = {}) {
  const margin = o.margin ?? 0.012;
  const pts = sets.flat();
  const obj = v.obj;
  const parentInv = obj.parent ? obj.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  const lp = pts.map((p) => p.clone().applyMatrix4(parentInv));
  const cx = (Math.min(...lp.map((p) => p.x)) + Math.max(...lp.map((p) => p.x))) / 2;
  const cz = (Math.min(...lp.map((p) => p.z)) + Math.max(...lp.map((p) => p.z))) / 2;
  let scale = obj.scale.x;
  const maxScale = o.maxScale ?? scale * 1.6;
  const fitsAt = (s: number) =>
    lp.every((p) => {
      const y = (p.y - obj.position.y) / s;
      const rim = v.inner[v.inner.length - 1][1];
      if (y >= rim) return true;
      return Math.hypot(p.x - cx, p.z - cz) <= innerRadius(v.inner, Math.max(y, v.inner[0][1])) * s - margin;
    });
  while (!fitsAt(scale) && scale < maxScale) scale *= 1.03;
  const fits = fitsAt(scale);
  if (o.apply !== false) {
    obj.position.x = cx;
    obj.position.z = cz;
    obj.scale.setScalar(scale);
    obj.updateMatrixWorld(true);
  }
  return { scale, center: V3(cx, obj.position.y, cz), fits };
}
