/**
 * Mascot geometry, shared by the SVG overlay (<Mascot>, image space) and drawMascot (canvas: inside a screen or
 * the island). Local units: the body is 1 tall, centred on (0, 0), y down; the pose scales it to `size` (px in
 * overlays, pt inside a phone). Path helpers: flight (an arc between two points with shrink, spin and motion
 * stretch), hop (anticipation, jump, landing) and impact (squash and an elastic settle). Multi-point flights and
 * dotted trails: path.ts.
 */
import { shade as shadeHex } from "./color";
import { clamp, EASE, Ease, FieldKey, fields, lerp, wobble } from "./ease";

export type MascotShape = "stadium" | "drop" | "coin" | "blob" | "bubble" | "flame" | "plane";
export type EyeStyle = "oval" | "dot" | "happy" | "none";
export type MascotPose = {
  /** centre and body height */
  x: number; y: number; size: number;
  /** degrees */ rot?: number;
  /** 1 = neutral; < 1 squashes along the body's vertical (volume kept), > 1 stretches */ squash?: number;
  /** motion stretch along stretchAngle (degrees, image space) */ stretch?: number; stretchAngle?: number;
  /** mirror the body left-right (a plane flying left stays upright) */ flip?: boolean;
  shape?: MascotShape; color?: string;
  /** second body colour: two-tone shapes (plane) use it for the second tone (default a darker shade of `color`);
   * the other shapes get a vertical gradient from `color` (bottom) to `color2` (top) */ color2?: string;
  eye?: string; eyes?: EyeStyle; mouth?: "none" | "smile" | "open";
  /** 0 open .. 1 closed */ blink?: number;
  /** eye direction, -1..1 each */ look?: [number, number];
  /** -1..1: the head turns to its left/right (eyes slide, the far eye narrows) */ turn?: number;
  /** blob and flame phase (any number): animate it slowly for a blob, every frame for a flame's flicker */ wobble?: number;
  /** 0..1 soft highlight and shadow (0 = flat, like the reference) */ shade?: number;
  /** 0..1 crisp white gloss streak and dot at the upper left ("glossy flat") */ gloss?: number;
  opacity?: number; cheeks?: string;
  /** flame: colour of the inner flame in the bulb */ core?: string;
  /** flame: flicker amplitude (default 1) */ flicker?: number;
  /** bubble: -1..1 swings the tail tip about its root (+ outwards/up, - down); animate it to wag */ tail?: number;
  /** 0..1 open talking mouth (overrides `mouth` while > 0.02); mouthColor fills it (default deep ink) */ talk?: number;
  mouthColor?: string;
};

type Ellipse = { cx: number; cy: number; rx: number; ry: number };
/** w = body width in body heights; eye = [half spacing, y, rx, ry]; cx = eye-pair centre x; turnK = eye slide per turn */
const SHAPES: Record<MascotShape, { w: number; eye: [number, number, number, number]; mouthY: number; cx?: number; turnK?: number }> = {
  stadium: { w: 2.1, eye: [0.2, -0.04, 0.072, 0.135], mouthY: 0.16 },
  coin: { w: 1, eye: [0.15, -0.06, 0.06, 0.11], mouthY: 0.13 },
  drop: { w: 0.76, eye: [0.12, 0.1, 0.055, 0.1], mouthY: 0.27 },
  blob: { w: 1.16, eye: [0.15, -0.04, 0.062, 0.115], mouthY: 0.14 },
  bubble: { w: 1.56, eye: [0.2, -0.1, 0.065, 0.12], mouthY: 0.08 },
  flame: { w: 0.78, eye: [0.125, 0.03, 0.06, 0.108], mouthY: 0.22 },
  plane: { w: 2.0, eye: [0.105, -0.045, 0.056, 0.094], mouthY: 0.08, cx: 0.03, turnK: 0.05 },
};

/** Gloss streak per shape, local units: an arc (centre, radius, start and end angle in degrees, y down) with a dot
 * at angle `dot` on the same circle, or a straight streak with a dot. */
type Gloss = { cx: number; cy: number; r: number; a0: number; a1: number; dot: number; w: number } | { line: [number, number, number, number]; at: [number, number]; w: number };
const GLOSS: Record<MascotShape, Gloss> = {
  stadium: { cx: -0.55, cy: 0, r: 0.34, a0: 198, a1: 240, dot: 254, w: 0.07 },
  coin: { cx: 0, cy: 0, r: 0.36, a0: 200, a1: 240, dot: 254, w: 0.06 },
  drop: { cx: 0, cy: 0.12, r: 0.29, a0: 203, a1: 240, dot: 254, w: 0.052 },
  blob: { cx: 0, cy: 0, r: 0.4, a0: 200, a1: 238, dot: 252, w: 0.06 },
  bubble: { cx: -0.42, cy: -0.12, r: 0.26, a0: 200, a1: 245, dot: 262, w: 0.06 },
  flame: { line: [0.0, -0.13, 0.04, -0.28], at: [0.062, -0.36], w: 0.045 },
  plane: { line: [-0.7, -0.354, -0.3, -0.252], at: [-0.15, -0.213], w: 0.035 },
};
const f4 = (v: number) => v.toFixed(4);
/** The gloss streak of a pose in local units: an SVG path (stroke it, width `w`, round caps) and the dot. */
export function glossParts(p: MascotPose) {
  const g = GLOSS[p.shape ?? "stadium"];
  if ("line" in g) {
    const [x0, y0, x1, y1] = g.line;
    return { d: `M${f4(x0)} ${f4(y0)}L${f4(x1)} ${f4(y1)}`, w: g.w, dot: { x: g.at[0], y: g.at[1], r: g.w * 0.62 } };
  }
  const R = Math.PI / 180;
  const pt = (a: number) => [g.cx + g.r * Math.cos(a * R), g.cy + g.r * Math.sin(a * R)] as [number, number];
  const [x0, y0] = pt(g.a0), [x1, y1] = pt(g.a1), [dx, dy] = pt(g.dot);
  return { d: `M${f4(x0)} ${f4(y0)}A${g.r} ${g.r} 0 0 1 ${f4(x1)} ${f4(y1)}`, w: g.w, dot: { x: dx, y: dy, r: g.w * 0.62 } };
}

/** A flame: round bulb, a main tip curling right and a smaller tongue on the left, both flickering with the phase.
 * k scales the path about (0, oy) (the inner core uses a smaller copy anchored at the bottom). */
export const flamePath = (ph: number, amp = 1, k = 1, oy = 0.5) => {
  const tx = 0.06 + 0.05 * amp * Math.sin(ph), ty = -0.5 + 0.02 * amp * Math.sin(ph * 1.7 + 0.5);
  const lx = -0.26 + 0.035 * amp * Math.sin(ph * 1.3 + 1.1), ly = -0.19 + 0.04 * amp * Math.cos(ph * 1.9 + 0.3);
  const nx = -0.09 + 0.015 * amp * Math.sin(ph * 0.8), ny = -0.06;
  const P = (x: number, y: number) => `${(x * k).toFixed(4)} ${(oy + (y - oy) * k).toFixed(4)}`;
  return `M${P(tx, ty)}C${P(tx + 0.09, -0.37)} ${P(0.38, -0.2)} ${P(0.38, 0.12)}` +
    `C${P(0.38, 0.33)} ${P(0.21, 0.5)} ${P(0, 0.5)}C${P(-0.21, 0.5)} ${P(-0.38, 0.33)} ${P(-0.38, 0.12)}` +
    `C${P(-0.38, -0.03)} ${P(lx - 0.05, ly + 0.12)} ${P(lx, ly)}` +
    `C${P(lx + 0.04, ly + 0.07)} ${P(nx - 0.05, ny + 0.03)} ${P(nx, ny)}` +
    `C${P(nx + 0.03, ny - 0.16)} ${P(tx - 0.07, -0.36)} ${P(tx, ty)}Z`;
};

type Pt = [number, number];
/** SVG path of a polygon with rounded corners (one radius per vertex, local units). */
const roundPoly = (pts: Pt[], r: number[]) => {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const k = Math.min(r[i], la / 2, lb / 2);
    const p1 = [p[0] + ((a[0] - p[0]) * k) / la, p[1] + ((a[1] - p[1]) * k) / la];
    const p2 = [p[0] + ((b[0] - p[0]) * k) / lb, p[1] + ((b[1] - p[1]) * k) / lb];
    d += `${i ? "L" : "M"}${f4(p1[0])} ${f4(p1[1])}Q${f4(p[0])} ${f4(p[1])} ${f4(p2[0])} ${f4(p2[1])}`;
  }
  return d + "Z";
};
// the paper plane, nose to the right: wing N-T-M over keel N-M-K
const PN: Pt = [1.0, 0.08], PT: Pt = [-1.0, -0.5], PM: Pt = [-0.52, 0.125], PK: Pt = [-0.76, 0.5], PF: Pt = [-0.86, -0.33];
const PLANE_BODY = roundPoly([PN, PT, PM, PK], [0.07, 0.1, 0.03, 0.09]);
/** Extra fills drawn over the body (shade = lighten > 0 / darken < 0 of the pose colour; stroke = line width). */
export type MascotDetail = { d: string; shade: number; stroke?: number; alpha?: number };
const DETAILS: Partial<Record<MascotShape, { base: number; parts: MascotDetail[] }>> = {
  plane: {
    base: -0.15,
    parts: [
      { d: roundPoly([PN, PT, PM], [0.07, 0.1, 0.02]), shade: 0 },
      { d: roundPoly([PN, PT, PF], [0.07, 0.1, 0.02]), shade: 0.16 },
      { d: `M${f4(0.9)} ${f4(0.083)}L${f4(-0.46)} ${f4(0.12)}`, shade: 0.5, stroke: 0.026, alpha: 0.8 },
    ],
  },
};

const blobPath = (phase: number) => {
  const n = 16, pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.055 * Math.sin(3 * a + phase) + 0.035 * Math.sin(5 * a - phase * 1.3) + 0.02 * Math.cos(2 * a + phase * 0.7);
    pts.push([0.58 * r * Math.cos(a), 0.5 * r * Math.sin(a)]);
  }
  let d = `M${pts[0][0].toFixed(4)} ${pts[0][1].toFixed(4)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(4)} ${c1[1].toFixed(4)} ${c2[0].toFixed(4)} ${c2[1].toFixed(4)} ${p2[0].toFixed(4)} ${p2[1].toFixed(4)}`;
  }
  return d + "Z";
};

const BODY: Record<Exclude<MascotShape, "blob" | "flame">, string> = {
  stadium: "M-0.55 -0.5H0.55A0.5 0.5 0 0 1 0.55 0.5H-0.55A0.5 0.5 0 0 1 -0.55 -0.5Z",
  coin: "M0.5 0A0.5 0.5 0 1 1 -0.5 0A0.5 0.5 0 1 1 0.5 0Z",
  drop: "M0 -0.5C0.16 -0.3 0.38 -0.1 0.38 0.12A0.38 0.38 0 0 1 -0.38 0.12C-0.38 -0.1 -0.16 -0.3 0 -0.5Z",
  bubble: "M-0.48 -0.5H0.48Q0.78 -0.5 0.78 -0.2V0.06Q0.78 0.36 0.48 0.36H-0.14Q-0.3 0.44 -0.52 0.53Q-0.44 0.44 -0.42 0.36H-0.48Q-0.78 0.36 -0.78 0.06V-0.2Q-0.78 -0.5 -0.48 -0.5Z",
  plane: PLANE_BODY,
};

/** The bubble body with its tail tip and control points turned about the tail root by tail x 0.45 rad. */
const bubbleBody = (tail: number) => {
  if (Math.abs(tail) < 1e-4) return BODY.bubble;
  const a = clamp(tail, -1, 1) * 0.45, c = Math.cos(a), s = Math.sin(a), px = -0.3, py = 0.36;
  const r = (x: number, y: number) => `${(px + (x - px) * c - (y - py) * s).toFixed(4)} ${(py + (x - px) * s + (y - py) * c).toFixed(4)}`;
  return `M-0.48 -0.5H0.48Q0.78 -0.5 0.78 -0.2V0.06Q0.78 0.36 0.48 0.36H-0.14Q${r(-0.3, 0.44)} ${r(-0.52, 0.53)}Q${r(-0.44, 0.44)} -0.42 0.36H-0.48Q-0.78 0.36 -0.78 0.06V-0.2Q-0.78 -0.5 -0.48 -0.5Z`;
};

/** The body outline, eyes and mouth in local units; bodyColor / gradient = the body fill, details = extra two-tone
 * fills (the plane's wing and crease), core = the flame's inner flame, talkMouth = the open talking mouth. */
export function mascotParts(p: MascotPose) {
  const shape = p.shape ?? "stadium", S = SHAPES[shape];
  const body = shape === "blob" ? blobPath(p.wobble ?? 0) : shape === "flame" ? flamePath(p.wobble ?? 0, p.flicker ?? 1) : shape === "bubble" ? bubbleBody(p.tail ?? 0) : BODY[shape];
  const core = shape === "flame" && p.core ? flamePath((p.wobble ?? 0) * 1.3 + 0.9, (p.flicker ?? 1) * 1.4, 0.42, 0.47) : undefined;
  const [ex, ey, erx, ery] = S.eye;
  const turn = clamp(p.turn ?? 0, -1, 1), [lx, ly] = p.look ?? [0, 0];
  const style = p.eyes ?? "oval";
  const dot = style === "dot";
  const shift = (S.cx ?? 0) + turn * S.w * (S.turnK ?? 0.2) + lx * 0.05;
  const color = p.color ?? "#7457ff", D = DETAILS[shape];
  const bodyColor = D ? p.color2 ?? shadeHex(color, D.base) : color;
  const gradient = !D && p.color2 ? ([color, p.color2] as [string, string]) : undefined;
  const details = D ? D.parts.map((q) => ({ ...q, color: q.shade === 0 ? color : shadeHex(color, q.shade) })) : [];
  const eyes: Ellipse[] = [-1, 1].map((k) => {
    const far = k * turn < 0 ? 1 - 0.35 * Math.abs(turn) : 1;
    return {
      cx: k * ex * (1 - 0.25 * Math.abs(turn)) + shift,
      cy: ey + ly * 0.04,
      rx: (dot ? 0.055 : erx) * far,
      ry: (dot ? 0.055 : ery) * Math.max(0.08, 1 - (p.blink ?? 0)),
    };
  });
  const talk = clamp(p.talk ?? 0);
  const mouth = talk > 0.02 ? "talk" : p.mouth === "smile" ? `M${-0.08 + shift} ${S.mouthY}Q${shift} ${S.mouthY + 0.075} ${0.08 + shift} ${S.mouthY}` : p.mouth === "open" ? "open" : undefined;
  const cheeks = p.cheeks ? eyes.map((e) => ({ cx: e.cx + Math.sign(e.cx - shift) * 0.07, cy: ey + ery + 0.06, rx: 0.06, ry: 0.035 })) : undefined;
  /** the talking mouth: an ellipse that opens downwards from the smile line */
  const talkMouth = { cx: shift, cy: S.mouthY + 0.012 + 0.03 * talk, rx: 0.075 - 0.015 * talk, ry: 0.014 + 0.05 * talk };
  return { body, bodyColor, gradient, core, details, eyes, mouth, mouthAt: [shift, S.mouthY + 0.02] as [number, number], cheeks, width: S.w, style, talkMouth };
}

/** SVG transform of a pose (also mirrored on the canvas). */
export const mascotTransform = (p: MascotPose) => {
  const st = p.stretch ?? 1, sa = p.stretchAngle ?? 0, sq = p.squash ?? 1;
  return `translate(${p.x} ${p.y}) rotate(${sa}) scale(${st} ${1 / st}) rotate(${-sa}) rotate(${p.rot ?? 0}) scale(${((p.flip ? -1 : 1) * p.size) / sq} ${p.size * sq})`;
};

const paths = new Map<string, Path2D>();
const p2d = (d: string) => {
  let p = paths.get(d);
  if (!p) {
    if (paths.size > 400) paths.clear();
    paths.set(d, (p = new Path2D(d)));
  }
  return p;
};

/** Draw a mascot on a canvas (in the context's units). */
export function drawMascot(ctx: CanvasRenderingContext2D, p: MascotPose) {
  if (p.size <= 0.01 || (p.opacity ?? 1) <= 0.002) return;
  const parts = mascotParts(p);
  const st = p.stretch ?? 1, sa = ((p.stretchAngle ?? 0) * Math.PI) / 180, sq = p.squash ?? 1;
  ctx.save();
  ctx.globalAlpha *= clamp(p.opacity ?? 1);
  ctx.translate(p.x, p.y);
  ctx.rotate(sa);
  ctx.scale(st, 1 / st);
  ctx.rotate(-sa);
  ctx.rotate(((p.rot ?? 0) * Math.PI) / 180);
  ctx.scale(((p.flip ? -1 : 1) * p.size) / sq, p.size * sq);
  const body = p2d(parts.body);
  if (parts.gradient) {
    const g = ctx.createLinearGradient(0, 0.5, 0, -0.5);
    g.addColorStop(0, parts.gradient[0]);
    g.addColorStop(1, parts.gradient[1]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = parts.bodyColor;
  ctx.fill(body);
  for (const d of parts.details) {
    ctx.save();
    ctx.globalAlpha *= d.alpha ?? 1;
    if (d.stroke) {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = d.stroke;
      ctx.lineCap = "round";
      ctx.stroke(p2d(d.d));
    } else {
      ctx.fillStyle = d.color;
      ctx.fill(p2d(d.d));
    }
    ctx.restore();
  }
  if (parts.core) {
    ctx.fillStyle = p.core!;
    ctx.fill(p2d(parts.core));
  }
  if (p.shade) {
    ctx.save();
    ctx.clip(body);
    const g = ctx.createRadialGradient(-parts.width * 0.18, -0.3, 0, -parts.width * 0.18, -0.3, 0.7);
    g.addColorStop(0, `rgba(255,255,255,${0.32 * p.shade})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-2, -1, 4, 2);
    const b = ctx.createLinearGradient(0, 0.1, 0, 0.55);
    b.addColorStop(0, "rgba(0,0,0,0)");
    b.addColorStop(1, `rgba(0,0,0,${0.16 * p.shade})`);
    ctx.fillStyle = b;
    ctx.fillRect(-2, -1, 4, 2);
    ctx.restore();
  }
  if (p.gloss) {
    const gl = glossParts(p);
    ctx.save();
    ctx.globalAlpha *= clamp(p.gloss) * 0.9;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = gl.w;
    ctx.lineCap = "round";
    ctx.stroke(p2d(gl.d));
    ctx.beginPath();
    ctx.arc(gl.dot.x, gl.dot.y, gl.dot.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const eye = p.eye ?? "#ffffff";
  if (parts.cheeks) {
    ctx.fillStyle = p.cheeks!;
    for (const c of parts.cheeks) {
      ctx.beginPath();
      ctx.ellipse(c.cx, c.cy, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (parts.style === "happy") {
    ctx.strokeStyle = eye;
    ctx.lineWidth = 0.05;
    ctx.lineCap = "round";
    for (const e of parts.eyes) {
      ctx.beginPath();
      ctx.moveTo(e.cx - e.rx * 1.3, e.cy + 0.02);
      ctx.quadraticCurveTo(e.cx, e.cy - 0.1, e.cx + e.rx * 1.3, e.cy + 0.02);
      ctx.stroke();
    }
  } else if (parts.style !== "none") {
    ctx.fillStyle = eye;
    for (const e of parts.eyes) {
      ctx.beginPath();
      ctx.ellipse(e.cx, e.cy, Math.max(0.002, e.rx), Math.max(0.002, e.ry), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (parts.mouth === "talk") {
    const m = parts.talkMouth;
    ctx.fillStyle = p.mouthColor ?? "#1b1340";
    ctx.beginPath();
    ctx.ellipse(m.cx, m.cy, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (parts.mouth === "open") {
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.ellipse(parts.mouthAt[0], parts.mouthAt[1], 0.05, 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (parts.mouth) {
    ctx.strokeStyle = eye;
    ctx.lineWidth = 0.04;
    ctx.lineCap = "round";
    ctx.stroke(p2d(parts.mouth));
  }
  ctx.restore();
}

export type Flight = { x: number; y: number; size: number; rot: number; stretch: number; stretchAngle: number; t: number; done: boolean };
export type FlightOpts = {
  /** [x, y, size] at the start and the end (the end may move: pass this frame's projected target) */
  from: [number, number, number]; to: [number, number, number];
  at: number; dur: number;
  /** bulge of the path, px; positive bows to the left of the direction of travel */ arc?: number;
  ease?: Ease;
  /** ease of the size alone (default: the position's); EASE.inOut keeps a big entrance big for a few frames */
  sizeEase?: Ease;
  /** rotation (deg) at the start and the end, plus extra spin over the flight */ rotFrom?: number; rotTo?: number; spin?: number;
  /** max motion stretch (0.35 = 35 % longer along the motion) */ stretch?: number;
};

const bez = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
/** A flight along a quadratic arc: size interpolated geometrically (reads as depth), rotation, and a stretch along
 * the motion that grows with speed. Before `at` it holds the start; after at + dur the end (done = true). */
export function flight(frame: number, o: FlightOpts): Flight {
  const ease = o.ease ?? EASE.inOut;
  const [x0, y0, s0] = o.from, [x1, y1, s1] = o.to;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, arc = o.arc ?? 0;
  const cx = (x0 + x1) / 2 + (dy / len) * arc, cy = (y0 + y1) / 2 - (dx / len) * arc;
  const at = (f: number) => {
    const u = clamp((f - o.at) / o.dur), t = ease(u), ts = (o.sizeEase ?? ease)(u);
    return { t, x: bez(x0, cx, x1, t), y: bez(y0, cy, y1, t), size: s0 * Math.pow(Math.max(1e-6, s1) / Math.max(1e-6, s0), ts) };
  };
  const p = at(frame), a = at(frame - 0.5), b = at(frame + 0.5);
  const vx = b.x - a.x, vy = b.y - a.y, speed = Math.hypot(vx, vy) / Math.max(1, p.size);
  const rot = lerp(o.rotFrom ?? 0, o.rotTo ?? 0, p.t) + (o.spin ?? 0) * p.t;
  return {
    x: p.x, y: p.y, size: p.size, rot,
    stretch: 1 + Math.min(o.stretch ?? 0.3, speed * 0.5),
    stretchAngle: (Math.atan2(vy, vx) * 180) / Math.PI,
    t: p.t, done: frame >= o.at + o.dur,
  };
}

export type PoseFields = { x: number; y: number; size: number; rot: number; squash: number };
/** Keyframed pose: keys set any of x, y, size, rot, squash, with per-field eases (use backIn for anticipation,
 * backOut / EASE.wordPopBounce for overshoot). Spread the result into <Mascot>. */
export const poseTrack = (frame: number, keys: FieldKey<PoseFields>[], base: PoseFields = { x: 0, y: 0, size: 100, rot: 0, squash: 1 }) => fields(frame, keys, base);

/** Squash at an impact on frame `at`, then an elastic settle: multiply into `squash`. */
export const impact = (frame: number, at: number, amount = 0.3, hz = 4.5, decay = 8) => (frame < at ? 1 : 1 - wobble(frame, at, amount, hz, decay));

/** A hop in place: anticipation squash, jump with stretch, landing squash. Returns a y offset (up negative, in
 * body heights x `height`) and a squash factor. */
export function hop(frame: number, at: number, o: { dur?: number; height?: number } = {}) {
  const dur = o.dur ?? 18, h = o.height ?? 1, u = (frame - at) / dur;
  if (u <= 0) return { dy: 0, squash: 1 };
  if (u < 0.22) return { dy: 0, squash: 1 - 0.18 * Math.sin((u / 0.22) * Math.PI * 0.5) };
  if (u < 0.82) {
    const s = (u - 0.22) / 0.6;
    return { dy: -h * Math.sin(s * Math.PI), squash: lerp(1.14, 0.98, s) };
  }
  const land = at + dur * 0.82;
  return { dy: 0, squash: impact(frame, land, 0.2, 4, 9) };
}
