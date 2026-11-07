/**
 * <Background>: solid colour, linear gradient, soft radial washes (slow drift optional), vignette and grain
 * (public/grain.png). Grain defaults to soft-light: pure white stays white, gradients and colour get dithered.
 */
import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cssLinear, rgba, Stops } from "./color";

/** A soft colour wash: centre (x, y) and radius r in fractions of the frame (r of its longer side). */
export type Wash = { x: number; y: number; r: number; color: string; opacity?: number };
export type BackgroundProps = {
  color?: string;
  gradient?: { angle?: number; stops: Stops };
  washes?: Wash[];
  /** px of slow drift for the washes */ drift?: number;
  /** 0..1 grain opacity (0.06 is subtle) */ grain?: number;
  grainBlend?: React.CSSProperties["mixBlendMode"];
  /** 0..1 darkening towards the corners */ vignette?: number;
  children?: React.ReactNode;
};

export const Background: React.FC<BackgroundProps> = (p) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const L = Math.max(W, H);
  return (
    <AbsoluteFill style={{ background: p.gradient ? cssLinear(p.gradient.angle ?? 180, p.gradient.stops) : p.color ?? "#ffffff", overflow: "hidden" }}>
      {(p.washes ?? []).map((w, i) => {
        const d = p.drift ?? 0;
        const x = w.x * W + d * Math.sin(frame / 47 + i * 1.9), y = w.y * H + d * Math.cos(frame / 59 + i * 2.7), r = w.r * L;
        const a = w.opacity ?? 0.5;
        // 17 stops on a smooth (cosine) falloff: 7 linear stops showed concentric Mach bands on white
        const stops = Array.from({ length: 17 }, (_, k) => `${rgba(w.color, a * (0.5 + 0.5 * Math.cos((Math.PI * k) / 16)) ** 1.35)} ${(k / 16) * 100}%`).join(", ");
        return <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: `radial-gradient(circle closest-side, ${stops})` }} />;
      })}
      {p.vignette ? <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${p.vignette}) 100%)` }} /> : null}
      {p.children}
      {p.grain ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${staticFile("grain.png")})`, backgroundSize: "512px 512px",
            backgroundPosition: `${(frame * 197) % 512}px ${(frame * 331) % 512}px`,
            opacity: p.grain, mixBlendMode: p.grainBlend ?? "soft-light", pointerEvents: "none",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
