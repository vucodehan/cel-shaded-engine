/**
 * Authoring layer for cel scenes: lighting presets, the shot() wrapper, timelines, and film sets.
 *
 *   const A = shot("golden", (k) => {             // build once
 *     const set = galilee(k);                       // land, sky, trees
 *     const j = k.add(new Human(CAST.JESUS)).place(0, 0, 0, set.h(0, 0));
 *     return (f) => {                               // every frame (shot-local f)
 *       const fs = stepped(f);                      // characters on twos
 *       j.pose(walkPose(fs / 30));
 *       k.cam({ target: j.point("head"), size: "CU", yaw: 20, lens: 85, sx: k.p(0.25, 0), sy: 0.1 });
 *     };
 *   }, { post: (f) => ({ dof: 0.8, focus: 2 }) });
 *
 * Scenes then lay shots on the narration: <Cuts shots={timeline(dur, [[0, A], [g[1] - 10, B]])} />.
 */
import * as THREE from "three";
import { Post, ShadowBox } from "../cel/engine";
import { Env, ShotCtx, ShotDef, ShotState, newScene, setEnv } from "../cel/Shot";
import { Frame, applyCam, frameCam } from "../cel/cam";
import { V3, fbm, lerp, noise2, sstep } from "../cel/geo";
import { SkyOpts, cloud, galileeHeight, grass, hillRing, oliveTree, rockMesh, sky, terrain } from "../cel/world";
import { house, palm, room, stars, village, waterPlane } from "../cel/sets";
import { workbench, plank, hammer, saw, chisel, shavings } from "../cel/props";
import { beam, glow, motes } from "../cel/fx";
import { Human, Pose, WALK_STRIDE, angleDelta, turnFrames, turnOnSpot, walkPose } from "../cel/human";

export type Preset = { env: Env; sky: SkyOpts | null; post: Partial<Post>; stars?: boolean; moon?: THREE.Vector3 };

const C = (h: string) => new THREE.Color(h);

export const PRESETS: Record<string, Preset> = {
  dawn: {
    env: { light: V3(-0.75, 0.32, 0.55), lightCol: "#fff1e0", shadowTint: "#7a6aa6", rim: V3(0.6, 0.25, -0.75), rimCol: "#ffd8a8", rimAmt: 0.75, fogCol: "#ecc9b2", fogNear: 30, fogFar: 700, fogAmt: 0.8 },
    sky: { zenith: "#6a8cc6", horizon: "#f7caa2", low: "#e2b298", sun: V3(-0.65, 0.1, -0.75), sunCol: "#ffcf96", glow: 0.55, streaks: 0.55, streakCol: "#ffe6d2" },
    post: { paraTop: C("#ffe2c2"), paraBot: C("#b9a8dc"), paraAmt: 0.2, rays: 0.18, sunDir: V3(-0.65, 0.1, -0.75), bloom: 0.32 },
  },
  day: {
    env: { light: V3(0.45, 0.8, 0.4), lightCol: "#ffffff", shadowTint: "#7c78b0", rim: V3(-0.5, 0.4, -0.75), rimCol: "#fff6e2", rimAmt: 0.45, fogCol: "#d3e2ee", fogNear: 50, fogFar: 900, fogAmt: 0.7 },
    sky: { zenith: "#3f7fcf", horizon: "#cfe4f0", low: "#bfd3df", sun: V3(0.4, 0.75, 0.3), sunCol: "#fff6dc", glow: 0.35, streaks: 0.45 },
    post: { paraTop: C("#eaf2ff"), paraBot: C("#fff1d8"), paraAmt: 0.12, bloom: 0.2, bloomT: 0.96 },
  },
  golden: {
    env: { light: V3(-0.7, 0.36, 0.6), lightCol: "#ffeacc", shadowTint: "#76669e", rim: V3(0.55, 0.3, -0.78), rimCol: "#ffd28c", rimAmt: 0.9, fogCol: "#f1d4ac", fogNear: 35, fogFar: 800, fogAmt: 0.8 },
    sky: { zenith: "#5679bd", horizon: "#f7d49c", low: "#e8c08e", sun: V3(0.62, 0.16, -0.76), sunCol: "#ffcc80", glow: 0.6, streaks: 0.5, streakCol: "#fff0d6" },
    post: { paraTop: C("#ffe2b4"), paraBot: C("#c4abd8"), paraAmt: 0.22, rays: 0.2, sunDir: V3(0.62, 0.16, -0.76), bloom: 0.34 },
  },
  dusk: {
    env: { light: V3(0.8, 0.2, -0.3), lightCol: "#ffc8a0", shadowTint: "#5e5294", rim: V3(0.75, 0.15, -0.6), rimCol: "#ffb07a", rimAmt: 1, shadeK: "#b8a0bc", fogCol: "#c98f8e", fogNear: 25, fogFar: 600, fogAmt: 0.85 },
    sky: { zenith: "#2e3b78", horizon: "#f49a6c", low: "#8a5a72", sun: V3(0.75, 0.04, -0.66), sunCol: "#ff9a5c", glow: 0.7, streaks: 0.6, streakCol: "#ffb890" },
    post: { paraTop: C("#ffb48c"), paraBot: C("#6a5aa8"), paraAmt: 0.28, rays: 0.22, sunDir: V3(0.75, 0.04, -0.66), bloom: 0.4, raysCol: C("#ffb070") },
  },
  night: {
    env: { light: V3(0.45, 0.62, -0.5), lightCol: "#7f90c4", shadowTint: "#33406f", rim: V3(-0.4, 0.5, -0.75), rimCol: "#cfe0ff", rimAmt: 0.9, shadeK: "#4a5688", fogCol: "#1b2645", fogNear: 20, fogFar: 500, fogAmt: 0.85 },
    sky: { zenith: "#070d24", horizon: "#22355c", low: "#141d36", sun: V3(0.45, 0.62, -0.5), sunCol: "#cfdcff", glow: 0.25, sunSize: 0.0001 },
    post: { paraTop: C("#8ea6ea"), paraBot: C("#2a3666"), paraAmt: 0.3, bloom: 0.45, bloomT: 0.85, exposure: 0.92, saturation: 0.95 },
    stars: true, moon: V3(0.45, 0.55, -0.7),
  },
  predawn: {
    env: { light: V3(-0.6, 0.3, -0.6), lightCol: "#c8c8e8", shadowTint: "#43497e", rim: V3(-0.7, 0.2, -0.7), rimCol: "#ffc9a8", rimAmt: 0.8, shadeK: "#8287b6", fogCol: "#5a5f8c", fogNear: 25, fogFar: 600, fogAmt: 0.8 },
    sky: { zenith: "#121c44", horizon: "#e09a86", low: "#4a4a74", sun: V3(-0.7, 0.02, -0.7), sunCol: "#ffb08a", glow: 0.45, sunSize: 0.0001 },
    post: { paraTop: C("#9aa6e6"), paraBot: C("#e6a890"), paraAmt: 0.2, bloom: 0.4 },
    stars: true,
  },
  interior: {
    env: { light: V3(0.65, 0.55, 0.5), lightCol: "#ffe6c4", shadowTint: "#6a587e", rim: V3(-0.6, 0.35, -0.6), rimCol: "#ffd9a6", rimAmt: 0.55, fogAmt: 0, shadeK: "#d6c6d2" },
    sky: null,
    post: { bloom: 0.3, bloomT: 0.9, paraTop: C("#ffe4c0"), paraBot: C("#7e6a9a"), paraAmt: 0.2, vignette: 0.5 },
  },
  lamplight: {
    env: { light: V3(0.5, 0.45, 0.7), lightCol: "#eaae70", shadowTint: "#4a3a62", rim: V3(-0.6, 0.3, -0.6), rimCol: "#ffb870", rimAmt: 0.7, fogAmt: 0, shadeK: "#6e5674" },
    sky: null,
    post: { bloom: 0.38, bloomT: 0.86, paraTop: C("#ffbf80"), paraBot: C("#3a2a52"), paraAmt: 0.3, vignette: 0.65, saturation: 1.02 },
  },
  desert: {
    env: { light: V3(0.35, 0.82, 0.3), lightCol: "#fff4e2", shadowTint: "#8a6aa0", rim: V3(-0.6, 0.3, -0.7), rimCol: "#fff0cc", rimAmt: 0.6, fogCol: "#efd8b2", fogNear: 40, fogFar: 900, fogAmt: 0.85 },
    sky: { zenith: "#5b8bcc", horizon: "#f2dcb0", low: "#e6c690", sun: V3(0.35, 0.82, 0.3), sunCol: "#fff2cc", glow: 0.5, streaks: 0.2 },
    post: { paraTop: C("#fff2d6"), paraBot: C("#e2b98c"), paraAmt: 0.2, bloom: 0.3, saturation: 1.0 },
  },
  storm: {
    env: { light: V3(0.2, 0.7, -0.6), lightCol: "#c4b8c8", shadowTint: "#3e3654", rim: V3(0.3, 0.5, -0.8), rimCol: "#e8c8b8", rimAmt: 0.6, shadeK: "#8a8098", fogCol: "#5a4a5a", fogNear: 20, fogFar: 500, fogAmt: 0.85 },
    sky: { zenith: "#2a2234", horizon: "#7a5a5a", low: "#3a2e38", sun: V3(0.2, 0.3, -0.9), sunCol: "#c88a6a", glow: 0.3, streaks: 0.7, streakCol: "#4a3a48" },
    post: { paraTop: C("#8a7a9a"), paraBot: C("#3a2a3a"), paraAmt: 0.3, bloom: 0.35, saturation: 0.85, contrast: 1.1 },
  },
};

export type Kit = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ctx: ShotCtx;
  p: ShotCtx["p"];
  portrait: boolean;
  preset: Preset;
  add: <T extends THREE.Object3D | Human>(o: T) => T;
  /** frame the camera with the shot grammar (cam.ts) */
  cam: (fr: Frame, shake?: number, f?: number) => void;
  /** override env per frame (e.g. a light that moves) */
  env: (e: Partial<Env>) => void;
  /**
   * Key light placed relative to the camera (call after cam): az degrees toward camera-left (+) or right (-),
   * el elevation. 35-50 = classic three-quarter anime key; 120-160 = rim-dominant backlight. Rim goes opposite.
   */
  key: (az?: number, el?: number, extra?: Partial<Env>) => void;
  /** Place the camera directly: position, look-at point, lens (mm on a 24 mm short side). For landscapes. */
  camAt: (pos: THREE.Vector3, look: THREE.Vector3, lens?: number, roll?: number) => void;
  /** Add a camera-facing glow (lamps, light from the tomb); faces the camera every frame. */
  glow: (pos: THREE.Vector3, size: number, o?: { color?: string; opacity?: number; core?: number }) => ReturnType<typeof glow>;
  /** objects whose face(camera) should be called each frame (glows, flames) */
  faces: { face?: (c: THREE.Camera) => void; update?: (f: number, c: THREE.Camera) => void }[];
};

/** Build a shot from a preset and a builder returning the per-frame update. */
export function shot(preset: keyof typeof PRESETS | Preset, build: (k: Kit) => (f: number) => void, o: { post?: (f: number) => Partial<Post>; shadow?: ShadowBox | ((f: number) => ShadowBox | null) | null } = {}): ShotDef {
  return (ctx): ShotState => {
    const { scene, camera } = newScene();
    const pr = typeof preset === "string" ? PRESETS[preset] : preset;
    let envOver: Partial<Env> = {};
    const k: Kit = {
      scene, camera, ctx, p: ctx.p, portrait: ctx.portrait, preset: pr, faces: [],
      add: (obj) => {
        scene.add(obj instanceof Human ? obj.root : obj);
        return obj;
      },
      cam: (fr, shake = 0, f = 0) => applyCam(camera, frameCam(fr, ctx.aspect), ctx.aspect, shake, f),
      env: (e) => (envOver = { ...envOver, ...e }),
      key: (az = 40, el = 28, extra = {}) => {
        const fwd = camera.getWorldDirection(V3());
        const back = V3(-fwd.x, 0, -fwd.z).normalize();
        const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
        const hz = V3(back.x * Math.cos(a) - back.z * Math.sin(a), 0, back.x * Math.sin(a) + back.z * Math.cos(a));
        const light = hz.clone().multiplyScalar(Math.cos(e)).add(V3(0, Math.sin(e), 0)).normalize();
        const rim = V3(-hz.x, 0.35, -hz.z).normalize().lerp(V3(fwd.x, 0.3, fwd.z).normalize(), 0.5).normalize();
        envOver = { ...envOver, light, rim, ...extra };
      },
      camAt: (pos, look, lens = 50, roll = 0) => {
        const fovShort = 2 * Math.atan(12 / lens);
        const fovV = ctx.aspect >= 1 ? fovShort : 2 * Math.atan(Math.tan(fovShort / 2) / ctx.aspect);
        applyCam(camera, { pos, look, fov: (fovV * 180) / Math.PI, roll }, ctx.aspect);
      },
      glow: (pos, size, go = {}) => {
        const g = glow(pos, size, go);
        scene.add(g.obj);
        k.faces.push(g);
        return g;
      },
    };
    if (pr.sky) scene.add(sky(pr.sky));
    if (pr.stars) scene.add(stars({ moon: pr.moon ?? null }));
    const upd = build(k);
    return {
      scene, camera,
      update: (f) => {
        envOver = {};
        setEnv(pr.env);
        upd(f);
        if (Object.keys(envOver).length) setEnv({ ...pr.env, ...envOver });
        const sx = scene.getObjectByName("skyExtras");
        if (sx) sx.position.copy(camera.position);
        k.faces.forEach((x) => (x.update ? x.update(f, camera) : x.face?.(camera)));
      },
      post: (f) => ({ ...pr.post, ...(o.post ? o.post(f) : {}) }),
      shadow: o.shadow ?? null,
    };
  };
}

/** Lay shots end to end from start frames: [[startFrame, def], ...] -> [[duration, def], ...]. */
export function timeline(dur: number, cuts: [number, ShotDef][]): [number, ShotDef][] {
  const s = cuts.slice().sort((a, b) => a[0] - b[0]);
  s[0] = [0, s[0][1]];
  return s.map(([at, def], i) => [Math.max(1, (i + 1 < s.length ? s[i + 1][0] : dur) - at), def]);
}

/**
 * Walk a figure from a to b (ground x,z) at speed m/s starting at frame f0; returns progress 0..1.
 * `fromYaw`: the facing before the walk: the figure turns into the walk direction (turnOnSpot) before stepping off,
 * instead of snapping. `toYaw`: the facing to settle into on arrival (turnOnSpot after the last step).
 */
export function walkTo(j: Human, f: number, a: [number, number], b: [number, number], o: { speed?: number; f0?: number; h?: (x: number, z: number) => number; stride?: number; step?: number; base?: Pose; fromYaw?: number; toYaw?: number } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sp = o.speed ?? 1.05;
  const path = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  const turnIn = o.fromYaw === undefined ? 0 : turnFrames(angleDelta(o.fromYaw, path));
  const tf = f - (o.f0 ?? 0);
  if (o.fromYaw !== undefined && tf < turnIn) {
    const tr = turnOnSpot(o.fromYaw, path, Math.max(0, tf) / turnIn, o.base ?? {});
    j.place(a[0], a[1], tr.yaw, o.h ? o.h(a[0], a[1]) : 0);
    j.pose(tr.pose);
    return 0;
  }
  const t = Math.max(0, (tf - turnIn) / 30);
  const d = Math.min(len, t * sp);
  const k = len > 0 ? d / len : 1;
  const x = lerp(a[0], b[0], k), z = lerp(a[1], b[1], k);
  const y = o.h ? o.h(x, z) : 0;
  if (k >= 1 && o.toYaw !== undefined) {
    const arrive = turnIn + (len / sp) * 30;
    const tr = turnOnSpot(path, o.toYaw, (tf - arrive) / turnFrames(angleDelta(path, o.toYaw)), o.base ?? {});
    j.place(x, z, tr.yaw, y);
    j.pose(tr.pose);
    return 1;
  }
  j.place(x, z, path, y);
  const moving = k < 1 ? 1 : 0;
  // step < 1 shortens swing and stride together (side close-ups of robed feet: 0.55 keeps the ankles under the hem)
  const step = o.step ?? 1;
  j.pose(walkPose(d / ((o.stride ?? WALK_STRIDE) * step), moving * step, o.base ?? {}));
  return k;
}

// ---- sets for this film ---------------------------------------------------------------------------------

const GRASS = C("#a6b46a"), DRY = C("#c9b47a"), PATH = C("#d8c49a");

/** Galilean hillside: rolling land, far hills, clouds, olive trees, rocks, grass; optional sea and a path. */
export function galilee(k: Kit, o: { seed?: number; flat?: [number, number, number]; sea?: boolean; seaZ?: number; trees?: [number, number, number][]; grass?: number; path?: (x: number) => number; clouds?: boolean; hills?: boolean; zero?: boolean } = {}) {
  const seed = o.seed ?? 2;
  const raw = galileeHeight(seed, o.flat ?? [0, 0, 6]);
  const z0 = o.zero ? raw((o.flat ?? [0, 0])[0], (o.flat ?? [0, 0])[1]) : 0;
  const base = (x: number, z: number) => raw(x, z) - z0;
  const seaZ = o.seaZ ?? -90;
  const h = o.sea ? (x: number, z: number) => lerp(base(x, z), -6, sstep(seaZ + 25, seaZ - 5, z)) : base;
  const onPath = (x: number, z: number) => (o.path ? Math.abs(z - o.path(x)) < 1.1 + noise2(x * 0.3, 1) * 0.3 : false);
  k.add(terrain({
    size: 700, res: 280, h,
    color: (x, z, y) => {
      const c = GRASS.clone().lerp(DRY, Math.min(1, Math.max(0, (y - 1) * 0.1 + 0.3 + fbm(x * 0.05, z * 0.05, 2) * 0.6)));
      if (onPath(x, z)) c.lerp(PATH, 0.85);
      if (o.sea && z < seaZ + 8) c.lerp(C("#cdb88e"), sstep(seaZ + 8, seaZ + 2, z));
      return c;
    },
  }));
  if (o.hills !== false) {
    k.add(hillRing({ r: 900, h: 90, color: "#8ea2c6", shade: "#7d8cb6", seed: seed + 1, peaks: 3 }));
    k.add(hillRing({ r: 520, h: 40, color: "#9fae80", shade: "#7e8ea8", seed: seed + 7, peaks: 5 }));
  }
  if (o.sea) k.add(waterPlane({ y: -1.2, cz: seaZ - 1400, size: 2800 }));
  if (o.clouds !== false) {
    k.add(cloud({ x: -300, y: 170, z: -800, w: 380, h: 70, seed: 4 }));
    k.add(cloud({ x: 260, y: 210, z: -900, w: 320, h: 60, seed: 8 }));
    k.add(cloud({ x: 40, y: 260, z: -1100, w: 480, h: 95, seed: 12 }));
  }
  const trees = o.trees ?? [[-8, -12, 1.1], [9, -16, 1.3], [-16, -26, 1.2], [18, -34, 1.4], [4, -46, 1.2], [-28, -10, 1.3]];
  trees.forEach(([x, z, s], i) => k.add(oliveTree({ x, z, y: h(x, z) - 0.05, s, seed: i + seed * 3 })));
  if ((o.grass ?? 2500) > 0) k.add(grass({ n: o.grass ?? 2500, area: [-16, -16, 16, 12], h, seed, size: 0.38, keep: (x, z) => !onPath(x, z) }));
  return { h };
}

/** Sea-of-Galilee shore with boats-free water, pebbles and a few palms. */
export function shore(k: Kit, o: { seed?: number; waterZ?: number } = {}) {
  const wz = o.waterZ ?? -6;
  const h = (x: number, z: number) => lerp(fbm(x * 0.02 + 3, z * 0.02, 3) * 4 + Math.max(0, z) * 0.06, -1.2, sstep(wz + 3, wz - 4, z));
  k.add(terrain({ size: 600, res: 240, h, color: (x, z) => C("#cdb88e").lerp(C("#a6b46a"), sstep(wz + 6, wz + 20, z)) }));
  k.add(waterPlane({ y: -0.35, cz: wz - 1400, size: 2800 }));
  k.add(hillRing({ r: 1400, h: 110, color: "#9aa8c8", shade: "#8592b8", seed: 5 }));
  [[-14, 8], [12, 14], [-26, 18]].forEach(([x, z], i) => k.add(palm({ x, z, y: h(x, z), seed: i + 3 })));
  return { h };
}

/** Nazareth: hillside village of flat-roofed houses around a lane. */
export function nazareth(k: Kit, o: { seed?: number; lane?: (x: number) => number } = {}) {
  const seed = o.seed ?? 6;
  const lane = o.lane ?? ((x: number) => x * 0.15);
  const set = galilee(k, { seed, flat: [0, 0, 14], grass: 1500, path: lane, trees: [[-14, -20, 1.2], [16, -28, 1.3], [26, 6, 1.1]] });
  k.add(village({ n: 26, area: [-60, -90, 60, -10], h: set.h, seed, clear: (x, z) => Math.abs(z - lane(x)) > 6 }));
  k.add(village({ n: 8, area: [-30, 6, 30, 30], h: set.h, seed: seed + 3, clear: (x, z) => Math.abs(z - lane(x)) > 5 && Math.hypot(x, z) > 12 }));
  return set;
}

/** Carpenter's workshop interior: bench, planks, tools, shavings, a sunlit door, dust in the light. */
export function workshop(k: Kit) {
  const r = room({ w: 7, d: 6, h: 3.2, wall: "#d6bf98", floor: "#9c7e5e", omit: ["front"], beams: true, door: [1.6, 1.3], window: [1.8, 2.0, 0.9, 0.7] });
  k.add(r);
  const bench = workbench();
  bench.position.set(0, 0, -0.4);
  k.add(bench);
  const pl = plank(1.7, 0.24, 0.045);
  pl.position.set(0.1, 0.9, -0.35);
  pl.rotation.y = 0.05;
  k.add(pl);
  const sh = shavings(26, 0.9, 4);
  sh.position.set(0.3, 0.86, -0.3);
  k.add(sh);
  const sh2 = shavings(30, 1.6, 9);
  sh2.position.set(0.4, 0.0, 0.3);
  k.add(sh2);
  for (let i = 0; i < 5; i++) {
    const p = plank(2.4, 0.2, 0.04, ["#a07a52", "#8f6a46", "#b08860"][i % 3]);
    p.rotation.z = Math.PI / 2 - 0.18;
    p.position.set(-3.1 + i * 0.12, 1.15, -2.7 + i * 0.05);
    k.add(p);
  }
  const hm = hammer(); hm.rotation.z = Math.PI / 2; hm.position.set(-0.6, 0.92, -0.15); k.add(hm);
  const sw = saw(); sw.rotation.x = -Math.PI / 2; sw.position.set(0.7, 0.91, -0.6); k.add(sw);
  const ch = chisel(); ch.rotation.z = Math.PI / 2; ch.position.set(-0.3, 0.92, -0.62); k.add(ch);
  // sunlight from the window (back wall, upper right) and the door (left)
  const b1 = beam(V3(1.8, 2.2, -3.0), V3(0.6, 0.0, 0.2), { r0: 0.35, r1: 0.9, color: "#ffe8b8", opacity: 0.32 });
  k.add(b1.obj);
  const b2 = beam(V3(-3.5, 1.5, 1.3), V3(-1.2, 0.0, 1.0), { r0: 0.7, r1: 1.1, color: "#ffe2b0", opacity: 0.2 });
  k.add(b2.obj);
  const m = motes(new THREE.Box3(V3(-1.5, 0.2, -2), V3(2, 2.6, 1)), { n: 160 });
  k.add(m.obj);
  k.faces.push({ update: (f) => m.update(Math.floor(f / 2) * (2 / 30)) });
  return { bench, motes: m };
}

export const flatH = (_x: number, _z: number) => 0;
export { house };
