/**
 * Original icon glyphs, each drawn in a unit box (0..1, y down; the shape sits in about 0.2..0.8) with a main
 * colour c and a secondary c2 (details such as a flap or a stripe). Draw one with glyph(), or put it on a tile
 * with appIcon({ glyph: "chat" }). A glyph can also be your own function with the same signature.
 */
import { font } from "./fonts";

type Ctx = CanvasRenderingContext2D;
export type GlyphFn = (ctx: Ctx, c: string, c2: string) => void;

const cache = new Map<string, Path2D>();
const path = (d: string) => {
  let p = cache.get(d);
  if (!p) cache.set(d, (p = new Path2D(d)));
  return p;
};
const F = (ctx: Ctx, d: string, c: string, rule: CanvasFillRule = "nonzero") => {
  ctx.fillStyle = c;
  ctx.fill(path(d), rule);
};
const S = (ctx: Ctx, d: string, c: string, w = 0.07) => {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(path(d));
};
const circle = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}Z`;
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
const star = (cx: number, cy: number, R: number, r: number, n = 5) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, q = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${(cx + q * Math.cos(a)).toFixed(4)} ${(cy + q * Math.sin(a)).toFixed(4)}`;
  }
  return d + "Z";
};
const gear = (cx: number, cy: number, R: number, r: number, teeth = 8) => {
  let d = "";
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, q = i % 4 < 2 ? R : r;
    d += `${i ? "L" : "M"}${(cx + q * Math.cos(a)).toFixed(4)} ${(cy + q * Math.sin(a)).toFixed(4)}`;
  }
  return d + "Z" + circle(cx, cy, r * 0.45);
};

export const GLYPHS = {
  chat: (ctx, c) => F(ctx, "M0.5 0.22C0.68 0.22 0.8 0.33 0.8 0.47C0.8 0.61 0.68 0.72 0.5 0.72C0.46 0.72 0.42 0.715 0.385 0.705L0.25 0.78L0.285 0.655C0.23 0.61 0.2 0.545 0.2 0.47C0.2 0.33 0.32 0.22 0.5 0.22Z", c),
  bubbles: (ctx, c) => {
    ctx.save();
    ctx.globalAlpha *= 0.55;
    F(ctx, "M0.6 0.2C0.72 0.2 0.81 0.28 0.81 0.38C0.81 0.43 0.79 0.47 0.76 0.5L0.78 0.58L0.69 0.54C0.66 0.55 0.63 0.56 0.6 0.56C0.48 0.56 0.39 0.48 0.39 0.38C0.39 0.28 0.48 0.2 0.6 0.2Z", c);
    ctx.restore();
    F(ctx, "M0.42 0.36C0.57 0.36 0.67 0.46 0.67 0.57C0.67 0.68 0.57 0.78 0.42 0.78C0.39 0.78 0.35 0.775 0.32 0.765L0.21 0.81L0.24 0.71C0.2 0.67 0.18 0.62 0.18 0.57C0.18 0.46 0.28 0.36 0.42 0.36Z", c);
  },
  bolt: (ctx, c) => {
    F(ctx, "M0.57 0.17L0.29 0.56H0.48L0.42 0.83L0.71 0.43H0.52L0.6 0.17Z", c);
    S(ctx, "M0.57 0.17L0.29 0.56H0.48L0.42 0.83L0.71 0.43H0.52L0.6 0.17Z", c, 0.04);
  },
  leaf: (ctx, c, c2) => {
    F(ctx, "M0.24 0.77C0.21 0.46 0.42 0.24 0.79 0.21C0.81 0.56 0.58 0.79 0.24 0.77Z", c);
    S(ctx, "M0.3 0.71C0.42 0.56 0.52 0.46 0.66 0.35", c2, 0.035);
  },
  wave: (ctx, c) => {
    const hs = [0.2, 0.4, 0.56, 0.36, 0.22];
    hs.forEach((h, i) => S(ctx, `M${0.26 + i * 0.12} ${0.5 - h / 2}V${0.5 + h / 2}`, c, 0.075));
  },
  spark: (ctx, c) => {
    F(ctx, "M0.46 0.2C0.49 0.43 0.56 0.5 0.79 0.53C0.56 0.56 0.49 0.63 0.46 0.86C0.43 0.63 0.36 0.56 0.13 0.53C0.36 0.5 0.43 0.43 0.46 0.2Z", c);
    F(ctx, "M0.74 0.16C0.75 0.245 0.765 0.255 0.85 0.265C0.765 0.275 0.75 0.285 0.74 0.37C0.73 0.285 0.715 0.275 0.63 0.265C0.715 0.255 0.73 0.245 0.74 0.16Z", c);
  },
  note: (ctx, c) => {
    S(ctx, "M0.43 0.66V0.27L0.73 0.21V0.6", c, 0.065);
    S(ctx, "M0.43 0.33L0.73 0.27", c, 0.11);
    ctx.fillStyle = c;
    for (const [x, y] of [[0.345, 0.67], [0.645, 0.61]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 0.1, 0.078, -0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  camera: (ctx, c) => {
    F(ctx, "M0.2 0.39Q0.2 0.32 0.27 0.32H0.36L0.41 0.25H0.59L0.64 0.32H0.73Q0.8 0.32 0.8 0.39V0.68Q0.8 0.75 0.73 0.75H0.27Q0.2 0.75 0.2 0.68Z" + circle(0.5, 0.535, 0.135), c, "evenodd");
    F(ctx, circle(0.5, 0.535, 0.075), c);
  },
  pin: (ctx, c) => F(ctx, "M0.5 0.83C0.5 0.83 0.25 0.57 0.25 0.42C0.25 0.28 0.36 0.18 0.5 0.18C0.64 0.18 0.75 0.28 0.75 0.42C0.75 0.57 0.5 0.83 0.5 0.83Z" + circle(0.5, 0.42, 0.1), c, "evenodd"),
  heart: (ctx, c) => F(ctx, "M0.5 0.79C0.5 0.79 0.19 0.6 0.19 0.4C0.19 0.29 0.27 0.22 0.37 0.22C0.44 0.22 0.48 0.26 0.5 0.3C0.52 0.26 0.56 0.22 0.63 0.22C0.73 0.22 0.81 0.29 0.81 0.4C0.81 0.6 0.5 0.79 0.5 0.79Z", c),
  calendar: (ctx, c, c2) => {
    ctx.save();
    ctx.scale(0.01, 0.01);
    ctx.textAlign = "center";
    ctx.fillStyle = c2;
    ctx.font = font("ui", 15, 600);
    ctx.fillText("TUE", 50, 31);
    ctx.fillStyle = c;
    ctx.font = font("ui", 46, 300);
    ctx.fillText("14", 50, 76);
    ctx.restore();
  },
  clock: (ctx, c) => {
    S(ctx, circle(0.5, 0.5, 0.28), c, 0.065);
    S(ctx, "M0.5 0.34V0.5L0.61 0.58", c, 0.065);
  },
  mail: (ctx, c, c2) => {
    F(ctx, rr(0.19, 0.29, 0.62, 0.42, 0.07), c);
    S(ctx, "M0.23 0.34L0.5 0.54L0.77 0.34", c2, 0.045);
  },
  play: (ctx, c) => F(ctx, "M0.38 0.28Q0.38 0.22 0.43 0.25L0.74 0.45Q0.79 0.5 0.74 0.55L0.43 0.75Q0.38 0.78 0.38 0.72Z", c),
  cloud: (ctx, c) => F(ctx, "M0.3 0.7C0.21 0.7 0.16 0.63 0.16 0.56C0.16 0.48 0.22 0.42 0.3 0.42C0.32 0.32 0.4 0.26 0.5 0.26C0.62 0.26 0.7 0.34 0.71 0.44C0.79 0.45 0.84 0.51 0.84 0.58C0.84 0.65 0.78 0.7 0.71 0.7Z", c),
  sun: (ctx, c) => {
    F(ctx, circle(0.5, 0.5, 0.15), c);
    let d = "";
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      d += `M${0.5 + 0.23 * Math.cos(a)} ${0.5 + 0.23 * Math.sin(a)}L${0.5 + 0.3 * Math.cos(a)} ${0.5 + 0.3 * Math.sin(a)}`;
    }
    S(ctx, d, c, 0.06);
  },
  moon: (ctx, c) => {
    // the disc (0.5, 0.52) r 0.3 minus a disc (0.63, 0.41) r 0.25: outer arc the long way, inner arc back
    const [x1, y1, R, x2, y2, r] = [0.5, 0.52, 0.3, 0.63, 0.41, 0.25];
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
    const px = x1 + (a * dx) / d, py = y1 + (a * dy) / d;
    const pA = [px - (h * dy) / d, py + (h * dx) / d], pB = [px + (h * dy) / d, py - (h * dx) / d];
    ctx.beginPath();
    ctx.arc(x1, y1, R, Math.atan2(pA[1] - y1, pA[0] - x1), Math.atan2(pB[1] - y1, pB[0] - x1) + Math.PI * 2, false);
    ctx.arc(x2, y2, r, Math.atan2(pB[1] - y2, pB[0] - x2), Math.atan2(pA[1] - y2, pA[0] - x2), true);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  },
  star: (ctx, c) => {
    F(ctx, star(0.5, 0.53, 0.31, 0.14), c);
    S(ctx, star(0.5, 0.53, 0.31, 0.14), c, 0.05);
  },
  chart: (ctx, c) => {
    ctx.fillStyle = c;
    [[0.22, 0.22], [0.43, 0.36], [0.64, 0.5]].forEach(([x, h]) => F(ctx, rr(x, 0.76 - h, 0.14, h, 0.05), c));
  },
  bag: (ctx, c) => {
    F(ctx, "M0.24 0.38H0.76L0.73 0.76Q0.72 0.81 0.67 0.81H0.33Q0.28 0.81 0.27 0.76Z", c);
    S(ctx, "M0.38 0.42V0.33Q0.38 0.21 0.5 0.21Q0.62 0.21 0.62 0.33V0.42", c, 0.06);
  },
  mic: (ctx, c) => {
    F(ctx, rr(0.415, 0.18, 0.17, 0.39, 0.085), c);
    S(ctx, "M0.32 0.48Q0.32 0.69 0.5 0.69Q0.68 0.69 0.68 0.48M0.5 0.69V0.8", c, 0.06);
  },
  bell: (ctx, c) => {
    F(ctx, "M0.5 0.2C0.63 0.2 0.7 0.3 0.7 0.43V0.58L0.78 0.68H0.22L0.3 0.58V0.43C0.3 0.3 0.37 0.2 0.5 0.2Z", c);
    F(ctx, circle(0.5, 0.75, 0.065), c);
  },
  search: (ctx, c) => {
    S(ctx, circle(0.45, 0.45, 0.19), c, 0.075);
    S(ctx, "M0.6 0.6L0.76 0.76", c, 0.09);
  },
  home: (ctx, c) => {
    F(ctx, "M0.5 0.2L0.81 0.48H0.72V0.78H0.57V0.61H0.43V0.78H0.28V0.48H0.19Z", c);
    S(ctx, "M0.5 0.2L0.81 0.48H0.72V0.78H0.57V0.61H0.43V0.78H0.28V0.48H0.19Z", c, 0.04);
  },
  user: (ctx, c) => F(ctx, circle(0.5, 0.36, 0.135) + "M0.23 0.8C0.23 0.63 0.35 0.54 0.5 0.54C0.65 0.54 0.77 0.63 0.77 0.8Z", c),
  plus: (ctx, c) => S(ctx, "M0.5 0.26V0.74M0.26 0.5H0.74", c, 0.09),
  check: (ctx, c) => S(ctx, "M0.27 0.52L0.43 0.67L0.74 0.34", c, 0.09),
  phone: (ctx, c) => F(ctx, "M0.34 0.2C0.29 0.2 0.21 0.27 0.21 0.34C0.21 0.58 0.42 0.79 0.66 0.79C0.73 0.79 0.8 0.71 0.8 0.66V0.6C0.8 0.57 0.78 0.55 0.75 0.54L0.65 0.51C0.62 0.5 0.59 0.51 0.57 0.53L0.53 0.57C0.46 0.53 0.42 0.49 0.38 0.42L0.42 0.38C0.44 0.36 0.45 0.33 0.44 0.3L0.41 0.21C0.4 0.19 0.38 0.2 0.34 0.2Z", c),
  wallet: (ctx, c, c2) => {
    F(ctx, rr(0.19, 0.29, 0.62, 0.46, 0.08), c);
    F(ctx, rr(0.56, 0.44, 0.25, 0.16, 0.05), c2);
  },
  book: (ctx, c, c2) => {
    F(ctx, "M0.5 0.3C0.42 0.25 0.3 0.24 0.19 0.27V0.75C0.3 0.72 0.42 0.73 0.5 0.78C0.58 0.73 0.7 0.72 0.81 0.75V0.27C0.7 0.24 0.58 0.25 0.5 0.3Z", c);
    S(ctx, "M0.5 0.31V0.76", c2, 0.03);
  },
  flame: (ctx, c) => F(ctx, "M0.5 0.17C0.56 0.32 0.72 0.4 0.72 0.58C0.72 0.71 0.62 0.81 0.5 0.81C0.38 0.81 0.28 0.71 0.28 0.58C0.28 0.48 0.34 0.42 0.39 0.37C0.4 0.45 0.44 0.49 0.48 0.5C0.47 0.38 0.47 0.28 0.5 0.17Z", c),
  drop: (ctx, c) => F(ctx, "M0.5 0.17C0.5 0.17 0.75 0.45 0.75 0.6C0.75 0.73 0.64 0.83 0.5 0.83C0.36 0.83 0.25 0.73 0.25 0.6C0.25 0.45 0.5 0.17 0.5 0.17Z", c),
  globe: (ctx, c) => {
    S(ctx, circle(0.5, 0.5, 0.29), c, 0.055);
    S(ctx, "M0.5 0.21C0.38 0.33 0.38 0.67 0.5 0.79C0.62 0.67 0.62 0.33 0.5 0.21M0.21 0.5H0.79M0.26 0.36H0.74M0.26 0.64H0.74", c, 0.045);
  },
  lock: (ctx, c, c2) => {
    F(ctx, rr(0.26, 0.45, 0.48, 0.35, 0.08), c);
    S(ctx, "M0.36 0.47V0.36Q0.36 0.21 0.5 0.21Q0.64 0.21 0.64 0.36V0.47", c, 0.07);
    F(ctx, circle(0.5, 0.6, 0.045), c2);
  },
  gear: (ctx, c) => F(ctx, gear(0.5, 0.5, 0.31, 0.24), c, "evenodd"),
  card: (ctx, c, c2) => {
    F(ctx, rr(0.17, 0.29, 0.66, 0.44, 0.07), c);
    F(ctx, "M0.17 0.38H0.83V0.46H0.17Z", c2);
    F(ctx, rr(0.24, 0.55, 0.16, 0.1, 0.025), c2);
  },
  pulse: (ctx, c) => S(ctx, "M0.17 0.53H0.33L0.41 0.32L0.54 0.73L0.62 0.47H0.83", c, 0.07),
  photo: (ctx, c) => {
    S(ctx, rr(0.19, 0.25, 0.62, 0.5, 0.08), c, 0.06);
    F(ctx, "M0.24 0.71L0.41 0.5L0.52 0.62L0.61 0.53L0.76 0.71Z", c);
    F(ctx, circle(0.63, 0.38, 0.06), c);
  },
  compass: (ctx, c) => {
    S(ctx, circle(0.5, 0.5, 0.29), c, 0.055);
    F(ctx, "M0.62 0.38L0.54 0.54L0.38 0.62L0.46 0.46Z", c);
  },
  grid: (ctx, c) => [[0.23, 0.23], [0.53, 0.23], [0.23, 0.53], [0.53, 0.53]].forEach(([x, y]) => F(ctx, rr(x, y, 0.24, 0.24, 0.07), c)),
  video: (ctx, c) => {
    F(ctx, rr(0.17, 0.31, 0.45, 0.38, 0.08), c);
    F(ctx, "M0.66 0.46L0.83 0.36V0.64L0.66 0.54Z", c);
  },
  smile: (ctx, c, c2) => {
    F(ctx, circle(0.5, 0.5, 0.3), c);
    F(ctx, circle(0.4, 0.44, 0.04) + circle(0.6, 0.44, 0.04), c2);
    S(ctx, "M0.38 0.58Q0.5 0.68 0.62 0.58", c2, 0.045);
  },
  plane: (ctx, c) => F(ctx, "M0.5 0.16C0.54 0.16 0.55 0.2 0.55 0.24V0.42L0.82 0.58V0.65L0.55 0.56V0.71L0.63 0.77V0.82L0.5 0.78L0.37 0.82V0.77L0.45 0.71V0.56L0.18 0.65V0.58L0.45 0.42V0.24C0.45 0.2 0.46 0.16 0.5 0.16Z", c),
  rings: (ctx, c) => {
    const arcs: [number, number][] = [[0.29, 0.82], [0.2, 0.68], [0.11, 0.9]];
    arcs.forEach(([r, f], i) => {
      ctx.save();
      ctx.globalAlpha *= 1 - i * 0.18;
      ctx.beginPath();
      ctx.arc(0.5, 0.5, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      ctx.strokeStyle = c;
      ctx.lineWidth = 0.07;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    });
  },
  cup: (ctx, c) => {
    F(ctx, "M0.23 0.4H0.67V0.6C0.67 0.71 0.59 0.79 0.48 0.79H0.42C0.31 0.79 0.23 0.71 0.23 0.6Z", c);
    S(ctx, "M0.68 0.46H0.71C0.77 0.46 0.8 0.5 0.8 0.55C0.8 0.6 0.76 0.64 0.7 0.64M0.37 0.2Q0.33 0.25 0.37 0.3M0.5 0.18Q0.46 0.24 0.5 0.3", c, 0.05);
  },
} satisfies Record<string, GlyphFn>;
export type GlyphName = keyof typeof GLYPHS;

/** Draw a glyph in the current unit space (used by appIcon). */
export const drawGlyph = (ctx: Ctx, g: GlyphName | GlyphFn, c: string, c2 = "rgba(0,0,0,0.2)") => {
  ctx.save();
  (typeof g === "string" ? GLYPHS[g] : g)(ctx, c, c2);
  ctx.restore();
};

/** Draw a glyph centred at (x, y) in a size x size box of the current space. */
export const glyph = (ctx: Ctx, g: GlyphName | GlyphFn, x: number, y: number, size: number, c: string, c2?: string) => {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size, size);
  drawGlyph(ctx, g, c, c2);
  ctx.restore();
};
