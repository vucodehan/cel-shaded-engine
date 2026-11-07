/**
 * <PhoneStage>: one or more phones rendered with three.js inside Remotion (the reference's PhoneScene pattern).
 * One WebGL renderer per browser tab, 2x supersampled and drawn down into the stage's own 2D canvas, NoToneMapping,
 * sRGB output, a transparent clear (put a <Background> behind it, or pass `background`), delayRender per frame.
 * Each phone's screen and island are redrawn every frame by your callbacks, in screen points.
 */
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { applyCam, Cam, projector, Projector } from "./camera";
import { rgba } from "./color";
import { useFonts } from "./fonts";
import { ButtonName, outlinePoints, PHONE, Pose, SCREEN_H, SCREEN_W, ScreenDraw, ScreenInfo } from "./geometry";
import { restIsland } from "./island";
import { ButtonState, Finish, FinishName, finishOf, PhoneRig } from "./phone3d";

export type PhoneSpec = Pose & {
  finish?: FinishName | Finish;
  /** the screen, redrawn every frame (default: the glass colour, i.e. screen off) */
  screen?: ScreenDraw;
  /** the island layer (default: the resting pill; false: nothing) */
  island?: ScreenDraw | false;
  buttons?: Partial<Record<ButtonName, ButtonState>>;
  visible?: boolean;
  /** canvas pixels per point: screen (default 4) and island layer (default 6, for close-ups) */
  ppu?: number;
  islandPpu?: number;
};
/** A soft shadow around the phone's silhouette on the background (pt, scaled with the phone). */
export type Halo = { opacity?: number; blur?: number; y?: number; grow?: number; color?: string };
/** A soft ellipse under the phone's bottom edge, as if it stood on a floor. */
export type ContactShadow = { opacity?: number; blur?: number; width?: number; y?: number; color?: string };

export type PhoneStageProps = {
  camera: Cam;
  phones: PhoneSpec[];
  halo?: boolean | Halo;
  shadow?: boolean | ContactShadow;
  /** fill behind the phones (default transparent) */
  background?: string;
  /** supersampling factor (default 2) */
  ss?: number;
  /** frame passed to the callbacks (default: useCurrentFrame()) */
  frame?: number;
  /** overlays BEHIND the phones (image px; the stage canvas is transparent, so the phones and their halo cover
   * them): the far half of an orbit, labels passing behind. Split by depth with phoneDepth / splitByDepth. */
  behind?: React.ReactNode;
  style?: React.CSSProperties;
};

export const HALO: Required<Halo> = { opacity: 0.11, blur: 24, y: 14, grow: 0, color: "#000000" };
export const CONTACT: Required<ContactShadow> = { opacity: 0.22, blur: 14, width: 0.9, y: 10, color: "#000000" };
const BUTTONS = Object.keys(PHONE.buttons) as ButtonName[];
const D2R = Math.PI / 180;

let shared: { renderer: THREE.WebGLRenderer; w: number; h: number } | null = null;
function rendererFor(w: number, h: number) {
  if (!shared) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    shared = { renderer, w: 0, h: 0 };
  }
  if (shared.w !== w || shared.h !== h) {
    shared.renderer.setSize(w, h, false);
    shared.w = w;
    shared.h = h;
  }
  return shared.renderer;
}

const silhouette = (c: CanvasRenderingContext2D, P: Projector, pose: Pose, grow: number) => {
  for (const z of [PHONE.glassZ, PHONE.glassZ - PHONE.depth]) {
    const pts = outlinePoints(z, grow).map((p) => P.local(pose, p));
    if (pts.some((p) => !p.front)) return false;
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
  }
  return true;
};

function drawHalo(c: CanvasRenderingContext2D, P: Projector, spec: PhoneSpec, h: Required<Halo>) {
  const k = P.local(spec, [0, 0, -PHONE.depth / 2]).s * (spec.scale ?? 1);
  c.save();
  c.beginPath();
  if (silhouette(c, P, spec, h.grow)) {
    c.filter = `blur(${Math.max(0.5, h.blur * k)}px)`;
    c.translate(0, h.y * k);
    c.fillStyle = rgba(h.color, h.opacity);
    c.fill("nonzero");
  }
  c.restore();
}

function drawContact(c: CanvasRenderingContext2D, P: Projector, spec: PhoneSpec, s: Required<ContactShadow>) {
  const y = -PHONE.outline.h / 2, z = -PHONE.depth / 2, hw = PHONE.outline.w / 2;
  const m = P.local(spec, [0, y, z]), l = P.local(spec, [-hw, y, z]), r = P.local(spec, [hw, y, z]);
  if (!m.front) return;
  const k = m.s * (spec.scale ?? 1), w = Math.hypot(r.x - l.x, r.y - l.y) * s.width;
  c.save();
  c.filter = `blur(${Math.max(0.5, s.blur * k)}px)`;
  c.fillStyle = rgba(s.color, s.opacity);
  c.beginPath();
  c.ellipse(m.x, m.y + s.y * k, w / 2, Math.max(1, w * 0.05), 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export const PhoneStage: React.FC<PhoneStageProps> = (props) => {
  const current = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const frame = props.frame ?? current;
  const fontsOk = useFonts();
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; rigs: PhoneRig[] } | null>(null);
  useEffect(
    () => () => {
      world.current?.rigs.forEach((r) => r.dispose());
      world.current = null;
    },
    [],
  );
  useLayoutEffect(() => {
    if (!fontsOk || !canvas.current) return;
    const handle = delayRender("phone stage frame");
    try {
      const ss = props.ss ?? 2;
      const renderer = rendererFor(Math.round(W * ss), Math.round(H * ss));
      const st = (world.current ??= { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), rigs: [] });
      const aniso = renderer.capabilities.getMaxAnisotropy();
      props.phones.forEach((spec, i) => {
        const ppu = spec.ppu ?? 4, ippu = spec.islandPpu ?? 6;
        let rig: PhoneRig | undefined = st.rigs[i];
        if (rig && (rig.ppu !== ppu || rig.islandPpu !== ippu)) {
          st.scene.remove(rig.group);
          rig.dispose();
          rig = undefined;
        }
        if (!rig) {
          rig = new PhoneRig(finishOf(spec.finish), ppu, ippu, aniso);
          st.rigs[i] = rig;
          st.scene.add(rig.group);
        }
        rig.setFinish(finishOf(spec.finish));
        rig.group.visible = spec.visible !== false;
        const p = spec.position ?? [0, 0, 0], r = spec.rotation ?? [0, 0, 0];
        rig.group.position.set(p[0], p[1], p[2]);
        rig.group.rotation.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, "XYZ");
        rig.group.scale.setScalar(spec.scale ?? 1);
        if (!rig.group.visible) return;
        const info: ScreenInfo = { frame, fps, t: frame / fps, w: SCREEN_W, h: SCREEN_H, ppu, index: i };
        rig.drawScreen(spec.screen, info);
        rig.drawIsland(spec.island === false ? null : spec.island ?? restIsland, { ...info, ppu: ippu });
        for (const name of BUTTONS) rig.setButton(name, spec.buttons?.[name]);
      });
      for (let i = props.phones.length; i < st.rigs.length; i++) st.rigs[i].group.visible = false;
      applyCam(st.camera, props.camera, W, H);
      renderer.render(st.scene, st.camera);

      const c = canvas.current.getContext("2d")!;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.filter = "none";
      c.clearRect(0, 0, W, H);
      if (props.background) {
        c.fillStyle = props.background;
        c.fillRect(0, 0, W, H);
      }
      const P = projector(props.camera, W, H);
      const halo = props.halo === false ? null : { ...HALO, ...(typeof props.halo === "object" ? props.halo : {}) };
      const contact = props.shadow ? { ...CONTACT, ...(typeof props.shadow === "object" ? props.shadow : {}) } : null;
      for (const spec of props.phones) {
        if (spec.visible === false) continue;
        if (halo) drawHalo(c, P, spec, halo);
        if (contact) drawContact(c, P, spec, contact);
      }
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(renderer.domElement, 0, 0, W, H);
    } finally {
      continueRender(handle);
    }
  });
  return (
    <>
      {props.behind ?? null}
      <canvas ref={canvas} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, ...props.style }} />
    </>
  );
};
