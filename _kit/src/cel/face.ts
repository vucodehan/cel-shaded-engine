/**
 * Anime face features drawn as 2D vector art on a canvas, projected onto the head along +z (head space, metres).
 * Expression changes redraw the canvas (only when the expression key changes). The head shades with spherical
 * normals, so the face reads as clean anime planes while these drawn features carry the character.
 */
import * as THREE from "three";
import { clamp, lerp } from "./geo";

/**
 * Lip-sync mouth shapes, named as Rhubarb names the Preston Blair set: A closed (M B P), B teeth together (K S T EE),
 * C open (EH AE), D wide (AA), E round (AO ER), F pucker (UW OW W), G lip under the teeth (F V), H tongue up (L),
 * X rest (the plain mouth).
 */
export type Viseme = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "X";

export type Expr = {
  blink: number; // 0 open .. 1 closed
  closedStyle: "calm" | "happy"; // calm: downward arc (prayer, sleep); happy: upward arc
  lookX: number; // -1..1, + toward head +x
  lookY: number; // -1..1, + up
  brow: number; // -1 low/stern .. +1 raised
  sad: number; // 0..1 inner brow up
  smile: number; // -1..1
  open: number; // mouth open 0..1
  squint: number; // lower lid raise 0..1
  wide: number; // 0..1 surprise (bigger iris highlight, lids apart)
  tears: number; // 0..1
  light: number; // -1..1 key light side in head space (+x lit): puts the nose shadow on the other side
  blind: number; // 0..1 clouded eyes
  mouth?: Viseme; // lip-sync shape (lips() in human.ts); `open` is then the jaw drop inside it
};

export const EXPR0: Expr = { blink: 0, closedStyle: "calm", lookX: 0, lookY: 0, brow: 0, sad: 0, smile: 0, open: 0, squint: 0, wide: 0, tears: 0, light: 1, blind: 0 };

export type FaceStyle = {
  skin: string;
  skinShade: string;
  line: string; // lash line
  lid: string; // lower lid / crease
  irisTop: string;
  irisBot: string;
  pupil: string;
  brow: string;
  lip: string;
  eyeX: number; eyeY: number; eyeW: number; eyeH: number;
  tilt: number; // outer corner height (+ up, - kind droop), fraction of eyeH
  browY: number; browT: number;
  noseY: number;
  mouthY: number; mouthW: number;
  lash: number; // lash line thickness (m)
  lashes: boolean; // feminine lashes
  iris: number; // iris size multiplier
  age: number; // 0 young .. 1 old (lines)
  blush: number;
  /** decal rect in head space: cx, cy, width, height */
  rect: [number, number, number, number];
};

export const FACE_MALE: FaceStyle = {
  skin: "#e3ad86", skinShade: "#b77866", line: "#2a1612", lid: "#7a4a3c", irisTop: "#2e1a10", irisBot: "#8c5a30", pupil: "#140a06",
  brow: "#3a2316", lip: "#9a5248",
  eyeX: 0.0315, eyeY: -0.004, eyeW: 0.03, eyeH: 0.0145, tilt: -0.12, browY: 0.0205, browT: 0.0034, noseY: -0.044, mouthY: -0.071, mouthW: 0.0165,
  lash: 0.0021, lashes: false, iris: 1, age: 0.15, blush: 0.12, rect: [0, -0.034, 0.16, 0.19],
};

type P = [number, number];

/**
 * Open lip-sync shapes: half width (of mouthW), roundness (1 a pointed lens, 0.5 an oval), upper lip lift at the
 * centre (m), upper and lower teeth (fraction of the opening, capped at `cap` m), tongue (1 low, 2 raised to the teeth).
 */
const SHAPE: Record<Exclude<Viseme, "A" | "X">, { w: number; round: number; lift: number; teeth: number; low: number; cap: number; tongue: number }> = {
  B: { w: 0.88, round: 0.95, lift: 0.0004, teeth: 0.56, low: 0.34, cap: 0.003, tongue: 0 },
  C: { w: 0.8, round: 0.9, lift: 0.0007, teeth: 0.3, low: 0, cap: 0.0019, tongue: 1 },
  D: { w: 0.84, round: 0.85, lift: 0.0009, teeth: 0.2, low: 0, cap: 0.0019, tongue: 1 },
  E: { w: 0.58, round: 0.62, lift: 0.0015, teeth: 0.18, low: 0, cap: 0.0013, tongue: 1 },
  F: { w: 0.33, round: 0.5, lift: 0.0015, teeth: 0, low: 0, cap: 0, tongue: 0 },
  G: { w: 0.78, round: 1, lift: 0.0003, teeth: 0.85, low: 0, cap: 0.003, tongue: 0 },
  H: { w: 0.78, round: 0.9, lift: 0.0007, teeth: 0.25, low: 0, cap: 0.0017, tongue: 2 },
};

const cubic = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

export class Face {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  st: FaceStyle;
  ppm: number;
  key = "";
  constructor(style: FaceStyle, ppm = 9000) {
    this.st = style;
    this.ppm = ppm;
    const [, , w, h] = style.rect;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(w * ppm);
    this.canvas.height = Math.round(h * ppm);
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.anisotropy = 8;
    this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
  }
  /** head-space metres -> canvas px */
  X = (x: number) => (x - (this.st.rect[0] - this.st.rect[2] / 2)) * this.ppm;
  Y = (y: number) => (this.st.rect[1] + this.st.rect[3] / 2 - y) * this.ppm;
  m = (v: number) => v * this.ppm;

  set(e: Expr) {
    const q = (v: number) => Math.round(v * 40) / 40;
    const key = [e.blink, e.lookX, e.lookY, e.brow, e.sad, e.smile, e.open, e.squint, e.wide, e.tears, Math.sign(e.light), e.blind].map(q).join(",") + e.closedStyle + (e.mouth ?? "");
    if (key === this.key) return;
    this.key = key;
    this.draw(e);
    this.tex.needsUpdate = true;
  }

  private poly(pts: P[], fill: string, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.globalAlpha = 1;
  }

  private stroke(pts: P[], color: string, w: number, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
    c.strokeStyle = color;
    c.lineWidth = this.m(w);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.stroke();
    c.globalAlpha = 1;
  }

  /** Tapered band along pts with thickness profile th(t), offset to one side (normal pointing "up" of the path). */
  private band(pts: P[], th: (t: number) => number, color: string, alpha = 1, centre = false) {
    const up: P[] = [], dn: P[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      if (ny < 0) { nx = -nx; ny = -ny; }
      const t = th(i / (pts.length - 1));
      if (centre) {
        up.push([pts[i][0] + nx * t * 0.5, pts[i][1] + ny * t * 0.5]);
        dn.push([pts[i][0] - nx * t * 0.5, pts[i][1] - ny * t * 0.5]);
      } else {
        up.push([pts[i][0] + nx * t, pts[i][1] + ny * t]);
        dn.push(pts[i]);
      }
    }
    this.poly([...up, ...dn.reverse()], color, alpha);
  }

  private draw(e: Expr) {
    const c = this.ctx;
    const s = this.st;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.lineCap = "round";
    // cheek warmth
    if (s.blush > 0) {
      for (const sd of [-1, 1]) {
        const g = c.createRadialGradient(this.X(sd * (s.eyeX + 0.004)), this.Y(s.eyeY - 0.022), 0, this.X(sd * (s.eyeX + 0.004)), this.Y(s.eyeY - 0.022), this.m(0.017));
        g.addColorStop(0, `rgba(226,110,100,${0.42 * s.blush})`);
        g.addColorStop(1, "rgba(226,110,100,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
    // soft shade under the hairline (anime faces always carry the hair's shadow on the brow)
    const sc = new THREE.Color(s.skinShade);
    const rgba = (a: number) => `rgba(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)},${a})`;
    const hg = c.createLinearGradient(0, this.Y(s.browY + 0.04), 0, this.Y(s.browY + 0.012));
    hg.addColorStop(0, rgba(0.55));
    hg.addColorStop(1, rgba(0));
    c.fillStyle = hg;
    c.fillRect(0, 0, this.canvas.width, this.Y(s.browY + 0.012));
    this.nose(e);
    this.mouth(e);
    for (const sd of [-1, 1]) {
      this.eye(e, sd);
      this.brow(e, sd);
    }
    if (s.age > 0.3) this.ageLines(e);
  }

  private eye(e: Expr, sd: number) {
    const s = this.st;
    const c = this.ctx;
    const a = s.eyeW / 2;
    const h = s.eyeH * (1 + e.wide * 0.18);
    const ex = sd * s.eyeX, ey = s.eyeY;
    const E = (u: number, v: number): P => [ex + sd * u * a, ey + v * h];
    const tilt = s.tilt;
    const blink = clamp(e.blink);
    const squint = clamp(e.squint);
    // lids in eye space (u inner -1 .. outer +1, v in eye heights)
    const U0: P = [-1, -0.05], U3: P = [1, tilt];
    const L0 = U0, L3 = U3;
    const L1: P = [-0.45, -0.52 + squint * 0.32], L2: P = [0.55, -0.46 + squint * 0.3 + tilt * 0.5];
    const U1o: P = [-0.55, 0.62], U2o: P = [0.5, 0.68 + tilt * 0.4];
    const lowAt = (u: number) => {
      // approximate lower lid v at u
      const t = (u + 1) / 2;
      return cubic(L0, L1, L2, L3, t)[1];
    };
    const U1: P = [U1o[0], lerp(U1o[1], lowAt(U1o[0]) + 0.04, blink)];
    const U2: P = [U2o[0], lerp(U2o[1], lowAt(U2o[0]) + 0.04, blink)];
    const N = 28;
    const upper: P[] = [], lower: P[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      upper.push(E(...cubic(U0, U1, U2, U3, t)));
      lower.push(E(...cubic(L0, L1, L2, L3, t)));
    }
    if (blink > 0.82) {
      // closed: a single lash arc
      const k = e.closedStyle === "happy" ? 1 : -1;
      const arc: P[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const u = lerp(-1, 1, t);
        arc.push(E(u, -0.08 + tilt * t + k * 0.32 * Math.sin(Math.PI * t)));
      }
      this.band(arc, (t) => s.lash * (0.35 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.15))), s.line, 1, true);
      if (s.lashes) for (let i = 0; i < 3; i++) this.stroke([arc[N - i * 3], [arc[N - i * 3][0] + sd * 0.002, arc[N - i * 3][1] - 0.0028]], s.line, s.lash * 0.35);
      if (e.tears > 0) this.tear(e, sd, ex, ey);
      return;
    }
    // opening clip
    c.save();
    c.beginPath();
    [...upper, ...lower.slice().reverse()].forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
    c.closePath();
    c.clip();
    // sclera
    c.fillStyle = "#fbf5ee";
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // iris
    const ir = a * 0.42 * s.iris * (1 + e.wide * 0.05);
    const iry = h * 0.66 * s.iris;
    const ix = ex + sd * a * 0.06 + e.lookX * a * 0.42;
    const iy = ey + h * 0.06 + e.lookY * h * 0.22;
    const blind = clamp(e.blind);
    const g = c.createLinearGradient(0, this.Y(iy + iry), 0, this.Y(iy - iry));
    g.addColorStop(0, blind > 0.5 ? "#8d8a90" : s.irisTop);
    g.addColorStop(0.55, blind > 0.5 ? "#b9b6bb" : s.irisBot);
    g.addColorStop(1, blind > 0.5 ? "#d7d4d8" : lighten(s.irisBot, 0.35));
    c.beginPath();
    c.ellipse(this.X(ix), this.Y(iy), this.m(ir), this.m(iry), 0, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = this.m(0.0006);
    c.strokeStyle = blind > 0.5 ? "#7b7880" : s.pupil;
    c.stroke();
    if (blind < 0.5) {
      // pupil
      c.beginPath();
      c.ellipse(this.X(ix), this.Y(iy + iry * 0.04), this.m(ir * 0.46), this.m(iry * 0.5), 0, 0, Math.PI * 2);
      c.fillStyle = s.pupil;
      c.fill();
      // lower iris glow crescent
      c.beginPath();
      c.ellipse(this.X(ix), this.Y(iy - iry * 0.42), this.m(ir * 0.62), this.m(iry * 0.3), 0, 0, Math.PI * 2);
      c.fillStyle = lighten(s.irisBot, 0.55);
      c.globalAlpha = 0.55;
      c.fill();
      c.globalAlpha = 1;
    } else {
      c.globalAlpha = 0.55;
      c.fillStyle = "#e9e6ea";
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.globalAlpha = 1;
    }
    // shadow of the upper lid on the eye
    const sh: P[] = upper.map(([x, y]) => [x, y] as P);
    const shDn: P[] = upper.map(([x, y]) => [x, y - h * 0.3] as P);
    this.poly([...sh, ...shDn.reverse()], "#5b4060", 0.32);
    // highlights
    if (blind < 0.5) {
      const lx = Math.sign(e.light || 1);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.ellipse(this.X(ix + lx * ir * 0.34), this.Y(iy + iry * 0.3), this.m(ir * (0.27 + e.wide * 0.06)), this.m(iry * 0.2), 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(this.X(ix - lx * ir * 0.32), this.Y(iy - iry * 0.32), this.m(ir * 0.11), this.m(ir * 0.11), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // crease above the lid
    const crease: P[] = [];
    for (let i = 4; i <= N - 2; i++) {
      const t = i / N;
      const [u, v] = cubic(U0, U1o, U2o, U3, t);
      crease.push(E(u * 0.96, v + 0.42 - blink * 0.25));
    }
    this.stroke(crease, s.lid, 0.00055, 0.7);
    // upper lash line: thick, tapered at the inner corner, a flick past the outer corner
    const lashPts = upper.slice();
    const last = upper[N];
    lashPts.push([last[0] + sd * a * 0.16, last[1] - h * 0.12]);
    this.band(lashPts, (t) => s.lash * (0.25 + 0.95 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.08)), 0.6)), s.line);
    if (s.lashes) {
      for (let i = 0; i < 3; i++) {
        const p = upper[N - 1 - i * 3];
        this.stroke([p, [p[0] + sd * 0.0024, p[1] + 0.0022 - i * 0.0004]], s.line, s.lash * 0.4);
      }
    }
    // lower lid line, outer part
    const low = lower.slice(Math.round(N * 0.45));
    this.band(low, (t) => 0.00085 * Math.sin(Math.PI * Math.min(1, t * 1.1)), s.lid, 0.9, true);
    if (e.tears > 0) this.tear(e, sd, ex, ey);
  }

  private tear(e: Expr, sd: number, ex: number, ey: number) {
    const s = this.st;
    const pts: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([ex + sd * (s.eyeW * 0.15 + t * 0.002), ey - s.eyeH * 0.55 - t * 0.03 * e.tears]);
    }
    this.band(pts, (t) => 0.0016 * (1 - t * 0.5), "#e8f4ff", 0.8 * e.tears, true);
  }

  private brow(e: Expr, sd: number) {
    const s = this.st;
    const a = s.eyeW / 2;
    const ex = sd * s.eyeX;
    const y0 = s.browY + e.brow * 0.004 + e.wide * 0.003;
    const inner: P = [ex - sd * a * 1.02, y0 - 0.0012 + e.sad * 0.0045 - Math.max(0, -e.brow) * 0.002];
    const mid: P = [ex + sd * a * 0.15, y0 + 0.0022 + e.sad * 0.001];
    const outer: P = [ex + sd * a * 1.32, y0 - 0.0035 - e.sad * 0.002];
    const pts: P[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const u = 1 - t;
      pts.push([u * u * inner[0] + 2 * u * t * mid[0] + t * t * outer[0], u * u * inner[1] + 2 * u * t * mid[1] + t * t * outer[1]]);
    }
    this.band(pts, (t) => s.browT * (1 - t * 0.78) * Math.min(1, 0.55 + t * 6), s.brow, 1, true);
  }

  private nose(e: Expr) {
    const s = this.st;
    const sh = -Math.sign(e.light || 1); // shadow side
    // soft shadow wedge on the shadow side of the bridge and tip
    this.poly(
      [
        [sh * 0.0025, s.eyeY - 0.004],
        [sh * 0.0105, s.noseY + 0.004],
        [sh * 0.007, s.noseY - 0.003],
        [sh * 0.001, s.noseY - 0.0025],
        [sh * 0.001, s.noseY + 0.01],
      ],
      this.st.skinShade,
      0.42,
    );
    // tip line on the shadow side and a nostril dash
    this.stroke([[sh * 0.0062, s.noseY + 0.0055], [sh * 0.0058, s.noseY + 0.0005], [sh * 0.0028, s.noseY - 0.0022]], s.lid, 0.0007, 0.85);
    this.stroke([[-sh * 0.0032, s.noseY - 0.0024], [-sh * 0.0012, s.noseY - 0.0029]], s.lid, 0.0006, 0.5);
  }

  private mouth(e: Expr) {
    if (e.mouth && e.mouth !== "X") {
      this.viseme(e, e.mouth);
      return;
    }
    const s = this.st;
    const w = s.mouthW * (1 + e.smile * 0.12);
    const y = s.mouthY;
    const sm = e.smile;
    const open = clamp(e.open);
    if (open > 0.05) {
      const top: P[] = [], bot: P[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = lerp(-w * 0.8, w * 0.8, t);
        const k = Math.sin(Math.PI * t);
        top.push([x, y + sm * 0.002 * (1 - k) + 0.0006 * k]);
        bot.push([x, y + sm * 0.002 * (1 - k) - k * (0.0035 + open * 0.0095)]);
      }
      this.poly([...top, ...bot.reverse()], "#4a1b1d");
      const teeth: P[] = top.slice(3, 14).map(([x, yy]) => [x, yy] as P);
      this.poly([...teeth, ...teeth.slice().reverse().map(([x, yy]) => [x, yy - 0.0016 - open * 0.0008] as P)], "#f6efe8", 0.95);
      this.stroke(top, "#5a2622", 0.0007);
    } else {
      const pts: P[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = lerp(-w, w, t);
        const k = Math.sin(Math.PI * t);
        pts.push([x, y + sm * 0.0026 * (1 - k) - sm * 0.0008 * k + (sm < 0 ? -sm * 0.0016 * k : 0)]);
      }
      this.band(pts, (t) => 0.00105 * (0.45 + 0.55 * Math.sin(Math.PI * t)), "#5b2723", 0.92, true);
    }
    // lower lip hint
    this.stroke([[-w * 0.35, y - 0.0068 - open * 0.009], [w * 0.35, y - 0.0068 - open * 0.009]], this.st.skinShade, 0.0009, 0.55);
  }

  /** A lip-sync shape in the plain mouth's ink and colours: `open` drops the jaw, smile and frown bend the corners. */
  private viseme(e: Expr, v: Exclude<Viseme, "X">) {
    const s = this.st;
    const c = this.ctx;
    const sm = clamp(e.smile, -1, 1);
    const w = s.mouthW * (1 + sm * 0.12);
    const y = s.mouthY;
    if (v === "A") {
      // lips pressed: the closed line a little shorter and heavier, the lower lip rolled up under it
      const pts: P[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const k = Math.sin(Math.PI * t);
        pts.push([lerp(-w * 0.9, w * 0.9, t), y + sm * 0.0026 * (1 - k) - sm * 0.0008 * k + (sm < 0 ? -sm * 0.0016 * k : 0)]);
      }
      this.band(pts, (t) => 0.0013 * (0.5 + 0.5 * Math.sin(Math.PI * t)), "#5b2723", 0.95, true);
      this.stroke([[-w * 0.3, y - 0.0052], [w * 0.3, y - 0.0052]], s.skinShade, 0.001, 0.6);
      return;
    }
    const S = SHAPE[v];
    const hw = w * S.w;
    const depth = Math.min(0.0145, (0.0012 + 0.0128 * clamp(e.open)) * (1 + Math.max(0, sm) * 0.2));
    const lift = S.lift * (1 - Math.max(0, sm) * 0.5) + Math.max(0, -sm) * 0.0012;
    const corner = sm * 0.0022 * S.round;
    const N = 24;
    const top: P[] = [], bot: P[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const k = Math.sin(Math.PI * t);
      const yc = y + corner * (1 - k);
      top.push([lerp(-hw, hw, t), yc + lift * Math.pow(k, S.round)]);
      bot.push([lerp(-hw, hw, t), yc - depth * Math.pow(k, S.round)]);
    }
    const rim = [...top, ...bot.slice().reverse()];
    this.poly(rim, "#4a1b1d");
    c.save();
    c.beginPath();
    rim.forEach(([x, yy], i) => (i ? c.lineTo(this.X(x), this.Y(yy)) : c.moveTo(this.X(x), this.Y(yy))));
    c.closePath();
    c.clip();
    const tongue = (cy: number, rx: number, ry: number) => {
      c.beginPath();
      c.ellipse(this.X(0), this.Y(cy), this.m(rx), this.m(ry), 0, 0, Math.PI * 2);
      c.fillStyle = "#a6464d";
      c.fill();
    };
    if (S.tongue) tongue(y - depth * 0.82, hw * 0.62, depth * 0.36);
    if (S.tongue === 2) tongue(y - depth * 0.45, hw * 0.34, depth * 0.5);
    const wide = S.teeth > 0.5;
    const inner = (pts: P[]) => pts.slice(Math.round(N * (wide ? 0.06 : 0.12)), Math.round(N * (wide ? 0.94 : 0.88)) + 1);
    if (S.teeth > 0) {
      const th = Math.min(S.teeth * depth, S.cap);
      const up = inner(top);
      this.poly([...up, ...up.slice().reverse().map(([x, yy]) => [x, yy - th] as P)], "#f6efe8", 0.95);
    }
    if (S.low > 0) {
      const tl = Math.min(S.low * depth, S.cap);
      const dn = inner(bot);
      this.poly([...dn, ...dn.slice().reverse().map(([x, yy]) => [x, yy + tl] as P)], "#e6dbd0", 0.95);
    }
    c.restore();
    this.stroke(top, "#5a2622", 0.0007);
    if (S.round < 0.8) this.stroke([...rim, rim[0]], "#5a2622", v === "F" ? 0.0009 : 0.0006, 0.8);
    // lower lip hint (tucked up under the teeth for F/V)
    const ly = y - depth - (v === "G" ? 0.0018 : 0.003);
    const lw = Math.min(w * 0.35, hw * 0.75);
    this.stroke([[-lw, ly], [lw, ly]], s.skinShade, 0.0009, 0.55);
  }

  private ageLines(e: Expr) {
    const s = this.st;
    const k = (s.age - 0.3) / 0.7;
    for (const sd of [-1, 1]) {
      const ex = sd * s.eyeX;
      // under-eye
      this.stroke([[ex - sd * 0.008, s.eyeY - 0.0105], [ex + sd * 0.004, s.eyeY - 0.0118], [ex + sd * 0.011, s.eyeY - 0.0095]], s.lid, 0.0005, 0.5 * k);
      // crow's feet
      for (let i = 0; i < 2; i++) this.stroke([[ex + sd * 0.019, s.eyeY + 0.001 - i * 0.004], [ex + sd * 0.024, s.eyeY + 0.0025 - i * 0.006]], s.lid, 0.0004, 0.45 * k);
      // nasolabial fold
      this.stroke([[sd * 0.012, s.noseY + 0.002], [sd * 0.019, s.noseY - 0.012], [sd * 0.021, s.mouthY - 0.004]], s.lid, 0.0006, 0.45 * k);
    }
    // forehead
    for (let i = 0; i < 2; i++) this.stroke([[-0.016, s.browY + 0.012 + i * 0.006], [0, s.browY + 0.0135 + i * 0.006], [0.016, s.browY + 0.012 + i * 0.006]], s.lid, 0.00045, 0.35 * k);
  }
}

function lighten(hex: string, k: number) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color("#ffffff"), k);
  return `#${c.getHexString()}`;
}
