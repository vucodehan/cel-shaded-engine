/**
 * <ScreenCanvas>: a phone screen drawn flat in 2D with the same callbacks as a PhoneStage phone (for 2D layouts,
 * inserts and quick stills of a screen). Optional flat bezel and frame; `rotate` tilts it in the image plane.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Canvas2D } from "./Canvas2D";
import { PHONE, SCREEN_H, SCREEN_W, ScreenDraw } from "./geometry";
import { restIsland } from "./island";
import { finishOf, Finish, FinishName } from "./phone3d";
import { setShadow } from "./ui";

export type ScreenCanvasProps = {
  screen: ScreenDraw;
  island?: ScreenDraw | false;
  /** centre and height of the screen in px */
  x: number; y: number; height: number;
  rotate?: number;
  /** draw the flat body around the screen */ bezel?: boolean;
  finish?: FinishName | Finish;
  shadow?: boolean;
  frame?: number;
};

export const ScreenCanvas: React.FC<ScreenCanvasProps> = (p) => {
  const cur = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = p.frame ?? cur;
  const k = p.height / SCREEN_H;
  return (
    <Canvas2D
      draw={(ctx) => {
        const f = finishOf(p.finish);
        ctx.translate(p.x, p.y);
        ctx.rotate(((p.rotate ?? 0) * Math.PI) / 180);
        ctx.scale(k, k);
        if (p.bezel) {
          const O = PHONE.outline;
          ctx.save();
          if (p.shadow) setShadow(ctx, { blur: 60, y: 24, color: "rgba(0,0,0,0.22)" });
          ctx.beginPath();
          ctx.roundRect(-O.w / 2, -O.h / 2, O.w, O.h, O.r);
          ctx.fillStyle = f.frame;
          ctx.fill();
          ctx.restore();
          ctx.beginPath();
          ctx.roundRect(-O.w / 2 + PHONE.rim, -O.h / 2 + PHONE.rim, O.w - 2 * PHONE.rim, O.h - 2 * PHONE.rim, O.r - PHONE.rim);
          ctx.fillStyle = f.bezel;
          ctx.fill();
        }
        ctx.translate(-SCREEN_W / 2, -SCREEN_H / 2);
        ctx.save();
        if (p.shadow && !p.bezel) setShadow(ctx, { blur: 50, y: 20, color: "rgba(0,0,0,0.2)" });
        ctx.beginPath();
        ctx.roundRect(0, 0, SCREEN_W, SCREEN_H, PHONE.screen.r);
        ctx.fillStyle = f.glass;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, SCREEN_W, SCREEN_H, PHONE.screen.r);
        ctx.clip();
        const info = { frame, fps, t: frame / fps, w: SCREEN_W, h: SCREEN_H, ppu: k, index: 0 };
        p.screen(ctx, info);
        if (p.island !== false) (p.island ?? restIsland)(ctx, info);
        ctx.restore();
      }}
    />
  );
};
