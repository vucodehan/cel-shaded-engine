/**
 * The camera: an orbit around an aim point, with the house lens and the measured house moves (videoclone.md 10.2).
 *   yaw   degrees around the vertical; negative = the camera swings to the phone's left side (the Action Button)
 *   elev  degrees above the aim point; negative = the camera is lower and looks up at the phone
 *   roll  degrees about the view axis;  dist: pt from the aim point;  aim: world point at the frame centre
 *   fov   degrees across the frame's SHORT side (23.3 = the house 85 mm look in both 16:9 and 9:16)
 *   shift lens shift in frame fractions [x right, y up]: moves the picture without changing the perspective
 */
import * as THREE from "three";
import { Ease, EASE, FieldKey, fields } from "./ease";
import type { Format } from "./format";
import { ButtonName, buttonLocal, localToWorld, PHONE, Pose, screenToLocal, V3 } from "./geometry";

export type Cam = { yaw: number; elev: number; roll: number; dist: number; aim: V3; fov: number; shift: [number, number] };
export const HOUSE_FOV = 23.3;

/** A full camera from a partial one (defaults: straight on, 885 pt away, the house lens). */
export const cam = (c: Partial<Cam> = {}): Cam => ({ yaw: 0, elev: 0, roll: 0, dist: 885, aim: [0, 310, 0], fov: HOUSE_FOV, shift: [0, 0], ...c });

const R = Math.PI / 180;
/** three.js vertical FOV from the kit's short-side FOV */
export const vfovOf = (fov: number, W: number, H: number) => (W >= H ? fov : (2 * Math.atan(Math.tan((fov * R) / 2) * (H / W))) / R);

/** Pose a three.js camera from a Cam (the stage and the projector both use this, so overlays match the render). */
export function applyCam(camera: THREE.PerspectiveCamera, c: Cam, W: number, H: number) {
  camera.fov = vfovOf(c.fov, W, H);
  camera.aspect = W / H;
  camera.near = Math.max(0.5, c.dist * 0.04);
  camera.far = c.dist * 12 + 8000;
  const y = c.yaw * R, e = c.elev * R;
  const [ax, ay, az] = c.aim;
  camera.position.set(ax + c.dist * Math.sin(y) * Math.cos(e), ay + c.dist * Math.sin(e), az + c.dist * Math.cos(y) * Math.cos(e));
  camera.up.set(0, 1, 0);
  camera.lookAt(ax, ay, az);
  if (c.roll) camera.rotateZ(c.roll * R);
  if (c.shift[0] || c.shift[1]) camera.setViewOffset(W, H, -c.shift[0] * W, c.shift[1] * H, W, H);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/** An image point: x, y in px (composition space), s = px per world unit at that depth, depth along the view. */
export type Projected = { x: number; y: number; s: number; depth: number; front: boolean };

/** Projection helper for 2D overlays: where a world point, a phone-local point, a screen point or a side button of a
 * posed phone lands in the frame, for the same Cam the stage renders. Multiply s by a phone's scale for px per pt. */
export function projector(c: Cam, W: number, H: number) {
  const camera = applyCam(new THREE.PerspectiveCamera(), c, W, H);
  const v = new THREE.Vector3();
  const tanHalf = Math.tan((camera.fov * R) / 2);
  const point = (p: V3): Projected => {
    v.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse);
    const depth = -v.z;
    v.set(p[0], p[1], p[2]).project(camera);
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, s: H / (2 * Math.max(depth, 1e-6) * tanHalf), depth, front: depth > 0 };
  };
  return {
    camera, W, H,
    point,
    local: (pose: Pose, p: V3) => point(localToWorld(pose, p)),
    screen: (pose: Pose, sx: number, sy: number, z = 0) => point(localToWorld(pose, screenToLocal(sx, sy, z))),
    button: (pose: Pose, name: ButtonName) => point(localToWorld(pose, buttonLocal(name))),
  };
}
export type Projector = ReturnType<typeof projector>;

/** Distance at which a front-on box (w x h world units) fills `fill` of the frame (the tighter of the two). */
export function fitDist(W: number, H: number, w: number, h: number, fill = 1, fov = HOUSE_FOV) {
  const tv = Math.tan((vfovOf(fov, W, H) * R) / 2), th = tv * (W / H);
  return Math.max(h / (2 * tv * fill), w / (2 * th * fill));
}
/** Visible height (world units) at distance d. */
export const viewHeight = (W: number, H: number, d: number, fov = HOUSE_FOV) => 2 * d * Math.tan((vfovOf(fov, W, H) * R) / 2);

/**
 * The house front framing: the phone `fill` of the frame width, its top edge `top` of the frame height below the
 * frame's top. Defaults: 16:9 the reference (dist 885, upper half of the phone, top edge at 0.11); 9:16 the whole
 * phone at 0.74 of the width with its top at 0.2 (room for a headline above).
 */
export function frontFraming(fmt: Pick<Format, "W" | "H" | "portrait">, fill?: number, top?: number, fov = HOUSE_FOV) {
  const f = fill ?? (fmt.portrait ? 0.74 : 0.668);
  const t = top ?? (fmt.portrait ? 0.2 : 0.11);
  const dist = fitDist(fmt.W, fmt.H, PHONE.outline.w, 0, f, fov);
  const hv = viewHeight(fmt.W, fmt.H, dist, fov);
  return { dist, aim: [0, PHONE.outline.h / 2 - (0.5 - t) * hv, 0] as V3, hv };
}

export type CamKey = FieldKey<Cam>;
/** Keyframed camera: each key sets any of yaw, elev, roll, dist, aim, fov, shift; per-field eases via `eases`. */
export const camTrack = (keys: CamKey[], base: Partial<Cam> = {}) => (frame: number): Cam => fields(frame, keys, cam(base));

/** A camera move: its keys and the camera at its end (feed `end` to the next move). */
export type CamMove = { keys: CamKey[]; end: Cam };
type CamEases = Ease | { [K in keyof Cam]?: Ease };

/** Move from `from` (held until `at`) to `to` over `dur` frames; only the fields in `to` are keyed. */
export function camMove(from: Cam, at: number, dur: number, to: Partial<Cam>, ease: CamEases = EASE.smooth): CamMove {
  const names = Object.keys(to) as (keyof Cam)[];
  const start = Object.fromEntries(names.map((k) => [k, from[k]])) as Partial<Cam>;
  const last: CamKey = typeof ease === "function" ? { f: at + dur, ...to, ease } : { f: at + dur, ...to, eases: ease };
  return { keys: [{ f: at, ...start }, last], end: { ...from, ...to } };
}

type Fmt = Pick<Format, "W" | "H" | "portrait">;
/** HOUSE.orbit presets: distance, aim inset from the button (pt, towards the phone's centre) and aim height (y,
 * phone-local; default the button's + 6) */
export const ORBIT: Record<"landscape" | "portrait", { dist: number; inset: number; y?: number }> = {
  landscape: { dist: 495, inset: 58 },
  portrait: { dist: 760, inset: 40, y: 330 },
};
/**
 * The reference's camera moves (videoclone.md 10.2) as chainable building blocks:
 *   const r = HOUSE.rise(fmt, 0), o = HOUSE.orbit(r.end, 45), b = HOUSE.back(o.end, 87, HOUSE.settled(r.end)),
 *         p = HOUSE.push(b.end, 120);
 *   const track = camTrack([...r.keys, ...o.keys, ...b.keys, ...p.keys]);
 */
export const HOUSE = {
  /** the front framing as a camera (see frontFraming); pose = the phone's pose if it is not at the origin */
  front: (fmt: Fmt, o: { fill?: number; top?: number; pose?: Pose } = {}): Cam => {
    const fr = frontFraming(fmt, o.fill, o.top);
    return cam({ dist: fr.dist, aim: localToWorld(o.pose ?? {}, fr.aim) });
  },
  /** the phone rises into the front framing from just below the frame: 42 frames, EASE.rise (sets every field) */
  rise: (fmt: Fmt, at = 0, o: { fill?: number; top?: number; pose?: Pose; rise?: number; dur?: number } = {}): CamMove => {
    const fr = frontFraming(fmt, o.fill, o.top), end = HOUSE.front(fmt, o);
    const rise = o.rise ?? PHONE.outline.h / 2 + fr.hv / 2 + 12 - fr.aim[1];
    const start: Cam = { ...end, aim: localToWorld(o.pose ?? {}, [fr.aim[0], fr.aim[1] + rise, fr.aim[2]]) };
    const m = camMove(start, at, o.dur ?? 42, { aim: end.aim }, { aim: EASE.rise });
    m.keys[0] = { f: at, ...start };
    return m;
  },
  /** orbit to a side button: yaw -52.6 (mirrored for the right side) in 36 frames, the aim sliding onto the button
   * (yaw EASE.orbitYaw, distance and aim EASE.orbitDist). Pass `fmt`: 16:9 = the reference (495 pt, the button
   * ends left of centre); 9:16 = ORBIT.portrait (760 pt, aimed up at y 330, so the island stays in frame too; the
   * 16:9 move shows only about 204 pt across a portrait frame). A lens shift in `from` is keyed back to 0. */
  orbit: (from: Cam, at: number, o: { button?: ButtonName; yaw?: number; dist?: number; pose?: Pose; dur?: number; fmt?: Fmt } = {}): CamMove => {
    const b = buttonLocal(o.button ?? "action", 0), pre = o.fmt?.portrait ? ORBIT.portrait : ORBIT.landscape;
    const aim = localToWorld(o.pose ?? {}, [b[0] - Math.sign(b[0]) * pre.inset, pre.y ?? b[1] + 6, b[2]]);
    const yaw = (o.yaw ?? -52.6) * (b[0] > 0 ? -1 : 1);
    const to: Partial<Cam> = { yaw, dist: o.dist ?? pre.dist, aim };
    if (from.shift[0] || from.shift[1]) to.shift = [0, 0];
    return camMove(from, at, o.dur ?? 36, to, { yaw: EASE.orbitYaw, dist: EASE.orbitDist, aim: EASE.orbitDist, shift: EASE.orbitDist });
  },
  /** where the return lands: the front framing 4.5 % closer and 10 pt lower */
  settled: (front: Cam): Cam => ({ ...front, dist: front.dist * 0.955, aim: [front.aim[0], front.aim[1] - 10, front.aim[2]] }),
  /** swing back face-on in 33 frames (EASE.returnYaw) while tilting up `tilt` deg by +38 (EASE.returnPitch);
   * the lens shift goes to `to`'s too */
  back: (from: Cam, at: number, to: Cam, o: { tilt?: number; dur?: number } = {}): CamMove => {
    const sh = to.shift[0] !== from.shift[0] || to.shift[1] !== from.shift[1] ? { shift: to.shift } : {};
    const m = camMove(from, at, o.dur ?? 33, { yaw: to.yaw, dist: to.dist, aim: to.aim, ...sh }, EASE.returnYaw);
    const t = camMove(m.end, at, 38, { elev: -(o.tilt ?? 6.4) }, { elev: EASE.returnPitch });
    return { keys: [...m.keys, ...t.keys], end: t.end };
  },
  /** slow linear push-in (the reference: 1.2 % of the distance over 65 frames) */
  push: (from: Cam, at: number, dur = 65, amount = 0.012): CamMove => camMove(from, at, dur, { dist: from.dist * (1 - amount) }, EASE.linear),
};

export type HouseOpts = {
  start?: number; fill?: number; top?: number; rise?: number;
  yaw?: number; closeDist?: number; button?: ButtonName; tilt?: number; push?: number; pose?: Pose;
};
/** The reference's whole camera (frames from `start`): rise 0-42, orbit 45-81, hold, return 87-120 with the tilt
 * to 125, push to 185. Returns keys: filter or extend them, or build your own sequence from HOUSE. */
export function houseKeys(fmt: Fmt, o: HouseOpts = {}): CamKey[] {
  const s = o.start ?? 0;
  const r = HOUSE.rise(fmt, s, o);
  const orb = HOUSE.orbit(r.end, s + 45, { button: o.button, yaw: o.yaw, dist: o.closeDist, pose: o.pose, fmt });
  const b = HOUSE.back(orb.end, s + 87, HOUSE.settled(r.end), { tilt: o.tilt });
  const p = HOUSE.push(b.end, s + 120, 65, o.push ?? 0.012);
  return [...r.keys, ...orb.keys, ...b.keys, ...p.keys];
}
export const houseTrack = (fmt: Fmt, o: HouseOpts = {}) => camTrack(houseKeys(fmt, o));

/**
 * "Phone on one side, headline on the other": the whole phone `fill` of the frame height (16:9, default 0.84),
 * its centre at `x` of the frame width (default 0.3 for side "left", 0.7 for "right") by a lens shift (the
 * perspective stays centred), `yaw` turning it towards the text. `text` = the headline's region on the other side
 * (inside fmt.safe), `phone` = the phone's front-view box (px). In 9:16 the phone sits low (frontFraming: fill
 * 0.74 of the width, top at `top` = 0.2) and `text` is the safe band above it.
 */
export function sideFraming(fmt: Fmt & Pick<Format, "safe">, side: "left" | "right" = "left", o: { fill?: number; x?: number; top?: number; yaw?: number; pose?: Pose } = {}) {
  const s = fmt.safe, gap = 0.04 * Math.min(fmt.W, fmt.H);
  if (fmt.portrait) {
    const fr = frontFraming(fmt, o.fill, o.top ?? 0.2);
    const pw = (o.fill ?? 0.74) * fmt.W, top = (o.top ?? 0.2) * fmt.H;
    const cam1 = cam({ dist: fr.dist, aim: localToWorld(o.pose ?? {}, fr.aim), yaw: o.yaw ?? 0 });
    return { cam: cam1, text: { x: s.x, y: s.y, w: s.w, h: Math.max(0, top - gap - s.y) }, phone: { x: (fmt.W - pw) / 2, y: top, w: pw, h: (pw * PHONE.outline.h) / PHONE.outline.w } };
  }
  const fill = o.fill ?? 0.84, x = o.x ?? (side === "left" ? 0.3 : 0.7);
  const dist = fitDist(fmt.W, fmt.H, PHONE.outline.w, PHONE.outline.h, fill);
  const ph = fill * fmt.H, pw = (ph * PHONE.outline.w) / PHONE.outline.h, cx = x * fmt.W;
  const c = cam({ dist, aim: localToWorld(o.pose ?? {}, [0, 0, 0]), yaw: o.yaw ?? 0, shift: [x - 0.5, 0] });
  const phone = { x: cx - pw / 2, y: (fmt.H - ph) / 2, w: pw, h: ph };
  const tx0 = side === "left" ? Math.max(s.x, phone.x + pw + gap) : s.x, tx1 = side === "left" ? s.x + s.w : Math.min(s.x + s.w, phone.x - gap);
  return { cam: c, text: { x: tx0, y: s.y, w: Math.max(0, tx1 - tx0), h: s.h }, phone };
}
