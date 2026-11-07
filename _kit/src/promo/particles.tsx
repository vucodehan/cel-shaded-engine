/**
 * Confetti and other bursts: seeded and closed-form (no state between frames), so any frame renders on its own.
 * 2D: image px or screen pt, y down. 3D: phone-local pt, y up (the burst rides the camera; project it with
 * projectParticles(parts, (p) => P.local(pose, p))). Each piece flies with linear drag and gravity:
 *   p(t) = p0 + v0 (1 - e^-kt) / k + g (t / k - (1 - e^-kt) / k^2)
 * spins in its plane, tumbles (its height scales with cos, showing a darker back) and fades at the end of its life.
 */
import React from "react";
import { useVideoConfig } from "remotion";
import { shade } from "./color";
import { clamp, rng } from "./ease";
import type { V3 } from "./geometry";

export type ParticleShape = "strip" | "rect" | "dot" | "tri";
export type ConfettiOpts = {
  /** burst frame; pieces leave over `emit` frames from it */ at: number;
  /** emitter: [x, y] (2D) or [x, y, z] (3D, phone-local) */ origin: number[];
  count?: number; seed?: number;
  /** launch direction: 2D degrees (0 = right, -90 = up, the default) or a 3D vector (default [0, 1, 0], up) */ dir?: number | number[];
  /** cone half-angle, degrees (default 35) */ spread?: number;
  /** launch speed range, units per second (default [650, 1300] x scale) */ speed?: [number, number];
  /** gravity, units per second squared (default 1500 x scale) */ gravity?: number;
  /** linear drag per second (default 1.8) */ drag?: number;
  /** piece length range, units (default [12, 22] x scale) */ size?: [number, number];
  /** seconds a piece lives before a 0.35 s fade (default [1.3, 2.1]) */ life?: [number, number];
  /** frames over which the pieces leave (default 0: all at once) */ emit?: number;
  colors?: string[]; shapes?: ParticleShape[];
  /** max tumble turns per second (default 2.2) */ spin?: number;
  /** multiplies the default speed, gravity and size: 1 = px at 1080; use px per pt on a screen (about 0.4), or 1 for 3D pt */ scale?: number;
  fps?: number;
};
export type Particle = {
  /** position (2 or 3 numbers); x, y = the 2D position (after projectParticles for 3D) */ p: number[]; x: number; y: number;
  /** in-plane rotation (deg) and tumble (-1..1: the piece's height factor; < 0 shows its back) */ rot: number; tumble: number;
  w: number; h: number; color: string; back: string; shape: ParticleShape; alpha: number;
  /** seconds since launch, index, view depth (projected 3D only) */ age: number; i: number; depth?: number;
};

export const CONFETTI = ["#ff5a5f", "#ffc531", "#3dd68c", "#4c8dff", "#a86bff", "#ff8fc7"];

/** The pieces of a burst at `frame` (only the live ones). */
export function confetti(frame: number, o: ConfettiOpts): Particle[] {
  const fps = o.fps ?? 30, k0 = o.scale ?? 1, n = o.count ?? 60, is3 = o.origin.length >= 3;
  if (frame < o.at) return [];
  const R = rng((o.seed ?? 1) * 2654435761 + n);
  const [s0, s1] = o.speed ?? [650 * k0, 1300 * k0], g = o.gravity ?? 1500 * k0, kd = Math.max(1e-4, o.drag ?? 1.8);
  const [z0, z1] = o.size ?? [12 * k0, 22 * k0], [l0, l1] = o.life ?? [1.3, 2.1], spread = ((o.spread ?? 35) * Math.PI) / 180;
  const colors = o.colors ?? CONFETTI, shapes = o.shapes ?? ["strip", "strip", "rect", "dot"];
  // 3D: an orthonormal basis around the launch direction
  const d3 = (Array.isArray(o.dir) ? o.dir : [0, 1, 0]) as number[], dl = Math.hypot(d3[0], d3[1], d3[2] ?? 0) || 1;
  const D = [d3[0] / dl, d3[1] / dl, (d3[2] ?? 0) / dl];
  const helper = Math.abs(D[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cr = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const U0 = cr(D, helper), ul = Math.hypot(U0[0], U0[1], U0[2]), U = U0.map((v) => v / ul), Wv = cr(D, U);
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const r = () => R();
    const t0 = o.at + (o.emit ? r() * o.emit : 0), sp = s0 + (s1 - s0) * r(), life = l0 + (l1 - l0) * r();
    const len = z0 + (z1 - z0) * r(), shape = shapes[Math.floor(r() * shapes.length)], color = colors[Math.floor(r() * colors.length)];
    const rot0 = r() * 360, spinRate = (r() - 0.5) * 2 * 1.4, tum0 = r() * Math.PI * 2, tumRate = (0.4 + 0.6 * r()) * (o.spin ?? 2.2);
    let v: number[];
    if (is3) {
      const th = Math.acos(1 - r() * (1 - Math.cos(spread))), ph = r() * Math.PI * 2, st = Math.sin(th), ct = Math.cos(th);
      v = [0, 1, 2].map((j) => sp * (D[j] * ct + (U[j] * Math.cos(ph) + Wv[j] * Math.sin(ph)) * st));
    } else {
      const a = (((typeof o.dir === "number" ? o.dir : -90) * Math.PI) / 180) + (r() * 2 - 1) * spread;
      v = [sp * Math.cos(a), sp * Math.sin(a)];
    }
    const age = (frame - t0) / fps;
    if (age < 0) continue;
    const alpha = 1 - clamp((age - life) / 0.35);
    if (alpha <= 0) continue;
    const e = Math.exp(-kd * age), fa = (1 - e) / kd, fg = age / kd - (1 - e) / (kd * kd);
    const grav = is3 ? [0, -g, 0] : [0, g];
    const p = o.origin.slice(0, is3 ? 3 : 2).map((x0, j) => x0 + v[j] * fa + grav[j] * fg);
    const w = shape === "strip" ? len : shape === "dot" ? len * 0.55 : len * 0.7;
    const h = shape === "strip" ? len * 0.42 : w;
    out.push({ p, x: p[0], y: p[1], rot: rot0 + spinRate * age * 360, tumble: Math.cos(tum0 + tumRate * age * Math.PI * 2), w, h, color, back: shade(color, -0.28), shape, alpha, age, i });
  }
  return out;
}

/** 3D pieces -> image px with a projector, e.g. projectParticles(parts, (p) => P.local(pose, p)); sizes scale with
 * depth (multiply by the phone's scale if it is not 1). Sorted far to near. */
export function projectParticles(parts: Particle[], to: (p: V3) => { x: number; y: number; s: number; depth: number; front?: boolean }): Particle[] {
  return parts
    .map((q) => {
      const pr = to([q.p[0], q.p[1], q.p[2] ?? 0]);
      return pr.front === false ? null : { ...q, x: pr.x, y: pr.y, w: q.w * pr.s, h: q.h * pr.s, depth: pr.depth };
    })
    .filter((q): q is Particle & { depth: number } => q !== null)
    .sort((a, b) => b.depth - a.depth);
}

const triPts = (w: number, h: number) => `0,${-h * 0.58} ${w * 0.5},${h * 0.29} ${-w * 0.5},${h * 0.29}`;

/** Draw pieces on a canvas (in the context's units). */
export function drawParticles(ctx: CanvasRenderingContext2D, parts: Particle[]) {
  for (const q of parts) {
    ctx.save();
    ctx.globalAlpha *= q.alpha;
    ctx.translate(q.x, q.y);
    ctx.rotate((q.rot * Math.PI) / 180);
    ctx.scale(1, Math.abs(q.tumble) < 0.06 ? 0.06 * Math.sign(q.tumble || 1) : q.tumble);
    ctx.fillStyle = q.tumble >= 0 ? q.color : q.back;
    ctx.beginPath();
    if (q.shape === "dot") ctx.arc(0, 0, q.w / 2, 0, Math.PI * 2);
    else if (q.shape === "tri") {
      ctx.moveTo(0, -q.h * 0.58);
      ctx.lineTo(q.w * 0.5, q.h * 0.29);
      ctx.lineTo(-q.w * 0.5, q.h * 0.29);
      ctx.closePath();
    } else ctx.rect(-q.w / 2, -q.h / 2, q.w, q.h);
    ctx.fill();
    ctx.restore();
  }
}

/** Pieces as an SVG overlay in image px. */
export const Particles: React.FC<{ parts: Particle[]; style?: React.CSSProperties }> = ({ parts, style }) => {
  const { width, height } = useVideoConfig();
  if (!parts.length) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", ...style }}>
      {parts.map((q) => {
        const ty = Math.abs(q.tumble) < 0.06 ? 0.06 * Math.sign(q.tumble || 1) : q.tumble, fill = q.tumble >= 0 ? q.color : q.back;
        return (
          <g key={q.i} transform={`translate(${q.x} ${q.y}) rotate(${q.rot}) scale(1 ${ty})`} opacity={q.alpha}>
            {q.shape === "dot" ? <circle r={q.w / 2} fill={fill} /> : q.shape === "tri" ? <polygon points={triPts(q.w, q.h)} fill={fill} /> : <rect x={-q.w / 2} y={-q.h / 2} width={q.w} height={q.h} fill={fill} />}
          </g>
        );
      })}
    </svg>
  );
};
