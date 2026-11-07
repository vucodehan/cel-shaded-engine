/**
 * Hand-offs between a 2D overlay (image px) and a phone's screen or island layer (screen points), and overlays that
 * pass behind the phone. An element that changes layers must keep its position, size AND heading on the switch
 * frame (one ad shipped with 30-60 degree heading snaps at its hand-offs). screenToImage / imageToScreen give the
 * exact matching pose for this frame's camera, in both directions; handoff() bends your own overlay motion onto it
 * over a few frames, so the switch cannot be seen. Rotations are degrees in y-down space (clockwise), as everywhere.
 */
import * as THREE from "three";
import { clamp } from "./ease";
import { Projector } from "./camera";
import { PHONE, Pose, SCREEN_H, SCREEN_W, V3 } from "./geometry";

/** A sprite in a 2D space: centre, size (px in image space, pt on a screen), rotation, mirror and a stretch along
 * stretchAngle (deg). The same fields as MascotPose: spread it into <Mascot> or drawMascot. */
export type SpritePose = { x: number; y: number; size: number; rot?: number; flip?: boolean; stretch?: number; stretchAngle?: number };
/** 2D affine [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (the order of SVG matrix() and setTransform). */
export type Mat2D = [number, number, number, number, number, number];
type M2 = [number, number, number, number]; // row-major [m00, m01, m10, m11]

const D2R = Math.PI / 180;
const mul = (a: M2, b: M2): M2 => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
const rotM = (deg: number): M2 => {
  const c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
  return [c, -s, s, c];
};
const stretchM = (st: number, sa: number): M2 => mul(mul(rotM(sa), [st, 0, 0, 1 / st]), rotM(-sa));
/** the sprite's linear map (sprite-local unit -> its space), as Mascot builds it */
const spriteM = (p: SpritePose): M2 => mul(mul(stretchM(p.stretch ?? 1, p.stretchAngle ?? 0), rotM(p.rot ?? 0)), [p.flip ? -p.size : p.size, 0, 0, p.size]);

/** Polar decomposition of a linear map into the sprite fields: M = stretch(st, sa) . rot . (flip) . size. */
function decompose(M: M2) {
  const flip = M[0] * M[3] - M[1] * M[2] < 0;
  const A: M2 = flip ? [-M[0], M[1], -M[2], M[3]] : M;
  const rot = Math.atan2(A[2] - A[1], A[0] + A[3]) / D2R;
  const P = mul(A, rotM(-rot));
  const p = P[0], q = (P[1] + P[2]) / 2, r = P[3];
  const mean = (p + r) / 2, dif = Math.hypot((p - r) / 2, q);
  const l1 = mean + dif, l2 = Math.max(1e-9, mean - dif);
  return { size: Math.sqrt(l1 * l2), rot, flip, stretch: Math.sqrt(l1 / l2), stretchAngle: (0.5 * Math.atan2(2 * q, p - r)) / D2R };
}

/** Image px per screen pt at a screen point, as a matrix whose columns are the screen's x and y axes in the image. */
function jacobian(P: Projector, phone: Pose, sx: number, sy: number, z: number): M2 {
  const a = P.screen(phone, sx - 1, sy, z), b = P.screen(phone, sx + 1, sy, z), c = P.screen(phone, sx, sy - 1, z), d = P.screen(phone, sx, sy + 1, z);
  return [(b.x - a.x) / 2, (d.x - c.x) / 2, (b.y - a.y) / 2, (d.y - c.y) / 2];
}

/**
 * Where a sprite drawn in a phone's screen (or island layer, z 0.08) at screen pose `s` (pt) appears in the frame:
 * the overlay pose that matches it exactly on this frame (stretch = the screen's foreshortening; flip = seen from
 * behind). `matrix` = the screen -> image map linearised at that point: draw any screen-space content (a card, a
 * photo) in an overlay with it and it lands on the in-screen drawing.
 */
export function screenToImage(P: Projector, phone: Pose, s: SpritePose, z = 0): Required<SpritePose> & { matrix: Mat2D; front: boolean } {
  const q = P.screen(phone, s.x, s.y, z), J = jacobian(P, phone, s.x, s.y, z);
  const d = decompose(mul(J, spriteM(s)));
  return { x: q.x, y: q.y, ...d, matrix: [J[0], J[2], J[1], J[3], q.x - J[0] * s.x - J[1] * s.y, q.y - J[2] * s.x - J[3] * s.y], front: q.front };
}

const inv = new THREE.Matrix4(), mat = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), sc = new THREE.Vector3();
/** Screen point (pt) under an image point, through the phone's screen plane (z); hit = false when it misses. */
export function imageToScreenPoint(P: Projector, phone: Pose, x: number, y: number, z = 0) {
  const r = phone.rotation ?? [0, 0, 0], t = phone.position ?? [0, 0, 0], s = phone.scale ?? 1;
  eu.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, "XYZ");
  inv.copy(mat.compose(v1.set(t[0], t[1], t[2]), qt.setFromEuler(eu), sc.set(s, s, s))).invert();
  const o = v1.copy(P.camera.position).applyMatrix4(inv);
  const p = v2.set((x / P.W) * 2 - 1, 1 - (y / P.H) * 2, 0.5).unproject(P.camera).applyMatrix4(inv);
  const dz = p.z - o.z, k = Math.abs(dz) < 1e-9 ? -1 : (z - o.z) / dz;
  const lx = o.x + (p.x - o.x) * k, ly = o.y + (p.y - o.y) * k;
  return { x: lx + SCREEN_W / 2, y: SCREEN_H / 2 - ly, hit: k > 0 };
}

/** The inverse of screenToImage: the in-screen pose (pt) that looks like overlay pose `o` (px) on this frame. */
export function imageToScreen(P: Projector, phone: Pose, o: SpritePose, z = 0): Required<SpritePose> & { hit: boolean } {
  const pt = imageToScreenPoint(P, phone, o.x, o.y, z), J = jacobian(P, phone, pt.x, pt.y, z);
  const det = J[0] * J[3] - J[1] * J[2] || 1e-9;
  const d = decompose(mul([J[3] / det, -J[1] / det, -J[2] / det, J[0] / det], spriteM(o)));
  return { x: pt.x, y: pt.y, ...d, hit: pt.hit };
}

const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
/** Blend two sprite poses: position linear, size geometric, rotation the short way round, stretch as a matrix. */
export function mixPose(a: SpritePose, b: SpritePose, k: number): Required<SpritePose> {
  const S1 = stretchM(a.stretch ?? 1, a.stretchAngle ?? 0), S2 = stretchM(b.stretch ?? 1, b.stretchAngle ?? 0);
  const S = S1.map((v, i) => v + (S2[i] - v) * k) as M2, sd = decompose(S);
  const ra = a.rot ?? 0;
  return {
    x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k,
    size: a.size * Math.pow(Math.max(1e-6, b.size) / Math.max(1e-6, a.size), k),
    rot: ra + wrap180((b.rot ?? 0) - ra) * k,
    flip: k < 0.5 ? !!a.flip : !!b.flip,
    stretch: sd.stretch, stretchAngle: sd.stretchAngle,
  };
}

export type HandoffOpts = {
  /** this frame's projector (same Cam as the stage) and the phone's pose */ P: Projector; phone: Pose;
  /** the switch frame: from `at` on, the new layer draws the sprite */ at: number;
  /** "land": overlay -> screen/island (the screen draws from `at`); "takeoff": screen/island -> overlay */ dir: "land" | "takeoff";
  /** the sprite's in-screen pose (pt); a function of the frame if it moves on the screen */ screen: SpritePose | ((frame: number) => SpritePose);
  /** your overlay motion (px): flight, pathFlight, poseTrack...; it is pulled onto the projected pose near `at` */ overlay: (frame: number) => SpritePose;
  /** frames of the pull (default 8): the last frames before a landing, the first after a take-off */ blend?: number;
  /** z of the layer: 0 the screen (default), 0.08 the island layer */ z?: number;
};
/** One frame of a hand-off: which layer draws the sprite, its pose in that layer's space, the pull weight k
 * (1 = exactly the projected screen pose) and `off`, how far your own overlay motion is from it this frame. */
export function handoff(frame: number, o: HandoffOpts): { layer: "overlay" | "screen"; pose: Required<SpritePose>; k: number; off: { px: number; deg: number; scale: number } } {
  const scr = typeof o.screen === "function" ? o.screen(frame) : o.screen;
  const full = (p: SpritePose): Required<SpritePose> => ({ rot: 0, flip: false, stretch: 1, stretchAngle: 0, ...p });
  const none = { px: 0, deg: 0, scale: 1 };
  if (o.dir === "land" ? frame >= o.at : frame < o.at) return { layer: "screen", pose: full(scr), k: 1, off: none };
  const B = Math.max(1, o.blend ?? 8);
  const target = screenToImage(o.P, o.phone, scr, o.z), own = o.overlay(frame);
  const u = clamp(o.dir === "land" ? (frame - (o.at - B)) / B : 1 - (frame - o.at) / B), k = u * u * (3 - 2 * u);
  const off = { px: Math.hypot(target.x - own.x, target.y - own.y), deg: wrap180(target.rot - (own.rot ?? 0)), scale: target.size / Math.max(1e-6, own.size) };
  return { layer: "overlay", pose: mixPose(own, target, k), k, off };
}

/** View depth of a phone's middle (pt from the camera): overlays deeper than this pass behind it. */
export const phoneDepth = (P: Projector, phone: Pose = {}) => P.local(phone, [0, 0, -PHONE.depth / 2]).depth;
/** True when a world point is farther from the camera than the phone's middle. */
export const behindPhone = (P: Projector, phone: Pose, p: V3) => P.point(p).depth > phoneDepth(P, phone);
/** Split overlay items by view depth against `pivot` (phoneDepth) into the layer behind the phone (PhoneStage
 * `behind`) and the one in front, each sorted far to near (paint order). */
export function splitByDepth<T>(items: T[], depth: (t: T) => number, pivot: number) {
  const sorted = [...items].sort((a, b) => depth(b) - depth(a));
  return { back: sorted.filter((t) => depth(t) > pivot), front: sorted.filter((t) => depth(t) <= pivot) };
}
