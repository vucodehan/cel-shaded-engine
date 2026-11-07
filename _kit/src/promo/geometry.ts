/**
 * The phone, measured on the reference (videoclone.md 10.3), in screen points (pt). World units are points too.
 *   phone-local: origin at the screen centre, x right, y up, z out of the glass (the screen is the plane z = 0)
 *   screen points: (0, 0) at the screen's top-left, y down, 402.5 x 874; screen and island callbacks draw in these
 */
import * as THREE from "three";

export type V3 = [number, number, number];

export const SCREEN_W = 402.5;
export const SCREEN_H = 874;
const OW = 433.85, OH = 905.47;

export const PHONE = {
  screen: { w: SCREEN_W, h: SCREEN_H, r: 49 },
  /** the frame's outer outline (front view); the black bezel is about 10 pt, the frame's rounded rim 5.5 pt */
  outline: { w: OW, h: OH, r: 71.8 },
  rim: 5.5,
  /** front glass to back glass */
  depth: 51.5,
  /** z of the front glass; the screen plane floats 0.6 pt in front of it */
  glassZ: -0.6,
  /** home screen grid: 4 columns at 95 pt, icons 70.8 pt, first row centred 123 pt below the screen top */
  grid: { cols: 4, pitch: 95, icon: 70.8, firstRow: 123 },
  /** side buttons: from/to in pt below the outline's top edge, z = centre (phone-local, behind the glass) */
  buttons: {
    action: { side: -1, from: 185.8, to: 227.7, z: -27.2, width: 16.6 },
    volUp: { side: -1, from: 252.2, to: 312.2, z: -27.2, width: 16.6 },
    volDown: { side: -1, from: 335.7, to: 395.7, z: -27.2, width: 16.6 },
    side: { side: 1, from: 262, to: 372, z: -27.2, width: 16.6 },
  },
} as const;
export type ButtonName = keyof typeof PHONE.buttons;

/** What a screen or island callback is told each frame. `frame` is the frame of the enclosing Sequence. */
export type ScreenInfo = { frame: number; fps: number; t: number; w: number; h: number; ppu: number; index: number };
/** Draws one frame of a phone's screen (or island layer) in screen points; the context is already scaled, and for
 * the screen clipped to its rounded corners. */
export type ScreenDraw = (ctx: CanvasRenderingContext2D, s: ScreenInfo) => void;

/** screen point (top-left origin, y down) -> phone-local point */
export const screenToLocal = (sx: number, sy: number, z = 0): V3 => [sx - SCREEN_W / 2, SCREEN_H / 2 - sy, z];

/** centre of a side button's outer face, phone-local (`out` = how far outside the side face) */
export const buttonLocal = (name: ButtonName, out = 1.7): V3 => {
  const b = PHONE.buttons[name];
  return [b.side * (OW / 2 + out), OH / 2 - (b.from + b.to) / 2, b.z];
};

/** A phone's placement in the world: position (pt), rotation (degrees, Euler XYZ), uniform scale. */
export type Pose = { position?: V3; rotation?: V3; scale?: number };

const D2R = Math.PI / 180;
const eu = new THREE.Euler();
const vv = new THREE.Vector3();
/** phone-local -> world, the same transform the stage applies to the phone's mesh */
export const localToWorld = (pose: Pose, p: V3): V3 => {
  const s = pose.scale ?? 1, r = pose.rotation ?? [0, 0, 0], t = pose.position ?? [0, 0, 0];
  eu.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, "XYZ");
  vv.set(p[0] * s, p[1] * s, p[2] * s).applyEuler(eu);
  return [vv.x + t[0], vv.y + t[1], vv.z + t[2]];
};

/** Points around the outline (phone-local) at depth z, grown by `grow` pt; for halos and silhouettes. */
export function outlinePoints(z = -PHONE.depth / 2, grow = 0, perCorner = 12): V3[] {
  const hw = OW / 2 + grow, hh = OH / 2 + grow, r = PHONE.outline.r + grow;
  const pts: V3[] = [];
  const corners: [number, number, number][] = [[hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180], [hw - r, -hh + r, 270]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = (a0 + (90 * i) / perCorner) * D2R;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
  }
  return pts;
}
