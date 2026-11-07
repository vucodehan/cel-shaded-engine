/**
 * The phone mesh: measured body with rounded rims, black bezel, a screen canvas and an island canvas (both in screen
 * points), side buttons (lit colour, press, eyes, glow) and a camera plateau on the back. Glass, bezel and lit
 * parts are flat colours (MeshBasic, as measured on the reference); metal and back use procedural matcaps, so a
 * finish looks the same whatever the renderer's colour management.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hexRgb, srgb, toLinear, toSrgb } from "./color";
import { ButtonName, PHONE, SCREEN_H, SCREEN_W, ScreenDraw, ScreenInfo } from "./geometry";

export type Finish = {
  /** metal frame and its rounded rims */ frame: string;
  /** back glass */ back: string;
  /** black border around the screen */ bezel: string;
  /** the screen when it is off (and outside its rounded corners) */ glass: string;
  button: string; lens: string;
  /** 0 = flat colours (the reference's look), 1 = strong glints on the rims */ gloss: number;
};

export const FINISHES = {
  /** the reference: black titanium, flat #141314-#191919 from the side */
  black: { frame: "#171617", back: "#1e1d1f", bezel: "#0b0a0b", glass: "#010101", button: "#151415", lens: "#232325", gloss: 0.4 },
  white: { frame: "#d9d7d2", back: "#efede8", bezel: "#0b0a0b", glass: "#010101", button: "#cfcdc7", lens: "#c7c4be", gloss: 0.5 },
  natural: { frame: "#b5aea3", back: "#c9c3b9", bezel: "#0b0a0b", glass: "#010101", button: "#aaa398", lens: "#a39d93", gloss: 0.55 },
  desert: { frame: "#c1a184", back: "#d6bda4", bezel: "#0b0a0b", glass: "#010101", button: "#b6987c", lens: "#b0957b", gloss: 0.5 },
  blue: { frame: "#3d4a5c", back: "#4b596c", bezel: "#0b0a0b", glass: "#010101", button: "#384455", lens: "#36414f", gloss: 0.5 },
  pink: { frame: "#e7bcc3", back: "#f2d2d7", bezel: "#0b0a0b", glass: "#010101", button: "#ddb1b8", lens: "#d9aeb4", gloss: 0.45 },
  midnight: { frame: "#252a3a", back: "#2f3547", bezel: "#0b0a0b", glass: "#010101", button: "#21263a", lens: "#20242f", gloss: 0.45 },
} satisfies Record<string, Finish>;
export type FinishName = keyof typeof FINISHES;
export const finishOf = (f?: FinishName | Finish): Finish => (typeof f === "string" ? FINISHES[f] : f ?? FINISHES.black);

/** Button states: `color` lights it (a flat colour, like the mascot that became it), press 0..1 pushes it in. */
/** axis "along" (default): two wide eyes stacked along the button (a lying stadium); "across": two tall eyes side by
 * side across it, low on the button (an upright mascot such as a flame or a drop). */
export type EyeState = { open?: number; look?: [number, number]; color?: string; axis?: "along" | "across" };
export type ButtonState = { color?: string; press?: number; eyes?: boolean | EyeState; glow?: number };

/** The island canvas covers the top of the screen: full width, this many points tall. */
export const ISLAND_AREA_H = 230;

const unit = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};
const dot3 = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const capCache = new Map<string, THREE.Texture>();
/** A studio matcap for a base colour: faces seen straight on show the colour exactly; rims darken towards the
 * bottom, catch a soft key from the upper left and a narrow glint (scaled by gloss). */
export function matcap(hex: string, gloss: number): THREE.Texture {
  const key = `${hex}|${gloss.toFixed(3)}`;
  const hit = capCache.get(key);
  if (hit) return hit;
  const N = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  const base = hexRgb(hex).map((v) => toLinear(v / 255));
  const L = unit(-0.5, 0.62, 0.6), F = unit(0.75, -0.05, 0.66), Hk = unit(L[0], L[1], L[2] + 1);
  const at = (n: number[]) => {
    const key = Math.max(0, dot3(n, L)), fill = Math.max(0, dot3(n, F)), h = Math.max(0, dot3(n, Hk));
    const dif = 0.6 + 0.3 * key + 0.12 * fill - 0.14 * Math.max(0, -n[1]);
    const spec = gloss * (0.85 * h ** 64 + 0.06 * h ** 6 + 0.16 * (1 - n[2]) ** 3);
    return { dif, spec };
  };
  const c0 = at([0, 0, 1]);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let nx = ((x + 0.5) / N) * 2 - 1, ny = 1 - ((y + 0.5) / N) * 2;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) {
        const l = Math.sqrt(r2);
        nx /= l;
        ny /= l;
      }
      const n = [nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))];
      const s = at(n);
      const k = s.dif / c0.dif, add = s.spec - c0.spec;
      const o = (y * N + x) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[o + ch] = Math.round(Math.min(1, Math.max(0, toSrgb(Math.max(0, base[ch] * k + add)))) * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  capCache.set(key, tex);
  return tex;
}

let glowTex: THREE.Texture | null = null;
const glowTexture = () => {
  if (glowTex) return glowTex;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, `rgba(255,255,255,${(1 - i / 8) ** 2.2})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
};

/** Rounded rectangle shape with circular corners (the measured silhouettes are circle fits). */
export const rrShape = (x0: number, y0: number, w: number, h: number, r: number, s = new THREE.Shape()) => {
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + h - r);
  s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y0 + h);
  s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, 1.5 * Math.PI, false);
  return s;
};

/** Extrusions come out faceted (non-indexed, flat normals): weld and recompute for smooth rims. */
const smooth = (g: THREE.BufferGeometry) => {
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const m = mergeVertices(g, 1e-3);
  m.computeVertexNormals();
  g.dispose();
  return m;
};

type Btn = {
  mesh: THREE.Mesh; eyes: THREE.Group; eyeL: THREE.Mesh; eyeR: THREE.Mesh; glow: THREE.Sprite;
  side: number; len: number; wid: number; lit: THREE.MeshBasicMaterial; eyeMat: THREE.MeshBasicMaterial;
};
type Mats = {
  bezel: THREE.MeshBasicMaterial; frame: THREE.MeshMatcapMaterial; button: THREE.MeshMatcapMaterial;
  back: THREE.MeshMatcapMaterial; lensRing: THREE.MeshMatcapMaterial; groove: THREE.MeshBasicMaterial;
  lensGlass: THREE.MeshBasicMaterial; lensDot: THREE.MeshBasicMaterial; flash: THREE.MeshBasicMaterial;
};

export class PhoneRig {
  readonly group = new THREE.Group();
  readonly screenCanvas: HTMLCanvasElement;
  readonly screenTex: THREE.CanvasTexture;
  readonly islandCanvas: HTMLCanvasElement;
  readonly islandTex: THREE.CanvasTexture;
  readonly sctx: CanvasRenderingContext2D;
  readonly ictx: CanvasRenderingContext2D;
  finish: Finish;
  private key = "";
  private mats: Mats;
  private btns = {} as Record<ButtonName, Btn>;
  private trash: { dispose(): void }[] = [];

  constructor(finish: Finish, readonly ppu = 4, readonly islandPpu = 6, aniso = 8) {
    this.finish = finish;
    const O = PHONE.outline, RIM = PHONE.rim, D = PHONE.depth, hw = O.w / 2, hh = O.h / 2;
    const backZ = PHONE.glassZ - D;
    const keep = <T extends { dispose(): void }>(x: T) => (this.trash.push(x), x);
    const basic = (hex: string) => keep(new THREE.MeshBasicMaterial({ color: srgb(hex), toneMapped: false }));
    this.mats = {
      bezel: basic(finish.bezel),
      frame: keep(new THREE.MeshMatcapMaterial()),
      button: keep(new THREE.MeshMatcapMaterial()),
      back: keep(new THREE.MeshMatcapMaterial()),
      lensRing: keep(new THREE.MeshMatcapMaterial()),
      groove: basic("#050505"),
      lensGlass: basic("#060608"),
      lensDot: basic("#1b1c26"),
      flash: basic("#e8e2d2"),
    };
    const add = (m: THREE.Object3D) => (this.group.add(m), m);
    const geo = <T extends THREE.BufferGeometry>(g: T) => keep(g);

    // body: the outline inset by the rim, extruded, the rim as a bevel; front cap = bezel, sides = frame
    const inner = rrShape(-hw + RIM, -hh + RIM, O.w - 2 * RIM, O.h - 2 * RIM, O.r - RIM);
    const body = new THREE.Mesh(
      geo(smooth(new THREE.ExtrudeGeometry(inner, { depth: D - 2 * RIM, bevelEnabled: true, bevelThickness: RIM, bevelSize: RIM, bevelSegments: 12, curveSegments: 40 }))),
      [this.mats.bezel, this.mats.frame],
    );
    body.position.z = PHONE.glassZ - (D - RIM);
    add(body);
    const back = new THREE.Mesh(geo(new THREE.ShapeGeometry(inner, 40)), this.mats.back);
    back.rotation.y = Math.PI;
    back.position.z = backZ - 0.02;
    add(back);

    // camera plateau (top corner behind the side button, as seen from the back: top-left)
    const P = 196, M = 16, pcx = hw - M - P / 2, pcy = hh - M - P / 2;
    const plate = new THREE.Mesh(
      geo(smooth(new THREE.ExtrudeGeometry(rrShape(-P / 2, -P / 2, P, P, 54), { depth: 1.2, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 4, curveSegments: 24 }))),
      this.mats.back,
    );
    plate.rotation.y = Math.PI;
    plate.position.set(pcx, pcy, backZ);
    add(plate);
    const plateZ = backZ - 2.4;
    const ringG = geo(new THREE.CylinderGeometry(1, 1, 3.2, 48));
    const discG = geo(new THREE.CircleGeometry(1, 48));
    const lens = (u: number, v: number, r: number) => {
      const x = pcx + P / 2 - u, y = pcy + P / 2 - v;
      const ring = new THREE.Mesh(ringG, this.mats.lensRing);
      ring.scale.set(r, 1, r);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, plateZ - 1.6);
      add(ring);
      const glass = new THREE.Mesh(discG, this.mats.lensGlass);
      glass.scale.setScalar(r * 0.74);
      glass.rotation.y = Math.PI;
      glass.position.set(x, y, plateZ - 3.25);
      add(glass);
      const d = new THREE.Mesh(discG, this.mats.lensDot);
      d.scale.setScalar(r * 0.24);
      d.rotation.y = Math.PI;
      d.position.set(x - r * 0.12, y + r * 0.12, plateZ - 3.3);
      add(d);
    };
    lens(54, 54, 38);
    lens(54, 142, 38);
    lens(142, 98, 38);
    const flash = new THREE.Mesh(discG, this.mats.flash);
    flash.scale.setScalar(10);
    flash.rotation.y = Math.PI;
    flash.position.set(pcx + P / 2 - 146, pcy + P / 2 - 34, plateZ - 0.05);
    add(flash);
    const mic = new THREE.Mesh(discG, this.mats.lensGlass);
    mic.scale.setScalar(6);
    mic.rotation.y = Math.PI;
    mic.position.set(pcx + P / 2 - 146, pcy + P / 2 - 162, plateZ - 0.05);
    add(mic);

    // side buttons: a dark recess ring and the button, extruded out of the side face
    const sideButton = (side: number, yC: number, len: number, wid: number, zC: number, lift: number, mat: THREE.Material) => {
      const g = geo(smooth(new THREE.ExtrudeGeometry(rrShape(-wid / 2, -len / 2, wid, len, wid / 2), { depth: lift, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 4, curveSegments: 24 })));
      const m = new THREE.Mesh(g, mat);
      m.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
      m.position.set(side * hw, yC, zC);
      return m;
    };
    const eyeG = new Map<string, THREE.ShapeGeometry>();
    for (const name of Object.keys(PHONE.buttons) as ButtonName[]) {
      const b = PHONE.buttons[name];
      const len = b.to - b.from, yC = hh - (b.from + b.to) / 2;
      add(sideButton(b.side, yC, len + 4.4, b.width + 4.4, b.z, 0.05, this.mats.groove));
      const mesh = add(sideButton(b.side, yC, len, b.width, b.z, 1.1, this.mats.button)) as THREE.Mesh;
      const eyeMat = basic("#ffffff");
      const ew = b.width * 0.3, eh = len * 0.07, gk = `${ew}|${eh}`;
      if (!eyeG.has(gk)) eyeG.set(gk, geo(new THREE.ShapeGeometry(rrShape(-ew / 2, -eh / 2, ew, eh, Math.min(ew, eh) / 2), 12)));
      const eyes = new THREE.Group();
      const eyeL = new THREE.Mesh(eyeG.get(gk)!, eyeMat), eyeR = new THREE.Mesh(eyeG.get(gk)!, eyeMat);
      eyes.add(eyeL, eyeR);
      eyes.rotation.y = mesh.rotation.y;
      eyes.position.set(b.side * (hw + 1.1 + 0.6 + 0.06), yC, b.z);
      eyes.visible = false;
      add(eyes);
      const glow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, toneMapped: false })));
      glow.scale.set(len * 3.4, len * 3.4, 1);
      glow.position.set(b.side * (hw + 7), yC, b.z);
      glow.visible = false;
      add(glow);
      this.btns[name] = { mesh, eyes, eyeL, eyeR, glow, side: b.side, len, wid: b.width, lit: basic("#ffffff"), eyeMat };
    }

    // screen (opaque, rounded corners drawn in) and island layer (transparent), both in screen points
    this.screenCanvas = document.createElement("canvas");
    this.screenCanvas.width = Math.round(SCREEN_W * ppu);
    this.screenCanvas.height = Math.round(SCREEN_H * ppu);
    this.sctx = this.screenCanvas.getContext("2d")!;
    this.screenTex = keep(new THREE.CanvasTexture(this.screenCanvas));
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = aniso;
    // the screen mesh has the screen's rounded corners: a full rectangle pokes its corners out past the outline
    const screenG = geo(new THREE.ShapeGeometry(rrShape(-SCREEN_W / 2, -SCREEN_H / 2, SCREEN_W, SCREEN_H, PHONE.screen.r), 24));
    const sp = screenG.attributes.position, suv = screenG.attributes.uv;
    for (let i = 0; i < sp.count; i++) suv.setXY(i, sp.getX(i) / SCREEN_W + 0.5, sp.getY(i) / SCREEN_H + 0.5);
    suv.needsUpdate = true;
    const screen = new THREE.Mesh(screenG, keep(new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false })));
    screen.renderOrder = 1;
    add(screen);
    this.islandCanvas = document.createElement("canvas");
    this.islandCanvas.width = Math.round(SCREEN_W * islandPpu);
    this.islandCanvas.height = Math.round(ISLAND_AREA_H * islandPpu);
    this.ictx = this.islandCanvas.getContext("2d")!;
    this.islandTex = keep(new THREE.CanvasTexture(this.islandCanvas));
    this.islandTex.colorSpace = THREE.SRGBColorSpace;
    this.islandTex.anisotropy = aniso;
    const island = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(SCREEN_W, ISLAND_AREA_H)),
      keep(new THREE.MeshBasicMaterial({ map: this.islandTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 })),
    );
    island.position.set(0, SCREEN_H / 2 - ISLAND_AREA_H / 2, 0.08);
    island.renderOrder = 2;
    add(island);
    this.setFinish(finish);
  }

  setFinish(f: Finish) {
    const key = `${f.frame}${f.back}${f.bezel}${f.glass}${f.button}${f.lens}${f.gloss}`;
    if (key === this.key) return;
    this.key = key;
    this.finish = f;
    this.mats.bezel.color.copy(srgb(f.bezel));
    this.mats.frame.matcap = matcap(f.frame, f.gloss);
    this.mats.button.matcap = matcap(f.button, f.gloss);
    this.mats.back.matcap = matcap(f.back, f.gloss * 0.35);
    this.mats.lensRing.matcap = matcap(f.lens, Math.max(0.5, f.gloss));
    for (const m of [this.mats.frame, this.mats.button, this.mats.back, this.mats.lensRing]) m.needsUpdate = true;
  }

  setButton(name: ButtonName, st?: ButtonState) {
    const B = this.btns[name];
    const lit = !!st?.color;
    if (lit) B.lit.color.copy(srgb(st!.color!));
    B.mesh.material = lit ? B.lit : this.mats.button;
    const press = Math.max(0, Math.min(1, st?.press ?? 0));
    B.mesh.position.x = B.side * (PHONE.outline.w / 2 - press * 1.0);
    const e = st?.eyes;
    B.eyes.visible = !!e;
    if (e) {
      const es: EyeState = e === true ? {} : e;
      B.eyeMat.color.copy(srgb(es.color ?? "#ffffff"));
      const open = Math.max(0.08, Math.min(1, es.open ?? 1));
      const [lx, ly] = es.look ?? [0, 0];
      if (es.axis === "across") {
        for (const [m, k] of [[B.eyeL, -1], [B.eyeR, 1]] as const) {
          m.scale.set(0.56, 1.8 * open, 1);
          m.position.set(k * B.wid * 0.2 + lx * B.wid * 0.08, -B.len * 0.1 + ly * B.len * 0.04, 0);
        }
      } else {
        const along = lx * B.len * 0.045, across = ly * B.wid * 0.12;
        for (const [m, k] of [[B.eyeL, -1], [B.eyeR, 1]] as const) {
          m.scale.set(open, 1, 1);
          m.position.set(across, k * B.len * 0.1 + along, 0);
        }
      }
      B.eyes.position.x = B.side * (PHONE.outline.w / 2 + 1.76 - press);
    }
    const glow = lit ? st?.glow ?? 0 : 0;
    B.glow.visible = glow > 0.003;
    if (B.glow.visible) {
      const gm = B.glow.material as THREE.SpriteMaterial;
      gm.color.copy(srgb(st!.color!));
      gm.opacity = Math.min(1, glow);
    }
  }

  /** Redraw the screen canvas: glass colour, then `draw` in screen points, clipped to the screen's corners. */
  drawScreen(draw: ScreenDraw | undefined, info: ScreenInfo) {
    const c = this.screenCanvas, ctx = this.sctx;
    resetCtx(ctx);
    ctx.fillStyle = this.finish.glass;
    ctx.fillRect(0, 0, c.width, c.height);
    if (draw) {
      ctx.setTransform(c.width / SCREEN_W, 0, 0, c.height / SCREEN_H, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, SCREEN_W, SCREEN_H, PHONE.screen.r);
      ctx.clip();
      draw(ctx, info);
      ctx.restore();
    }
    this.screenTex.needsUpdate = true;
  }

  /** Redraw the island layer (transparent; the top ISLAND_AREA_H points of the screen, same coordinates). */
  drawIsland(draw: ScreenDraw | null, info: ScreenInfo) {
    const c = this.islandCanvas, ctx = this.ictx;
    resetCtx(ctx);
    ctx.clearRect(0, 0, c.width, c.height);
    if (draw) {
      const k = c.width / SCREEN_W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.save();
      draw(ctx, info);
      ctx.restore();
    }
    this.islandTex.needsUpdate = true;
  }

  dispose() {
    for (const t of this.trash) t.dispose();
    this.trash = [];
  }
}

const resetCtx = (ctx: CanvasRenderingContext2D) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.letterSpacing = "0px";
};
