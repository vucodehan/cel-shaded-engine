/**
 * Heads: a sculpted sphere (cranium, V-jaw, chin, small anime nose, brow, lips) in head space (metres, face +z,
 * origin at the head centre), plus ears, neck, hair styles built from swept locks over a cap, beard shells,
 * mustache and veils. Geometry is cached by style key: build once per tab, reuse in every shot.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { V3, clamp, cluster, gauss, lerp, lock, merge, noise3, path, rng, sstep, sweep } from "./geo";
import { FaceStyle } from "./face";

export type HeadShape = {
  w: number; top: number; chin: number; front: number; back: number;
  jaw: number; chinFwd: number; nose: number; child?: boolean;
};

export const HEAD_MAN: HeadShape = { w: 0.074, top: 0.114, chin: 0.124, front: 0.094, back: 0.1, jaw: 1, chinFwd: 0.028, nose: 0.0115 };
export const HEAD_WOMAN: HeadShape = { w: 0.07, top: 0.11, chin: 0.115, front: 0.09, back: 0.096, jaw: 1.25, chinFwd: 0.022, nose: 0.008 };
export const HEAD_CHILD: HeadShape = { w: 0.072, top: 0.112, chin: 0.098, front: 0.09, back: 0.098, jaw: 0.7, chinFwd: 0.014, nose: 0.005, child: true };

const CACHE = new Map<string, THREE.BufferGeometry>();
export function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = CACHE.get(key);
  if (!g) {
    g = make();
    g.userData.keep = true;
    CACHE.set(key, g);
  }
  return g;
}

/** Map a unit-sphere direction to the sculpted head surface. */
export function headPoint(q: THREE.Vector3, h: HeadShape, f: FaceStyle) {
  const { x, y, z } = q;
  const lower = y < 0;
  let X = x * h.w;
  let Y = y * (lower ? h.chin : h.top);
  let Z = z * (z > 0 ? h.front : h.back);
  const ty = Math.max(0, -y);
  if (lower) {
    X *= 1 - h.jaw * 0.2 * sstep(0.42, 1.0, ty);
    if (z > 0) Z += h.chinFwd * sstep(0.32, 0.95, ty) * Math.pow(z, 0.7) * (1 - 0.5 * Math.abs(x));
    if (z < 0) Z *= 1 - 0.3 * sstep(0.12, 0.85, ty);
  }
  if (z > 0) Z -= h.front * 0.075 * sstep(0.55, 1.0, z);
  if (z > 0.25) {
    const top = f.eyeY + 0.006;
    const tt = clamp((top - Y) / (top - f.noseY));
    const above = Y > top ? gauss(Y - top, 0.005) : 1;
    const below = Y < f.noseY ? gauss(Y - f.noseY, 0.0035) : 1;
    const prof = (0.12 + 0.88 * Math.pow(tt, 1.5)) * above * below;
    const sig = 0.0035 + 0.0045 * tt;
    Z += h.nose * prof * gauss(X, sig) * sstep(0.25, 0.8, z);
  }
  if (z > 0) {
    Z += 0.003 * gauss(Y - (f.browY - 0.002), 0.008) * sstep(0.2, 0.7, z) * gauss(X, 0.045);
    Z -= 0.003 * gauss(Math.abs(X) - f.eyeX, 0.011) * gauss(Y - f.eyeY, 0.008) * sstep(0.3, 0.8, z);
    Z += 0.0026 * gauss(X, 0.013) * gauss(Y - (f.mouthY - 0.002), 0.0055);
  }
  X *= 1 + 0.03 * gauss(y + 0.12, 0.2) * sstep(0.1, 0.7, z);
  return V3(X, Y, Z);
}

export function headGeo(h: HeadShape, f: FaceStyle, res = 220) {
  return cached(`head:${JSON.stringify(h)}:${f.eyeY}:${f.noseY}:${f.mouthY}:${f.eyeX}:${res}`, () => {
    let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, res, Math.round(res * 0.75));
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    g = mergeVertices(g);
    const pos = g.getAttribute("position");
    const v = V3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const p = headPoint(v, h, f);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
    return g;
  });
}

export function earGeo(h: HeadShape) {
  return cached(`ear:${h.w}`, () => {
    const parts = [-1, 1].map((sd) => {
      const s = new THREE.SphereGeometry(1, 16, 12);
      s.scale(0.007, 0.027, 0.016);
      s.rotateY(sd * 0.35);
      s.translate(sd * h.w * 0.97, -0.012, -0.014);
      return s;
    });
    return merge(parts);
  });
}

/** Outward offset of the head surface (cap shells). */
function shellPoint(q: THREE.Vector3, h: HeadShape, f: FaceStyle, off: number) {
  const p = headPoint(q, h, f);
  const n = V3(p.x / (h.w * h.w), p.y / ((p.y < 0 ? h.chin : h.top) ** 2), p.z / ((p.z > 0 ? h.front : h.back) ** 2)).normalize();
  return p.addScaledVector(n, off);
}

/** A shell over the head kept where keep(q, p) is true (hair caps, veils). */
function shell(h: HeadShape, f: FaceStyle, off: number, keep: (q: THREE.Vector3, p: THREE.Vector3) => boolean, res = 120) {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, res, Math.round(res * 0.75));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = mergeVertices(g);
  const pos = g.getAttribute("position");
  const flags: boolean[] = [];
  const v = V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const p = shellPoint(v, h, f, off);
    flags.push(keep(v.clone(), p));
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  const idx = g.getIndex()!;
  const out: number[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    if (flags[a] && flags[b] && flags[c]) out.push(a, b, c);
  }
  g.setIndex(out);
  g.computeVertexNormals();
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
  return g;
}

/** "covered": the hair under a veil or head cloth, a thin fringe in the face opening only (Human picks it). */
export type HairKind = "long" | "short" | "curly" | "child" | "elder" | "wild" | "none" | "veiled" | "woman" | "covered";

/** Hairline for caps: true where hair grows. */
function hairKeep(kind: HairKind, h: HeadShape) {
  return (q: THREE.Vector3, p: THREE.Vector3) => {
    const ax = Math.abs(p.x) / h.w;
    const long = kind === "long" || kind === "wild" || kind === "woman";
    // hairline by azimuth (0 = forehead centre, 90 = over the ear): forehead, temple, sideburn, behind the ear
    const az = Math.abs(Math.atan2(p.x, p.z)) / (Math.PI / 180);
    const yh =
      az < 40 ? lerp(h.top * 0.46, h.top * 0.4, az / 40)
      : az < 66 ? lerp(h.top * 0.4, h.top * 0.28, (az - 40) / 26)
      : az < 80 ? lerp(h.top * 0.28, -0.02, sstep(66, 80, az))
      : lerp(-0.02, -h.chin * (long ? 0.55 : 0.42), sstep(80, 110, az));
    if (p.y < yh) return false;
    void ax;
    return true;
  };
}

type LockSpec = { side: number; alpha: number; len: number; w: number; th: number; spread: number; wave: number; front: number; seed: number };

/**
 * A lock rooted at the part line (or crown), hugging the head down to about ear level, then falling.
 * alpha: where on the part (radians, + toward the face). len: fall length below the head centre (m).
 */
function hairLock(h: HeadShape, f: FaceStyle, s: LockSpec, off: number) {
  const R = rng(s.seed);
  const pts: THREE.Vector3[] = [];
  const root = V3(s.side * 0.05, Math.cos(s.alpha), Math.sin(s.alpha)).normalize();
  const side = V3(s.side, -0.15, Math.sin(s.alpha) * 0.25 + s.front * 0.15 - 0.1).normalize();
  const K = 6;
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    const q = root.clone().lerp(side, sstep(0, 1, t) * s.spread + t * (1 - s.spread)).normalize();
    pts.push(shellPoint(q, h, f, off + 0.004 + t * 0.006));
  }
  const last = pts[pts.length - 1].clone();
  const out = V3(last.x, 0, last.z).normalize();
  const F = 6;
  for (let k = 1; k <= F; k++) {
    const t = k / F;
    const p = last.clone();
    p.y = lerp(last.y, -s.len, t);
    const flare = 0.012 + t * 0.03;
    p.addScaledVector(out, flare * t + Math.sin(t * Math.PI * 1.5 + s.seed) * s.wave);
    p.z += s.front * t * 0.02 + (R() - 0.5) * 0.006;
    // fall behind the jaw line so profiles stay readable
    p.z = Math.min(p.z, lerp(last.z, -0.016 + s.front * 0.03, sstep(0, 0.35, t)));
    if (Math.abs(p.x) < h.w + 0.02 && p.z > -0.02 && p.y < -0.06) p.x = Math.sign(p.x || s.side) * (h.w + 0.02 + t * 0.02);
    pts.push(p);
  }
  const c = path(pts);
  return sweep(c, {
    rx: lock(s.w, 1.4, 0.7),
    ry: lock(s.th, 1.4, 0.8),
    radial: 8,
    segs: 30,
    upFn: (t, p) => (t < 0.45 ? V3(p.x / h.w, p.y / h.top, p.z / h.front) : V3(p.x, 0, p.z)),
  });
}

/** Short lock: from root over the scalp, ends near the hairline or nape (men, children). */
function shortLock(h: HeadShape, f: FaceStyle, dir: THREE.Vector3, flow: THREE.Vector3, len: number, w: number, off: number, curl = 0) {
  const pts: THREE.Vector3[] = [];
  const K = 6;
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    const q = dir.clone().lerp(flow, t * len).normalize();
    const p = shellPoint(q, h, f, off + 0.006 * Math.sin(Math.PI * t) + 0.003);
    if (curl) p.addScaledVector(V3(q.x, q.y, q.z), curl * Math.sin(t * Math.PI * 2) * 0.004);
    pts.push(p);
  }
  return sweep(path(pts), { rx: lock(w, 1.2, 0.8), ry: lock(w * 0.32, 1.2, 0.8), radial: 7, segs: 16, upFn: (_t, p) => V3(p.x / h.w, p.y / h.top, p.z / h.front) });
}

export function hairGeo(kind: HairKind, h: HeadShape, f: FaceStyle, seed = 1, len = 0.25) {
  return cached(`hair:${kind}:${JSON.stringify(h)}:${seed}:${len}`, () => {
    if (kind === "none") return new THREE.BufferGeometry();
    if (kind === "covered") {
      // a full cap 4.5 mm off the scalp (a veil sits at 14-26 mm): only the part in the face opening shows, so no
      // scalp is ever visible between the hairline and the cloth (a forehead-only band read as a bald head)
      return shell(h, f, 0.0045, hairKeep("short", h));
    }
    const off = kind === "curly" ? 0.004 : 0.007;
    const parts: THREE.BufferGeometry[] = [];
    if (kind !== "veiled") parts.push(shell(h, f, off, hairKeep(kind, h)));
    const R = rng(seed);
    if (kind === "long" || kind === "wild" || kind === "woman") {
      const wild = kind === "wild" ? 1 : 0;
      for (const side of [-1, 1]) {
        const n = 17;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const alpha = lerp(1.0, -1.3, t);
          const front = t < 0.22 ? 1 - t / 0.22 : 0;
          parts.push(
            hairLock(h, f, {
              side, alpha, len: len * lerp(0.9, 1.08, R()) * (front ? 0.93 : 1) + wild * R() * 0.05,
              w: 0.0165 - front * 0.002, th: 0.0048, spread: lerp(0.75, 1, R()), wave: 0.005 + wild * 0.012, front: front * 0.5, seed: seed * 31 + i * 7 + (side > 0 ? 101 : 0),
            }, off),
          );
        }
      }
      // back locks covering the nape
      for (let i = 0; i < 9; i++) {
        const sx = lerp(-0.9, 0.9, i / 8);
        parts.push(
          hairLock(h, f, { side: sx, alpha: -1.4 - R() * 0.2, len: len * 1.02, w: 0.021, th: 0.0055, spread: 0.6, wave: 0.005, front: -0.2, seed: seed * 17 + i }, off),
        );
      }
    } else if (kind === "short" || kind === "child" || kind === "elder") {
      // elders keep a full head of (grey) hair: a shaved crown read as an unexplained bald patch
      const n = 22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const crown = V3(Math.cos(a) * 0.25, 0.95, Math.sin(a) * 0.25 - 0.1).normalize();
        const front = Math.sin(a) > 0.3;
        const child = kind === "child";
        const flow = front ? V3(Math.cos(a) * 0.32, child ? 0.04 : 0.12, 1).normalize() : V3(Math.cos(a), -0.5, Math.sin(a) * 0.8).normalize();
        parts.push(shortLock(h, f, crown, flow, front ? (child ? 0.86 : 0.82) : 0.95, child ? 0.03 : 0.026, off, child ? 1 : 0));
      }
    } else if (kind === "curly") {
      const balls: [number, number, number, number][] = [];
      for (let i = 0; i < 70; i++) {
        const q = V3(R() * 2 - 1, R() * 1.3 - 0.25, R() * 2 - 1).normalize();
        const p = shellPoint(q, h, f, 0.008);
        if (!hairKeep("short", h)(q, p)) continue;
        balls.push([p.x, p.y, p.z, 0.014 + R() * 0.008]);
      }
      parts.push(cluster(balls, seed, 0.15, 1));
    }
    return merge(parts);
  });
}

export type BeardKind = "none" | "full" | "short" | "long" | "wild" | "stubble";

/** Beard shell + mustache: hugs the jaw from sideburn to sideburn, leaves the mouth, comes to a soft point. */
export function beardGeo(kind: BeardKind, h: HeadShape, f: FaceStyle, seed = 1) {
  return cached(`beard:${kind}:${JSON.stringify(h)}:${seed}`, () => {
    if (kind === "none" || kind === "stubble") return new THREE.BufferGeometry();
    const ext = kind === "long" ? 0.05 : kind === "wild" ? 0.07 : kind === "full" ? 0.017 : 0.008;
    const thick = kind === "short" ? 0.0035 : kind === "full" ? 0.0055 : 0.008;
    const U = 56, Vn = 22;
    const pos: number[] = [], idx: number[] = [];
    const cheek = (u: number) => {
      const au = Math.abs(u);
      // y of the beard's upper edge by azimuth (rad): under the lip, around the mouth corners, up the cheek, sideburn
      if (au < 0.32) return f.mouthY - 0.0085 + sstep(0.12, 0.32, au) * 0.013;
      if (au < 0.75) return lerp(f.mouthY + 0.0045, f.noseY - 0.004, sstep(0.32, 0.75, au));
      return lerp(f.noseY - 0.004, 0.008, sstep(0.75, 1.5, au));
    };
    for (let i = 0; i <= U; i++) {
      const u = lerp(-1.62, 1.62, i / U);
      const y0 = cheek(u);
      for (let j = 0; j <= Vn; j++) {
        const v = j / Vn;
        const yTarget = lerp(y0, -h.chin * 0.97, v);
        const th = Math.asin(clamp(-yTarget / (yTarget < 0 ? h.chin : h.top), -0.99, 0.99));
        const q = V3(Math.sin(u) * Math.cos(th), -Math.sin(th), Math.cos(u) * Math.cos(th));
        const p = shellPoint(q, h, f, 0.0025 + thick * sstep(0, 0.35, v) * (0.6 + 0.4 * Math.cos(u)));
        const fr = Math.max(0, Math.cos(u));
        const tip = ext * Math.pow(fr, 2.2) * sstep(0.5, 1, v);
        const zig = 1 + 0.28 * Math.sin(u * 11 + seed) * sstep(0.7, 1, v);
        p.y -= tip * zig;
        p.z += tip * 0.35 * fr;
        if (kind === "wild") p.addScaledVector(V3(q.x, 0, q.z), noise3(u * 3 + seed, v * 3, 1) * 0.006 * v);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < U; i++)
      for (let j = 0; j < Vn; j++) {
        const a = i * (Vn + 1) + j, b = a + Vn + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const parts: THREE.BufferGeometry[] = [g];
    for (const sd of [-1, 1]) {
      const at = (x: number, y: number, dz: number) => {
        const q = V3(x / h.w, y / h.chin, 0.9).normalize();
        const p = headPoint(q, h, f);
        return V3(x, y, p.z + dz);
      };
      const m = path([at(sd * 0.001, f.noseY - 0.0095, 0.0016), at(sd * 0.011, f.mouthY + 0.0058, 0.0021), at(sd * 0.021, f.mouthY + 0.0012, 0.0018), at(sd * 0.0275, f.mouthY - 0.0075, 0.0014)]);
      parts.push(sweep(m, { rx: (t) => 0.0068 * (1 - t * 0.55) + 0.0012, ry: (t) => 0.0021 * (1 - t * 0.3), radial: 8, segs: 14, upFn: () => V3(0, 0.25, 1) }));
    }
    return merge(parts);
  });
}

/** Veil / head cloth: a hood shell open at the face, falling to the shoulders. */
export function veilGeo(h: HeadShape, f: FaceStyle, drop = 0.3, open = 0.62) {
  return cached(`veil:${JSON.stringify(h)}:${drop}:${open}`, () => {
    const U = 64, Vn = 34;
    const pos: number[] = [], idx: number[] = [];
    // u: azimuth from one face edge around the back to the other; v: top to the hem
    const a0 = open;
    for (let i = 0; i <= U; i++) {
      const a = lerp(a0, Math.PI * 2 - a0, i / U);
      for (let j = 0; j <= Vn; j++) {
        const v = j / Vn;
        let p: THREE.Vector3;
        if (v < 0.55) {
          const el = lerp(Math.PI / 2 * 0.98, -0.25, v / 0.55);
          const q = V3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el));
          p = shellPoint(q, h, f, 0.02 + 0.006 * Math.sin(v * 9));
        } else {
          const t = (v - 0.55) / 0.45;
          const el = -0.25;
          const q = V3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el));
          const base = shellPoint(q, h, f, 0.02);
          const out = V3(Math.sin(a), 0, Math.cos(a));
          p = base.clone();
          p.y = lerp(base.y, -drop, t);
          p.addScaledVector(out, t * 0.12 + 0.01 * Math.sin(a * 7) * t);
          if (Math.cos(a) > 0.2) p.z -= 0.02 * t;
        }
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < U; i++)
      for (let j = 0; j < Vn; j++) {
        const a = i * (Vn + 1) + j, b = a + Vn + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

export function neckGeo(r = 0.047, len = 0.17) {
  return cached(`neck:${r}:${len}`, () => {
    const g = new THREE.CylinderGeometry(r * 0.93, r * 1.08, len, 24, 4, true);
    g.translate(0, len / 2, 0);
    return g;
  });
}
