/**
 * <Shot def={...} />: one 3D shot inside Remotion. The scene is built once per mount, updated per frame,
 * rendered through the shared core (engine.ts) and copied into this shot's own 2D canvas, so two shots can be
 * on screen at once (crossfades) while the tab keeps a single WebGL context and one shader cache.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, Sequence, continueRender, delayRender, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { G, Post, ShadowBox, defaultPost, disposeTree, renderFrame } from "./engine";
import { contactPass } from "./contact";
import { coplanarReport } from "./qa";

/** Geometry QA on (celstills.mjs --qa passes { qa: true }): coplanar faces are reported once per shot. */
const QA = !!(getInputProps() as { qa?: boolean }).qa;

export type Env = {
  light?: THREE.Vector3; lightCol?: string; shadowTint?: string;
  rim?: THREE.Vector3; rimCol?: string; rimAmt?: number;
  fogCol?: string; fogNear?: number; fogFar?: number; fogAmt?: number;
  lineScale?: number;
  /** shadow multiplier colour (night "#6f7fb0", lamplight "#9a7a98"); default white */
  shadeK?: string;
};

export function setEnv(e: Env) {
  G.uLightDir.value.copy(e.light ?? new THREE.Vector3(0.5, 0.75, 0.45)).normalize();
  G.uLightCol.value.set(e.lightCol ?? "#ffffff");
  G.uShadowTint.value.set(e.shadowTint ?? "#7c74a8");
  G.uRimDir.value.copy(e.rim ?? new THREE.Vector3(-0.6, 0.3, -0.7)).normalize();
  G.uRimCol.value.set(e.rimCol ?? "#fff1d0");
  G.uRimAmt.value = e.rimAmt ?? 0;
  G.uFogCol.value.set(e.fogCol ?? "#c9d8e6");
  G.uFogNear.value = e.fogNear ?? 60;
  G.uFogFar.value = e.fogFar ?? 900;
  G.uFogAmt.value = e.fogAmt ?? 0;
  G.uLineScale.value = e.lineScale ?? 1;
  G.uShadeK.value.set(e.shadeK ?? "#ffffff");
}

export type ShotCtx = { W: number; H: number; aspect: number; portrait: boolean; p: <T>(land: T, port: T) => T };

export type ShotState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** called every frame with the shot-local frame; set env, poses, camera here */
  update: (f: number) => void;
  post?: (f: number) => Partial<Post>;
  shadow?: ShadowBox | null | ((f: number) => ShadowBox | null);
  dispose?: () => void;
};

export type ShotDef = (ctx: ShotCtx) => ShotState;

export const newScene = () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 6000);
  return { scene, camera };
};

export const Shot: React.FC<{ def: ShotDef; ss?: number }> = ({ def, ss }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const ctx: ShotCtx = useMemo(() => {
    const portrait = H > W;
    return { W, H, aspect: W / H, portrait, p: (a, b) => (portrait ? b : a) };
  }, [W, H]);
  const st = useMemo(() => def(ctx), [def, ctx]);
  useEffect(
    () => () => {
      st.dispose?.();
      disposeTree(st.scene);
    },
    [st],
  );
  useLayoutEffect(() => {
    const handle = delayRender("cel shot");
    try {
      G.uTime.value = Math.floor(frame / 2) * (2 / 30);
      st.scene.updateMatrixWorld(true);
      st.update(frame);
      st.scene.updateMatrixWorld(true);
      contactPass(st.scene, st.camera);
      if (QA && !st.scene.userData.qaDone) {
        st.scene.userData.qaDone = true;
        coplanarReport(st.scene, st.camera);
      }
      const sky = st.scene.getObjectByName("sky");
      if (sky) sky.position.copy(st.camera.position);
      const post = { ...defaultPost(), ...(st.post ? st.post(frame) : {}) };
      const shadow = typeof st.shadow === "function" ? st.shadow(frame) : st.shadow ?? null;
      const src = renderFrame(st.scene, st.camera, W, H, post, { ss: ss ?? 2, shadow, seed: Math.floor(frame / 2) });
      const c = ref.current!.getContext("2d")!;
      c.drawImage(src, 0, 0, W, H);
    } finally {
      continueRender(handle);
    }
  }, [frame, st, W, H, ss]);
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};

/** A run of hard-cut shots: [[duration, def], ...] laid end to end from frame 0 of the parent sequence. */
export const Cuts: React.FC<{ shots: [number, ShotDef][]; ss?: number }> = ({ shots, ss }) => {
  let at = 0;
  return (
    <AbsoluteFill>
      {shots.map(([dur, def], i) => {
        const from = at;
        at += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Shot def={def} ss={ss} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
