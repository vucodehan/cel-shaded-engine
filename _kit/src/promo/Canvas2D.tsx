/** A full-frame 2D canvas redrawn on every render: draw(ctx) in composition px. Waits for the kit fonts. */
import React, { useLayoutEffect, useRef } from "react";
import { useVideoConfig } from "remotion";
import { useFonts } from "./fonts";

export const Canvas2D: React.FC<{ draw: (ctx: CanvasRenderingContext2D) => void; style?: React.CSSProperties }> = ({ draw, style }) => {
  const { width: W, height: H } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const ok = useFonts();
  useLayoutEffect(() => {
    if (!ok || !ref.current) return;
    const ctx = ref.current.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    draw(ctx);
    ctx.restore();
  });
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, pointerEvents: "none", ...style }} />;
};
