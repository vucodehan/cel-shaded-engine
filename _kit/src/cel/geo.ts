/** Procedural geometry: seeded noise, swept tubes/ribbons, lathes, deformers, merges. Units are metres. */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const gauss = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash3 = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth value noise in [-1, 1]. */
export function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const v = (a: number, b: number, c: number) => hash3(ix + a, iy + b, iz + c);
  const x00 = lerp(v(0, 0, 0), v(1, 0, 0), ux), x10 = lerp(v(0, 1, 0), v(1, 1, 0), ux);
  const x01 = lerp(v(0, 0, 1), v(1, 0, 1), ux), x11 = lerp(v(0, 1, 1), v(1, 1, 1), ux);
  return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz) * 2 - 1;
}
export const noise2 = (x: number, y: number) => noise3(x, y, 0.5);
export function fbm(x: number, y: number, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

/** Catmull-Rom path through points. */
export const path = (pts: THREE.Vector3[], closed = false) => new THREE.CatmullRomCurve3(pts, closed, "centripetal");

export type SweepOpts = {
  /** radius across (x) and through (y) of the cross-section as functions of t in 0..1 */
  rx: (t: number) => number;
  ry?: (t: number) => number;
  radial?: number;
  segs?: number;
  /** reference "up" for the frame; the cross-section's y axis tries to align with it */
  up?: THREE.Vector3;
  twist?: (t: number) => number;
  /** per-ring offset of the cross-section shape (e.g. hem waves) */
  ripple?: (t: number, a: number) => number;
  cap?: boolean;
  /** per-point up (overrides `up`), e.g. the outward normal of the head under a hair lock */
  upFn?: (t: number, p: THREE.Vector3) => THREE.Vector3;
};

/**
 * Sweep an elliptical cross-section along a curve. uv.x = t along the curve (0 root, 1 tip), uv.y = angle 0..1.
 * Frames come from the curve tangent and `up`, so a flat ribbon keeps facing `up` (hair locks lie on the head).
 */
export function sweep(curve: THREE.Curve<THREE.Vector3>, o: SweepOpts) {
  const radial = o.radial ?? 10;
  const segs = o.segs ?? 24;
  const up0 = (o.up ?? V3(0, 1, 0)).clone().normalize();
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const T = V3(), B = V3(), N = V3(), p = V3();
  let prevN: THREE.Vector3 | null = null;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, T).normalize();
    // normal: projection of up onto the plane perpendicular to T (parallel transport fallback)
    const upv = o.upFn ? o.upFn(t, p).clone().normalize() : up0;
    N.copy(upv).addScaledVector(T, -upv.dot(T));
    if (N.lengthSq() < 1e-6) N.copy(prevN ?? V3(1, 0, 0)).addScaledVector(T, -(prevN ?? V3(1, 0, 0)).dot(T));
    N.normalize();
    if (prevN && N.dot(prevN) < 0) N.negate();
    prevN = N.clone();
    B.crossVectors(T, N).normalize();
    const tw = o.twist ? o.twist(t) : 0;
    const rx = o.rx(t), ry = o.ry ? o.ry(t) : rx;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2 + tw;
      const rip = o.ripple ? o.ripple(t, a) : 0;
      const cx = Math.cos(a) * (rx + rip), cy = Math.sin(a) * (ry + rip * 0.3);
      pos.push(p.x + B.x * cx + N.x * cy, p.y + B.y * cx + N.y * cy, p.z + B.z * cx + N.z * cy);
      // ellipse normal
      const nx = Math.cos(a) / Math.max(rx, 1e-5), ny = Math.sin(a) / Math.max(ry, 1e-5);
      const l = Math.hypot(nx, ny) || 1;
      nor.push((B.x * nx + N.x * ny) / l, (B.y * nx + N.y * ny) / l, (B.z * nx + N.z * ny) / l);
      uv.push(t, j / radial);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * row + j, b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (o.cap) {
    const caps = [0, segs].map((i) => {
      const t = i / segs;
      const c = curve.getPointAt(t);
      const r = Math.max(o.rx(t), o.ry ? o.ry(t) : 0);
      const s = new THREE.SphereGeometry(Math.max(r, 1e-4), radial, 6);
      s.translate(c.x, c.y, c.z);
      return s;
    });
    return merge([g, ...caps]);
  }
  return g;
}

/** Taper helpers for sweeps. */
export const taper = (r0: number, r1: number, pow = 1) => (t: number) => lerp(r0, r1, Math.pow(t, pow));
export const lock = (r: number, tipPow = 1.6, rootK = 0.75) => (t: number) => r * Math.min(1, rootK + t * 3) * Math.pow(1 - t, 1 / tipPow) + 0.0006;

/** Lathe around Y from [radius, y] pairs, with an optional per-vertex deformer. */
export function lathe(profile: [number, number][], segs = 32, deform?: (p: THREE.Vector3, a: number, t: number) => void) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  const g = new THREE.LatheGeometry(pts, segs);
  if (deform) {
    const pos = g.getAttribute("position");
    const v = V3();
    const ys = profile.map((p) => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const a = Math.atan2(v.x, v.z);
      deform(v, a, (v.y - y0) / Math.max(1e-6, y1 - y0));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Apply fn to every vertex position, then recompute normals (merging seams first for smooth results). */
export function deform(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, i: number) => void, smooth = true) {
  const pos = g.getAttribute("position");
  const v = V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  if (smooth) g.computeVertexNormals();
  return g;
}

export function merge(gs: THREE.BufferGeometry[]) {
  const norm = gs.map((g) => {
    let x = g.index ? g : g;
    // every part needs the same attribute set
    if (!x.getAttribute("uv")) {
      const n = x.getAttribute("position").count;
      x.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    if (!x.index) x = mergeVertices(x);
    for (const k of Object.keys(x.attributes)) if (!["position", "normal", "uv", "color", "aBias", "aLineK"].includes(k)) x.deleteAttribute(k);
    return x;
  });
  const keys = ["color", "aBias", "aLineK"];
  for (const k of keys) {
    if (norm.some((g) => g.getAttribute(k))) {
      norm.forEach((g) => {
        if (!g.getAttribute(k)) {
          const n = g.getAttribute("position").count;
          const size = k === "color" ? 3 : 1;
          const arr = new Float32Array(n * size).fill(k === "color" ? 1 : 0);
          g.setAttribute(k, new THREE.Float32BufferAttribute(arr, size));
        }
      });
    }
  }
  const m = mergeGeometries(norm, false);
  if (!m) throw new Error("merge failed");
  return m;
}

/** Fill a per-vertex float attribute from a function of position. */
export function vattr(g: THREE.BufferGeometry, name: string, fn: (p: THREE.Vector3) => number) {
  const pos = g.getAttribute("position");
  const a = new Float32Array(pos.count);
  const v = V3();
  for (let i = 0; i < pos.count; i++) a[i] = fn(v.fromBufferAttribute(pos, i));
  g.setAttribute(name, new THREE.BufferAttribute(a, 1));
  return g;
}

/** Per-vertex colour from a function of position. */
export function vcolor(g: THREE.BufferGeometry, fn: (p: THREE.Vector3) => THREE.Color) {
  const pos = g.getAttribute("position");
  const a = new Float32Array(pos.count * 3);
  const v = V3();
  for (let i = 0; i < pos.count; i++) {
    const c = fn(v.fromBufferAttribute(pos, i));
    a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}

export const rbox = (w: number, h: number, d: number, r = 0.02, segs = 3) => new RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
export const sphere = (r: number, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs);
export const capsule = (r: number, len: number, cs = 6, rs = 14) => new THREE.CapsuleGeometry(r, len, cs, rs);
export const cyl = (rt: number, rb: number, h: number, rs = 16, hs = 1, open = false) => new THREE.CylinderGeometry(rt, rb, h, rs, hs, open);

/** Blobby cluster: spheres merged and lumped by noise (foliage, clouds, rocks). */
export function cluster(balls: [number, number, number, number][], seed = 1, lump = 0.12, detail = 2) {
  const gs = balls.map(([x, y, z, r], i) => {
    let s: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, detail);
    s.deleteAttribute("uv");
    s.deleteAttribute("normal");
    s = mergeVertices(s);
    const o = seed * 13.1 + i * 3.7;
    deform(s, (p) => {
      const n = noise3(p.x / r * 1.3 + o, p.y / r * 1.3, p.z / r * 1.3);
      p.multiplyScalar(1 + n * lump);
    });
    s.translate(x, y, z);
    return s;
  });
  return merge(gs);
}

/** Noise-displaced rock: flat-shaded look comes from the material (flat: true). */
export function rock(r: number, seed = 1, sx = 1, sy = 0.7, sz = 1) {
  const g = new THREE.IcosahedronGeometry(r, 2);
  deform(g, (p) => {
    const n = noise3(p.x * 2.1 / r + seed, p.y * 2.1 / r, p.z * 2.1 / r) * 0.22 + noise3(p.x * 5 / r, p.y * 5 / r + seed, p.z * 5 / r) * 0.07;
    p.multiplyScalar(1 + n);
    p.set(p.x * sx, Math.max(p.y * sy, -r * 0.25), p.z * sz);
  });
  return g;
}
