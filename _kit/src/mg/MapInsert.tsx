/**
 * <MapInsert spec={(f, ctx) => MapSpec} />: a full-frame map in the motion-design style, used as a scene (or a cut
 * inside a scene) of a cel film. The film shell still draws captions, the reference label and chapter cards on top.
 * Animate everything from the scene-local frame f: view with mapCam(), coasts with draw, routes with p, pins with a.
 *
 *   export const Journey: React.FC<SceneProps> = ({ g }) => (
 *     <MapInsert spec={(f) => ({
 *       view: mapCam([[0, { lon: 31, lat: 35.5, span: 9 }], [g[1], { lon: 32.5, lat: 37, span: 5 }]], f),
 *       draw: seg(f, 0, 50), routes: [{ via: FIRST_JOURNEY, p: seg(f, g[1], g[1] + 150), arrow: true }],
 *       pins: [{ at: "antioch", a: seg(f, 20, 30) }], light: { at: "antioch", r: seg(f, 10, 80) * 0.3 },
 *     })} />
 *   );
 */
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { MapSpec, drawMap } from "./map";
import { useMapFonts } from "./fonts";

export type MapCtx = { W: number; H: number; portrait: boolean; p: <T>(land: T, port: T) => T };

export const MapInsert: React.FC<{ spec: (f: number, ctx: MapCtx) => MapSpec; vignette?: number; grain?: number }> = ({ spec, vignette = 0.55, grain = 0.06 }) => {
  const f = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, release] = useMapFonts();
  const portrait = H > W;
  useLayoutEffect(() => {
    if (!ready) return;
    const ctx = ref.current!.getContext("2d")!;
    drawMap(ctx, W, H, { frame: f, ...spec(f, { W, H, portrait, p: (a, b) => (portrait ? b : a) }) });
    release();
  });
  const g2 = Math.floor(f / 2);
  return (
    <AbsoluteFill style={{ background: "#04070C" }}>
      <canvas ref={ref} width={W} height={H} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {vignette > 0 ? <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${vignette}) 100%)` }} /> : null}
      {grain > 0 ? (
        <AbsoluteFill style={{ backgroundImage: `url(${staticFile("grain.png")})`, backgroundPosition: `${(g2 * 137) % 256}px ${(g2 * 89) % 256}px`, opacity: grain, mixBlendMode: "screen" }} />
      ) : null}
    </AbsoluteFill>
  );
};
