/**
 * Geometry QA: exactly coplanar, overlapping, same-facing faces. Two surfaces at the same depth z-fight whatever the
 * depth format (a window's front faces lay on the wall plane; a shrine interior was
 * as wide as its architrave). coplanarReport(scene) logs one "[qa] coplanar ..." line per offending pair of meshes;
 * <Shot> runs it once per shot when the render's input props carry qa: true (celstills.mjs --qa).
 */
import * as THREE from "three";
import { LAYER } from "./engine";

type P2 = [number, number];
type Tri = { m: number; p: [P2, P2, P2]; box: [number, number, number, number]; c: THREE.Vector3; a: number; col: number };

/** Triangles of one mesh that share a corner are neighbours (a quad's halves, a grid): never an overlap. */
const shareCorner = (A: Tri, B: Tri) => A.p.some((p) => B.p.some((q) => Math.abs(p[0] - q[0]) < 1e-4 && Math.abs(p[1] - q[1]) < 1e-4));

const area2 = (poly: P2[]) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
};

/** Area of the intersection of two triangles (Sutherland-Hodgman, B convex and counter-clockwise). */
function overlap(a: [P2, P2, P2], b: [P2, P2, P2]) {
  const ccw = (t: [P2, P2, P2]): [P2, P2, P2] => ((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]) < 0 ? [t[0], t[2], t[1]] : t);
  let out: P2[] = a.slice();
  const B = ccw(b);
  for (let i = 0; i < 3 && out.length; i++) {
    const [ax, ay] = B[i], [bx, by] = B[(i + 1) % 3];
    const side = (p: P2) => (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const P = inp[j], Q = inp[(j + 1) % inp.length];
      const sp = side(P), sq = side(Q);
      if (sp >= 0) out.push(P);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
    }
  }
  return out.length >= 3 ? area2(out) : 0;
}

const colourOf = (m: THREE.Mesh) => ((m.material as THREE.ShaderMaterial).uniforms?.uColor?.value as THREE.Color | undefined)?.getHexString() ?? "?";
const describe = (m: THREE.Mesh) => {
  const bb = new THREE.Box3().setFromObject(m);
  const s = bb.getSize(new THREE.Vector3());
  const big = Math.max(s.x, s.y, s.z) > 20;
  const f = (v: THREE.Vector3) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
  return `${m.name || "mesh"} #${colourOf(m)} size ${f(s)}${big ? "" : ` at ${f(bb.getCenter(new THREE.Vector3()))}`}`;
};

/**
 * Log coplanar overlaps (> minArea m², planes within 1 mm, normals within ~1.5 degrees, both facing the same way) that
 * can be seen: the two faces differ in colour (a duplicate, a seam or cloth folding back z-fights invisibly) and the
 * plane faces `camera` (two bottom faces on the floor never show).
 */
export function coplanarReport(scene: THREE.Scene, camera?: THREE.Camera, label = "", minArea = 0.0025) {
  const eye = camera ? camera.getWorldPosition(new THREE.Vector3()) : null;
  const meshes: THREE.Mesh[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || !m.visible || !m.layers.isEnabled(LAYER.BASE)) return;
    const mat = m.material as THREE.Material;
    if (Array.isArray(mat) || mat.transparent || mat.depthWrite === false || mat.blending !== THREE.NormalBlending) return;
    meshes.push(m);
  });
  const buckets = new Map<string, Tri[]>();
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  meshes.forEach((m, mi) => {
    const pos = m.geometry.getAttribute("position");
    if (!pos) return;
    const vcol = m.geometry.getAttribute("color");
    const base = parseInt(colourOf(m), 16) || 0;
    const idx = m.geometry.getIndex();
    const nt = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < nt; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      p0.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
      p1.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
      p2.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      n.crossVectors(e1.subVectors(p1, p0), e2.subVectors(p2, p0));
      const a = n.length() / 2;
      if (a < 1e-4) continue;
      n.normalize();
      if (eye && n.dot(e1.subVectors(eye, p0)) <= 0) continue;
      const d = n.dot(p0);
      // colour key: the material colour, times the vertex colour of a merged multi-colour mesh (quantised)
      const col = vcol ? base * 4096 + Math.round(vcol.getX(i0) * 15) * 256 + Math.round(vcol.getY(i0) * 15) * 16 + Math.round(vcol.getZ(i0) * 15) : base;
      const key = `${Math.round(n.x * 40)},${Math.round(n.y * 40)},${Math.round(n.z * 40)},${Math.round(d * 1000)}`;
      const u = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0).cross(n).normalize();
      const v = new THREE.Vector3().crossVectors(n, u);
      const to2 = (p: THREE.Vector3): P2 => [p.dot(u), p.dot(v)];
      const q: [P2, P2, P2] = [to2(p0), to2(p1), to2(p2)];
      const box: [number, number, number, number] = [Math.min(q[0][0], q[1][0], q[2][0]), Math.min(q[0][1], q[1][1], q[2][1]), Math.max(q[0][0], q[1][0], q[2][0]), Math.max(q[0][1], q[1][1], q[2][1])];
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push({ m: mi, p: q, box, c: p0.clone().add(p1).add(p2).multiplyScalar(1 / 3), a, col });
    }
  });
  const pairs = new Map<string, { area: number; at: THREE.Vector3 }>();
  buckets.forEach((list) => {
    if (list.length < 2) return;
    list.sort((A, B) => A.box[0] - B.box[0]);
    for (let i = 0; i < list.length; i++) {
      const A = list[i];
      for (let j = i + 1; j < list.length && list[j].box[0] < A.box[2]; j++) {
        const B = list[j];
        if (B.box[1] >= A.box[3] || B.box[3] <= A.box[1]) continue;
        if (A.col === B.col || (A.m === B.m && shareCorner(A, B))) continue;
        const ov = overlap(A.p, B.p);
        // floating-point slivers between neighbours are not overlaps: a real one covers part of the smaller triangle
        if (ov < 1e-4 || ov < 0.05 * Math.min(A.a, B.a)) continue;
        const k = A.m < B.m ? `${A.m}/${B.m}` : `${B.m}/${A.m}`;
        const r = pairs.get(k) ?? { area: 0, at: A.c };
        r.area += ov;
        pairs.set(k, r);
      }
    }
  });
  const bad = [...pairs.entries()].filter(([, r]) => r.area >= minArea).sort((a, b) => b[1].area - a[1].area);
  let shown = 0;
  bad.forEach(([k, r]) => {
    const [a, b] = k.split("/").map(Number);
    if (shown++ >= 12) return;
    const who = a === b ? `inside ${describe(meshes[a])}` : `${describe(meshes[a])} | ${describe(meshes[b])}`;
    console.warn(`[qa] coplanar${label ? ` ${label}` : ""}: ${(r.area * 1e4).toFixed(0)} cm2 near ${r.at.toArray().map((x) => x.toFixed(2))}: ${who}`);
  });
  return shown;
}
