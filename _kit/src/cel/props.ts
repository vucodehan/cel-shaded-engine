/** Person-scale props (metres, resting on y = 0 unless noted). Each returns a Group ready to place. */
import * as THREE from "three";
import { V3, capsule, cyl, lathe, lerp, merge, path, rbox, rng, rock, sweep } from "./geo";
import { HullOpts, inkOf, mesh, toon } from "./toon";
import { cached } from "./head";

const H = (c: string, w = 2.2): HullOpts => ({ color: inkOf(c, 0.32), width: w, distRef: 3.5 });
const WOOD = "#a07a52", WOOD_D = "#7a5a3c", STONE = "#cbbda4", CLAY = "#c08a5e", IRON = "#5a5a60";
const grp = (...o: THREE.Object3D[]) => {
  const g = new THREE.Group();
  o.forEach((x) => g.add(x));
  return g;
};

export function plank(len = 1.6, w = 0.22, t = 0.04, color = WOOD) {
  return mesh(cached(`plank:${len}:${w}:${t}`, () => rbox(len, t, w, 0.008)), toon({ color, th: 0.5, paint: 0.3, paintScale: 9 }), { hull: H(color), cast: true });
}

export function workbench(o: { w?: number; d?: number; h?: number } = {}) {
  const w = o.w ?? 2.0, d = o.d ?? 0.62, h = o.h ?? 0.86;
  const m = toon({ color: WOOD, th: 0.5, paint: 0.3, paintScale: 6 });
  const top = mesh(cached(`benchTop:${w}:${d}`, () => rbox(w, 0.09, d, 0.012)), m, { hull: H(WOOD), cast: true });
  top.position.y = h - 0.045;
  const g = grp(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(cached(`benchLeg:${h}`, () => rbox(0.09, h - 0.09, 0.09, 0.01)), m, { hull: H(WOOD), cast: true });
    leg.position.set(x * (w / 2 - 0.12), (h - 0.09) / 2, z * (d / 2 - 0.08));
    g.add(leg);
  }
  const rail = mesh(cached(`benchRail:${w}`, () => rbox(w - 0.3, 0.07, 0.05, 0.01)), m, { hull: H(WOOD) });
  rail.position.set(0, 0.22, 0);
  g.add(rail);
  return g;
}

export function hammer() {
  const handle = mesh(cached("hamH", () => { const g = cyl(0.013, 0.016, 0.3, 8); g.translate(0, 0.15, 0); return g; }), toon({ color: WOOD, th: 0.5 }), { hull: H(WOOD, 1.8) });
  const head = mesh(cached("hamHd", () => { const g = rbox(0.12, 0.04, 0.04, 0.008); g.translate(0, 0.3, 0); return g; }), toon({ color: IRON, th: 0.5, spec: 0.7, specTh: 0.93, hi: "#e8e8f0" }), { hull: H(IRON, 1.8) });
  return grp(handle, head);
}

export function saw() {
  const blade = mesh(cached("sawB", () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.55, 0.02); s.lineTo(0.55, 0.07); s.lineTo(0, 0.12); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false }); g.translate(0.08, -0.06, 0); return g; }), toon({ color: "#9aa0a8", th: 0.5, spec: 0.8, specTh: 0.9 }), { hull: H(IRON, 1.6) });
  const handle = mesh(cached("sawH", () => rbox(0.12, 0.13, 0.03, 0.01)), toon({ color: WOOD_D, th: 0.5 }), { hull: H(WOOD_D, 1.6) });
  return grp(blade, handle);
}

export function chisel() {
  const h = mesh(cached("chH", () => { const g = cyl(0.014, 0.012, 0.14, 8); g.translate(0, 0.07, 0); return g; }), toon({ color: WOOD_D, th: 0.5 }), { hull: H(WOOD_D, 1.6) });
  const b = mesh(cached("chB", () => { const g = rbox(0.02, 0.12, 0.006, 0.002); g.translate(0, -0.06, 0); return g; }), toon({ color: "#8e939c", th: 0.5, spec: 0.8, specTh: 0.9 }), { hull: H(IRON, 1.4) });
  return grp(h, b);
}

/** Curled wood shavings scattered on a surface (merged). */
export function shavings(n = 18, area = 0.6, seed = 3) {
  const R = rng(seed);
  const g = cached(`shav:${n}:${area}:${seed}`, () =>
    merge(
      Array.from({ length: n }, () => {
        const pts: THREE.Vector3[] = [];
        const r = 0.02 + R() * 0.02;
        for (let i = 0; i <= 10; i++) {
          const a = i * 0.9;
          pts.push(V3(Math.cos(a) * r * (1 - i * 0.05), 0.012 + Math.sin(a) * r * (1 - i * 0.05), i * 0.006));
        }
        const s = sweep(path(pts), { rx: () => 0.012, ry: () => 0.0012, radial: 4, segs: 12 });
        s.rotateY(R() * 6.28);
        s.translate((R() - 0.5) * area, 0, (R() - 0.5) * area * 0.6);
        return s;
      }),
    ),
  );
  return mesh(g, toon({ color: "#e2c08e", th: 0.45 }), { hull: H("#e2c08e", 1.2) });
}

/** Stone water jar (John 2): ~0.85 m. Returns the group and the liquid material (lerp water -> wine). */
export function stoneJar(o: { h?: number; seed?: number } = {}) {
  const h = o.h ?? 0.85;
  const geo = cached(`jar:${h}`, () => lathe([[0.001, 0], [0.18, 0.02], [0.25, h * 0.35], [0.24, h * 0.7], [0.17, h * 0.92], [0.19, h], [0.16, h], [0.15, h * 0.93]], 36));
  const jar = mesh(geo, toon({ color: STONE, th: 0.48, paint: 0.25, paintScale: 8, side: THREE.DoubleSide }), { hull: H(STONE), cast: true });
  const liquidM = toon({ color: "#7fb3c9", shade: "#5a86a8", th: 0.4, spec: 0.8, specTh: 0.95, hi: "#ffffff" });
  const liquid = mesh(cached("jarLiquid", () => { const g = new THREE.CircleGeometry(0.152, 28); g.rotateX(-Math.PI / 2); return g; }), liquidM, { hull: false });
  liquid.position.y = h * 0.9;
  const g = grp(jar, liquid);
  g.userData.solid = { outer: [[0.001, 0], [0.18, 0.02], [0.25, h * 0.35], [0.24, h * 0.7], [0.17, h * 0.92], [0.19, h]], inner: [[0.15, h * 0.9], [0.15, h * 0.93], [0.16, h]] };
  g.userData.footprint = 0.25;
  return { group: g, liquidM, top: h };
}

export function cup(color = CLAY) {
  return mesh(cached("cup", () => lathe([[0.001, 0], [0.03, 0.005], [0.045, 0.06], [0.05, 0.1], [0.044, 0.1], [0.038, 0.06], [0.02, 0.012]], 20)), toon({ color, th: 0.48, side: THREE.DoubleSide }), { hull: H(color, 1.8) });
}

/** Clay oil lamp; the flame is a glow sprite added by fx.flame(). */
export function oilLamp() {
  return mesh(cached("lamp", () => { const g = lathe([[0.001, 0], [0.05, 0.01], [0.06, 0.03], [0.03, 0.045], [0.012, 0.05]], 18); g.scale(1, 1, 1.4); return g; }), toon({ color: CLAY, th: 0.5 }), { hull: H(CLAY, 1.8) });
}

export function table(o: { w?: number; d?: number; h?: number; color?: string; cloth?: string } = {}) {
  const w = o.w ?? 1.8, d = o.d ?? 0.8, h = o.h ?? 0.75;
  const c = o.color ?? WOOD;
  const m = toon({ color: c, th: 0.5, paint: 0.25, paintScale: 5 });
  const g = grp();
  const top = mesh(cached(`tTop:${w}:${d}`, () => rbox(w, 0.06, d, 0.01)), m, { hull: H(c), cast: true });
  top.position.y = h - 0.03;
  g.add(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(cached(`tLeg:${h}`, () => rbox(0.07, h - 0.06, 0.07, 0.01)), m, { hull: H(c) });
    leg.position.set(x * (w / 2 - 0.08), (h - 0.06) / 2, z * (d / 2 - 0.08));
    g.add(leg);
  }
  if (o.cloth) {
    const cm = toon({ color: o.cloth, th: 0.5, th2: 0.2 });
    const cl = mesh(cached(`tCloth:${w}:${d}:${h}`, () => { const g2 = rbox(w + 0.06, h * 0.55, d + 0.06, 0.02); g2.translate(0, -h * 0.55 / 2, 0); return g2; }), cm, { hull: H(o.cloth) });
    cl.position.y = h + 0.005;
    g.add(cl);
  }
  return g;
}

export function loaf(color = "#c98c4a") {
  return mesh(cached("loaf", () => { const g = new THREE.SphereGeometry(0.075, 18, 12); g.scale(1, 0.45, 1); g.translate(0, 0.03, 0); return g; }), toon({ color, shade: "#8d5a3c", th: 0.45, spec: 0.4, specTh: 0.96, hi: "#f5d8a0" }), { hull: H(color, 1.8) });
}

export function fish(color = "#9aa4ab") {
  const body = cached("fish", () => {
    const b = new THREE.SphereGeometry(0.06, 16, 10);
    b.scale(2.2, 0.75, 0.45);
    const t = new THREE.ConeGeometry(0.045, 0.07, 3);
    t.rotateZ(Math.PI / 2);
    t.scale(1, 1, 0.3);
    t.translate(-0.16, 0, 0);
    return merge([b, t]);
  });
  return mesh(body, toon({ color, shade: "#6a6a86", th: 0.45, spec: 0.8, specTh: 0.94 }), { hull: H(color, 1.6) });
}

export function basket(o: { r?: number; h?: number; full?: boolean } = {}) {
  const r = o.r ?? 0.22, h = o.h ?? 0.2;
  const c = "#b88a4e";
  const b = mesh(cached(`basket:${r}:${h}`, () => lathe([[0.001, 0], [r * 0.75, 0.005], [r, h * 0.8], [r * 1.04, h], [r * 0.98, h], [r * 0.93, h * 0.8], [r * 0.7, 0.02]], 28, (p, a, t) => { p.multiplyScalar(1 + Math.sin(a * 24) * 0.012 * (t < 0.85 ? 1 : 0)); })), toon({ color: c, th: 0.48, side: THREE.DoubleSide, paint: 0.35, paintScale: 30 }), { hull: H(c, 1.8) });
  const g = grp(b);
  // walls for the contact pass (hands stay out of the wicker) and the footprint that clears the grass under it
  g.userData.solid = { outer: [[0.001, 0], [r * 0.75, 0.005], [r, h * 0.8], [r * 1.04, h]], inner: [[r * 0.7, 0.012], [r * 0.93, h * 0.8], [r * 0.98, h]] };
  // a little wider than the base: blades rooted right beside it lean across the wicker
  g.userData.footprint = r * 1.3;
  if (o.full) {
    const R = rng(Math.round(r * 1000));
    for (let i = 0; i < 7; i++) {
      const l = loaf();
      l.position.set((R() - 0.5) * r, h * 0.78 + R() * 0.04, (R() - 0.5) * r);
      l.rotation.set(R() * 0.4, R() * 6, R() * 0.4);
      l.scale.setScalar(0.8);
      g.add(l);
    }
  }
  return g;
}

/** The basin's inner wall, [radius, height] from the floor to the rim (local metres): for contain.ts and water. */
export const BASIN_INNER: [number, number][] = [[0.19, 0.018], [0.218, 0.035], [0.243, 0.1], [0.262, 0.16]];
/** Its outer wall, floor to rim: what kneeling or sitting bodies beside it must clear (contain.clearOf). */
export const BASIN_OUTER: [number, number][] = [[0.2, 0.004], [0.235, 0.03], [0.26, 0.1], [0.28, 0.16]];
/**
 * Copper basin with a water surface; rim at y 0.16. A flat floor 0.38 m across with low sloped walls: two adult feet
 * stand in it side by side (the old bowl was 0.18 m across at the floor, so feet cut through its walls).
 */
export function basin() {
  const c = "#b8743e";
  const b = mesh(cached("basin2", () => lathe([[0.001, 0], ...BASIN_OUTER, ...[...BASIN_INNER].reverse(), [0.001, 0.018]], 40)), toon({ color: c, th: 0.45, spec: 0.8, specTh: 0.93, hi: "#ffe0b0", side: THREE.DoubleSide }), { hull: H(c) });
  const w = mesh(cached("basinW", () => { const g = new THREE.CircleGeometry(0.235, 28); g.rotateX(-Math.PI / 2); g.translate(0, 0.12, 0); return g; }), toon({ color: "#9cc3cf", shade: "#6c96ad", th: 0.4, spec: 0.9, specTh: 0.95 }), { hull: false });
  const g = grp(b, w);
  g.userData.solid = { outer: [[0.001, 0], ...BASIN_OUTER], inner: BASIN_INNER };
  g.userData.footprint = 0.28;
  return g;
}

export function pitcher() {
  const c = CLAY;
  const body = mesh(cached("pitch", () => lathe([[0.001, 0], [0.07, 0.01], [0.11, 0.12], [0.08, 0.24], [0.05, 0.28], [0.065, 0.31], [0.055, 0.31]], 24)), toon({ color: c, th: 0.48, side: THREE.DoubleSide }), { hull: H(c, 2) });
  const handle = mesh(cached("pitchH", () => { const g = new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI * 1.2); g.rotateZ(-Math.PI * 0.35); g.translate(0.1, 0.2, 0); return g; }), toon({ color: c, th: 0.48 }), { hull: H(c, 1.8) });
  const g = grp(body, handle);
  g.userData.solid = { outer: [[0.001, 0], [0.07, 0.01], [0.11, 0.12], [0.08, 0.24], [0.05, 0.28], [0.065, 0.31]] };
  g.userData.footprint = 0.11;
  return g;
}

/** Folded towel hanging (as worn at the waist it is drawn by the look; this is the cloth in hand). */
export function towel(color = "#efe9dc") {
  return mesh(cached("towel", () => sweep(path([V3(0, 0, 0), V3(0.02, -0.15, 0.02), V3(-0.01, -0.32, 0.0)]), { rx: () => 0.12, ry: () => 0.008, radial: 8, segs: 10, ripple: (t, a) => 0.006 * t * Math.sin(a * 3) })), toon({ color, th: 0.5, th2: 0.25, side: THREE.DoubleSide }), { hull: H(color, 2) });
}

/** Sleeping mat with four ropes rising to `ropeH` (0 = no ropes). */
export function mat(o: { len?: number; ropeH?: number } = {}) {
  const len = o.len ?? 1.9, c = "#c9ad74";
  const g = grp(mesh(cached(`mat:${len}`, () => rbox(0.75, 0.05, len, 0.02)), toon({ color: c, th: 0.48, paint: 0.4, paintScale: 25 }), { hull: H(c), cast: true }));
  if (o.ropeH) {
    const rm = toon({ color: "#8a7350", th: 0.5 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const r = mesh(new THREE.CylinderGeometry(0.008, 0.008, o.ropeH, 5), rm, { hull: { color: "#3a2a18", width: 1.4 } });
      r.position.set(x * 0.36, o.ropeH / 2, z * (len / 2 - 0.05));
      g.add(r);
    }
  }
  return g;
}

export function stone(r = 0.05, seed = 2) {
  return mesh(rock(r, seed, 1, 0.8, 1), toon({ color: "#a89c8a", shade: "#6c667a", th: 0.5, flat: true }), { hull: H("#a89c8a", 1.8), cast: true });
}

export function coin(color = "#e0b75a") {
  return mesh(cached("coin", () => { const g = cyl(0.012, 0.012, 0.003, 14); return g; }), toon({ color, shade: "#a07a3a", th: 0.45, spec: 1, specTh: 0.9, hi: "#fff6c8" }), { hull: H(color, 1.2) });
}

export function moneyBag() {
  const c = "#8a5e3c";
  const b = mesh(cached("bag", () => lathe([[0.001, 0], [0.08, 0.01], [0.11, 0.07], [0.08, 0.14], [0.03, 0.17], [0.05, 0.2]], 20, (p, a) => { p.x *= 1 + Math.sin(a * 5) * 0.05; })), toon({ color: c, th: 0.5, side: THREE.DoubleSide }), { hull: H(c, 2) });
  return b;
}

/** A field flower: "lily" (white trumpet) or "anemone" (red cup). Single geometry for instancing. */
export function flowerGeo(kind: "lily" | "anemone") {
  return cached(`flower:${kind}`, () => {
    const stem = cyl(0.004, 0.005, 0.32, 5);
    stem.translate(0, 0.16, 0);
    const petals: THREE.BufferGeometry[] = [];
    const n = kind === "lily" ? 6 : 6;
    for (let i = 0; i < n; i++) {
      const p = new THREE.SphereGeometry(kind === "lily" ? 0.028 : 0.024, 8, 6);
      p.scale(0.45, 1, 0.25);
      p.translate(0, kind === "lily" ? 0.03 : 0.022, 0);
      p.rotateX(kind === "lily" ? 0.9 : 0.6);
      p.rotateY((i / n) * Math.PI * 2);
      p.translate(0, 0.33, 0);
      petals.push(p);
    }
    const c = new THREE.SphereGeometry(0.008, 6, 4);
    c.translate(0, 0.34, 0);
    return merge([stem, ...petals, c]);
  });
}

/** Dove / bird: body + two wings (flap 0..1 phase via setFlap). White dove by default. */
export function bird(color = "#f7f5f0", s = 1) {
  const m = toon({ color, shade: "#aeb4d0", th: 0.42, rim: 1.5 });
  const hl = { color: inkOf(color, 0.35), width: 2 };
  const body = mesh(cached("birdBody", () => { const g = new THREE.SphereGeometry(0.06, 14, 10); g.scale(0.8, 0.75, 1.7); const h = new THREE.SphereGeometry(0.035, 12, 8); h.translate(0, 0.035, 0.1); const t = new THREE.ConeGeometry(0.04, 0.09, 4); t.rotateX(-Math.PI / 2); t.scale(1, 0.25, 1); t.translate(0, 0, -0.13); return merge([g, h, t]); }), m, { hull: hl });
  const wingGeo = cached("birdWing", () => { const g = new THREE.SphereGeometry(0.1, 12, 6); g.scale(1.3, 0.08, 0.55); g.translate(0.12, 0, -0.01); return g; });
  const wl = new THREE.Group(), wr = new THREE.Group();
  wl.add(mesh(wingGeo, m, { hull: hl }));
  const right = mesh(wingGeo, m, { hull: hl });
  right.scale.x = -1;
  wr.add(right);
  wl.position.set(0.03, 0.02, 0);
  wr.position.set(-0.03, 0.02, 0);
  const g = grp(body, wl, wr);
  g.scale.setScalar(s);
  return {
    group: g,
    flap: (ph: number) => {
      const a = Math.sin(ph * Math.PI * 2) * 0.9;
      wl.rotation.z = a;
      wr.rotation.z = -a;
    },
  };
}

export function torch() {
  const stick = mesh(cached("torchS", () => { const g = cyl(0.018, 0.022, 0.7, 8); g.translate(0, -0.25, 0); return g; }), toon({ color: WOOD_D, th: 0.5 }), { hull: H(WOOD_D, 1.8) });
  return stick;
}

/** Distant cross silhouette (house style: only far, dark, never close). */
export function crossSil(h = 3.2, color = "#2a2026") {
  const m = toon({ color, shade: color, th: 0.5, rim: 0.4 });
  const v = mesh(cached(`crossV:${h}`, () => { const g = rbox(0.18, h, 0.16, 0.01); g.translate(0, h / 2, 0); return g; }), m, { hull: false });
  const hb = mesh(cached(`crossH:${h}`, () => { const g = rbox(1.6, 0.16, 0.15, 0.01); g.translate(0, h * 0.78, 0); return g; }), m, { hull: false });
  return grp(v, hb);
}

/** Linen grave clothes lying folded (finale). */
export function graveClothes() {
  const c = "#efe9de";
  const a = mesh(cached("gcA", () => { const g = rbox(0.5, 0.1, 1.4, 0.05); g.translate(0, 0.05, 0); return g; }), toon({ color: c, th: 0.5, th2: 0.25 }), { hull: H(c) });
  const b = mesh(cached("gcB", () => { const g = rbox(0.3, 0.07, 0.25, 0.03); g.translate(0, 0.035, 0.85); return g; }), toon({ color: c, th: 0.5 }), { hull: H(c) });
  return grp(a, b);
}

export const COLORS = { WOOD, WOOD_D, STONE, CLAY, IRON };
void capsule;
void lerp;
