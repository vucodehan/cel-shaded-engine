/**
 * Shot grammar. A shot is framed by subject anchor + size + angle + lens, never by raw camera coordinates, so
 * the same spec frames correctly in 16:9 and 9:16 (cover applies to the SHORT side of the frame).
 *
 *   EWS  extreme wide: figure tiny in the land      cover ~ 40 m
 *   WS   wide: whole figure with room                5.5 m
 *   FS   full figure head to toe                      2.2 m
 *   MS   medium: waist up                             1.0 m
 *   MCU  medium close-up: chest up                    0.6 m
 *   CU   close-up: head and neck                      0.34 m
 *   ECU  extreme close-up: eyes / hands / detail      0.13 m
 * Lens in mm on a 24 mm short side: anime close-ups read flatter on long lenses (85-135), drama on wide (18-28).
 */
import * as THREE from "three";
import { V3, clamp, lerp, noise2 } from "./geo";

export type Size = "EWS" | "WS" | "FS" | "MS" | "MCU" | "CU" | "ECU";
export const COVER: Record<Size, number> = { EWS: 40, WS: 5.5, FS: 2.2, MS: 1.0, MCU: 0.6, CU: 0.34, ECU: 0.13 };

export type Frame = {
  target: THREE.Vector3;
  size: Size | number;
  /** camera azimuth (deg) around the target, relative to `facing`; 0 = in front, 90 = subject's left side */
  yaw?: number;
  /** elevation (deg): + above looking down */
  pitch?: number;
  lens?: number;
  /** subject facing yaw (deg) */
  facing?: number;
  /** where the target sits on screen: x in half-widths (+ right), y in half-heights (+ up) */
  sx?: number;
  sy?: number;
  roll?: number;
};

export type CamOut = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number };

const D = Math.PI / 180;

export function frameCam(f: Frame, aspect: number): CamOut {
  const lens = f.lens ?? 50;
  const fovShort = 2 * Math.atan(12 / lens);
  const fovV = aspect >= 1 ? fovShort : 2 * Math.atan(Math.tan(fovShort / 2) / aspect);
  const cover = typeof f.size === "number" ? f.size : COVER[f.size];
  const d = cover / (2 * Math.tan(fovShort / 2));
  const az = ((f.facing ?? 0) + (f.yaw ?? 0)) * D;
  const el = (f.pitch ?? 0) * D;
  const dir = V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const pos = f.target.clone().addScaledVector(dir, d);
  const fwd = dir.clone().negate();
  const right = V3().crossVectors(fwd, V3(0, 1, 0)).normalize();
  const up = V3().crossVectors(right, fwd).normalize();
  const hh = d * Math.tan(fovV / 2);
  const hw = hh * aspect;
  const look = f.target.clone().addScaledVector(right, -(f.sx ?? 0) * hw).addScaledVector(up, -(f.sy ?? 0) * hh);
  return { pos, look, fov: fovV / D, roll: f.roll ?? 0 };
}

/** Interpolate two frames (targets lerp; size interpolates in log space so pushes feel even). */
export function lerpFrame(a: Frame, b: Frame, t: number): Frame {
  const ca = typeof a.size === "number" ? a.size : COVER[a.size];
  const cb = typeof b.size === "number" ? b.size : COVER[b.size];
  const l = (x?: number, y?: number, dflt = 0) => lerp(x ?? dflt, y ?? dflt, t);
  return {
    target: a.target.clone().lerp(b.target, t),
    size: Math.exp(lerp(Math.log(ca), Math.log(cb), t)),
    yaw: l(a.yaw, b.yaw), pitch: l(a.pitch, b.pitch), lens: l(a.lens, b.lens, 50), facing: l(a.facing, b.facing),
    sx: l(a.sx, b.sx), sy: l(a.sy, b.sy), roll: l(a.roll, b.roll),
  };
}

export function applyCam(cam: THREE.PerspectiveCamera, c: CamOut, aspect: number, shake = 0, f = 0) {
  cam.aspect = aspect;
  cam.fov = c.fov;
  cam.position.copy(c.pos);
  if (shake > 0) {
    cam.position.x += noise2(f * 0.031, 1.3) * shake;
    cam.position.y += noise2(f * 0.027, 7.9) * shake * 0.7;
  }
  cam.up.set(0, 1, 0);
  cam.lookAt(c.look);
  if (c.roll) cam.rotateZ(c.roll * D);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

/** Characters on twos (or threes): hold each pose for n frames. Camera stays on ones. */
export const stepped = (f: number, n = 2) => Math.floor(f / n) * n;

export const ease = {
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  sine: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  /** overshoot then settle (anime "snap") */
  back: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/** 0..1 progress of f through [a, b] frames, clamped. */
export const seg = (f: number, a: number, b: number) => clamp((f - a) / Math.max(1e-6, b - a));

/** Key-framed number: keys [[frame, value], ...] with easing between keys. */
export function keys(f: number, k: [number, number][], e: (t: number) => number = ease.inOut) {
  if (f <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (f <= k[i][0]) return lerp(k[i - 1][1], k[i][1], e(seg(f, k[i - 1][0], k[i][0])));
  }
  return k[k.length - 1][1];
}
