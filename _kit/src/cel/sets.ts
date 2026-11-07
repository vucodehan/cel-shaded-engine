/** Sets: buildings, interiors, water, sky extras and landmarks for the Gospel films (metres, y up). */
import * as THREE from "three";
import { G } from "./engine";
import { V3, cluster, cyl, deform, fbm, lerp, merge, noise2, path, rbox, rng, rock, sstep, sweep } from "./geo";
import { HullOpts, inkOf, instanced, mesh, toon } from "./toon";
import { cached } from "./head";

const hl = (c: string, w = 2.2, d = 6): HullOpts => ({ color: inkOf(c, 0.3), width: w, distRef: d });

/** Galilean house: plastered stone walls, flat roof on beams with a parapet, dark door and windows. */
export function house(o: { w?: number; d?: number; h?: number; color?: string; seed?: number; door?: boolean; stairs?: boolean; hull?: boolean; lineDist?: number } = {}) {
  const w = o.w ?? 5, d = o.d ?? 4, h = o.h ?? 3;
  const c = o.color ?? "#d8c39c";
  const R = rng(o.seed ?? 1);
  const wallM = toon({ color: c, th: 0.45, paint: 0.3, paintScale: 1.2, rim: 0.4 });
  const darkM = toon({ color: "#3a2a26", shade: "#2a1e22", th: 0.5, unlit: true });
  const woodM = toon({ color: "#7a5a3c", th: 0.5 });
  const hull = o.hull === false ? false : hl(c, 2, o.lineDist ?? 10);
  const g = new THREE.Group();
  g.add(mesh(cached(`hW:${w}:${d}:${h}`, () => { const b = rbox(w, h, d, 0.08); b.translate(0, h / 2, 0); return b; }), wallM, { hull, cast: true }));
  g.add(mesh(cached(`hR:${w}:${d}:${h}`, () => { const b = rbox(w + 0.2, 0.22, d + 0.2, 0.05); b.translate(0, h + 0.11, 0); return b; }), wallM, { hull }));
  g.add(mesh(cached(`hP:${w}:${d}:${h}`, () => { const ps = [rbox(w + 0.2, 0.4, 0.15, 0.03), rbox(w + 0.2, 0.4, 0.15, 0.03), rbox(0.15, 0.4, d + 0.2, 0.03), rbox(0.15, 0.4, d + 0.2, 0.03)]; ps[0].translate(0, h + 0.42, d / 2 + 0.03); ps[1].translate(0, h + 0.42, -d / 2 - 0.03); ps[2].translate(w / 2 + 0.03, h + 0.42, 0); ps[3].translate(-w / 2 - 0.03, h + 0.42, 0); return merge(ps); }), wallM, { hull }));
  for (let i = 0; i < Math.round(w / 0.9); i++) {
    const b = mesh(cached("beamEnd", () => cyl(0.07, 0.07, 0.3, 8).rotateX(Math.PI / 2)), woodM, { hull: o.hull === false ? false : hl("#7a5a3c", 1.6, 8) });
    b.position.set(-w / 2 + 0.45 + i * 0.9, h - 0.12, d / 2 + 0.12);
    g.add(b);
  }
  if (o.door !== false) {
    const door = mesh(cached("doorHole", () => { const b = rbox(1.0, 2.0, 0.08, 0.02); b.translate(0, 1.0, 0); return b; }), darkM, { hull: false });
    door.position.set((R() - 0.5) * w * 0.4, 0, d / 2 + 0.01);
    g.add(door);
    const lintel = mesh(cached("lintel", () => rbox(1.3, 0.14, 0.18, 0.02)), woodM, { hull: o.hull === false ? false : hl("#7a5a3c", 1.6, 8) });
    lintel.position.set(door.position.x, 2.08, d / 2 + 0.05);
    g.add(lintel);
  }
  for (let i = 0; i < 2; i++) {
    const win = mesh(cached("winHole", () => rbox(0.45, 0.5, 0.06, 0.02)), darkM, { hull: false });
    win.position.set((i ? 1 : -1) * w * 0.32, h * 0.66, d / 2 + 0.01);
    if (R() < 0.75) g.add(win);
  }
  if (o.stairs) {
    const s = mesh(cached(`stairs:${h}`, () => { const parts: THREE.BufferGeometry[] = []; const n = Math.round(h / 0.25); for (let i = 0; i < n; i++) { const b = rbox(0.8, 0.25 * (i + 1), 0.32, 0.02); b.translate(0, 0.125 * (i + 1), -i * 0.3); parts.push(b); } return merge(parts); }), wallM, { hull });
    s.position.set(w / 2 + 0.45, 0, d / 2 - 0.2);
    g.add(s);
  }
  return g;
}

/** Village of houses on terrain height h(x,z), avoiding a keep-clear test. */
export function village(o: { n: number; area: [number, number, number, number]; h: (x: number, z: number) => number; seed?: number; clear?: (x: number, z: number) => boolean; colors?: string[]; hull?: boolean }) {
  const R = rng(o.seed ?? 4);
  const g = new THREE.Group();
  const cols = o.colors ?? ["#d8c39c", "#cdb48a", "#e0cfac", "#c9ae86", "#d2bc96"];
  const [x0, z0, x1, z1] = o.area;
  let placed = 0;
  const spots: [number, number, number][] = [];
  for (let t = 0; t < o.n * 20 && placed < o.n; t++) {
    const x = lerp(x0, x1, R()), z = lerp(z0, z1, R());
    if (o.clear && !o.clear(x, z)) continue;
    const w = 3.5 + R() * 3, d = 3 + R() * 2.5;
    if (spots.some(([sx, sz, r]) => Math.hypot(sx - x, sz - z) < r + Math.max(w, d) * 0.6)) continue;
    spots.push([x, z, Math.max(w, d) * 0.6]);
    const hs = house({ w, d, h: 2.6 + R() * 1.6, color: cols[Math.floor(R() * cols.length)], seed: t, stairs: R() < 0.3, hull: o.hull, lineDist: 14 });
    const y = Math.min(o.h(x - w / 2, z - d / 2), o.h(x + w / 2, z + d / 2), o.h(x, z)) - 0.3;
    hs.position.set(x, y, z);
    hs.rotation.y = Math.round(R() * 4) * (Math.PI / 2) + (R() - 0.5) * 0.25;
    g.add(hs);
    placed++;
  }
  return g;
}

/** Interior room: floor and walls facing inward; `omit` walls toward the camera. Origin at floor centre. */
export function room(o: { w: number; d: number; h: number; wall?: string; floor?: string; omit?: ("front" | "back" | "left" | "right")[]; beams?: boolean; window?: [number, number, number, number] | null; door?: [number, number] | null; outside?: string }) {
  const wall = o.wall ?? "#d9c7a4", floor = o.floor ?? "#a88a68";
  const wm = toon({ color: wall, th: 0.4, soft: 0.06, paint: 0.3, paintScale: 1.5, inner: 1, side: THREE.DoubleSide });
  const fm = toon({ color: floor, th: 0.4, soft: 0.06, paint: 0.35, paintScale: 1.2, inner: 1, rim: 0 });
  const g = new THREE.Group();
  const fl = new THREE.PlaneGeometry(o.w, o.d);
  fl.rotateX(-Math.PI / 2);
  g.add(mesh(fl, fm));
  const omit = new Set(o.omit ?? ["front"]);
  const add = (geo: THREE.BufferGeometry) => g.add(mesh(geo, wm));
  const wallWith = (len: number, hole?: [number, number, number, number] | null) => {
    const s = new THREE.Shape();
    s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, o.h); s.lineTo(-len / 2, o.h); s.closePath();
    if (hole) {
      const [cx, cy, hw, hh] = hole;
      const p = new THREE.Path();
      p.moveTo(cx - hw / 2, cy - hh / 2); p.lineTo(cx + hw / 2, cy - hh / 2); p.lineTo(cx + hw / 2, cy + hh / 2); p.lineTo(cx - hw / 2, cy + hh / 2); p.closePath();
      s.holes.push(p);
    }
    return new THREE.ShapeGeometry(s);
  };
  if (!omit.has("back")) { const b = wallWith(o.w, o.window ?? null); b.translate(0, 0, -o.d / 2); add(b); }
  if (o.window && o.outside) {
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h * 2), toon({ color: o.outside, unlit: true, fog: 0 }));
    bg.position.set(0, o.h / 2, -o.d / 2 - 1.2);
    g.add(bg);
  }
  if (!omit.has("front")) { const b = wallWith(o.w); b.rotateY(Math.PI); b.translate(0, 0, o.d / 2); add(b); }
  if (!omit.has("left")) { const b = wallWith(o.d, o.door ? [o.door[0], 1.0, o.door[1], 2.0] : null); b.rotateY(Math.PI / 2); b.translate(-o.w / 2, 0, 0); add(b); }
  if (!omit.has("right")) { const b = wallWith(o.d); b.rotateY(-Math.PI / 2); b.translate(o.w / 2, 0, 0); add(b); }
  if (o.beams) {
    const bm = toon({ color: "#6e5038", th: 0.5, paint: 0.3, paintScale: 4 });
    for (let i = 0; i < Math.round(o.w / 1.1); i++) {
      const b = mesh(cached(`beam:${o.d}`, () => rbox(0.16, 0.18, o.d, 0.02)), bm, { hull: hl("#6e5038", 1.8) });
      b.position.set(-o.w / 2 + 0.55 + i * 1.1, o.h - 0.09, 0);
      g.add(b);
    }
  }
  return g;
}

// ---- water ---------------------------------------------------------------------------------------------

/** Stylised water (Wind Waker / anime): depth-graded colour, animated foam squiggles, sun glitter. */
export function waterMat(o: { deep?: string; shallow?: string; foam?: string; scale?: number; foamAmt?: number; glitter?: number } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPass: G.uPass, uTime: G.uTime, uLightDir: G.uLightDir, uFogCol: G.uFogCol, uFogNear: G.uFogNear, uFogFar: G.uFogFar, uFogAmt: G.uFogAmt,
      uDeep: { value: new THREE.Color(o.deep ?? "#2f6f9a") }, uShallow: { value: new THREE.Color(o.shallow ?? "#7cc0cf") }, uFoam: { value: new THREE.Color(o.foam ?? "#f2fbff") },
      uScale: { value: o.scale ?? 0.35 }, uFoamAmt: { value: o.foamAmt ?? 1 }, uGlitter: { value: o.glitter ?? 1 },
    },
    vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 v = viewMatrix * w; vV = v.xyz; gl_Position = projectionMatrix * v; }`,
    fragmentShader: /* glsl */ `precision highp float;
      uniform float uPass; uniform float uTime; uniform vec3 uLightDir; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar; uniform float uFogAmt;
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uScale; uniform float uFoamAmt; uniform float uGlitter;
      varying vec3 vW; varying vec3 vV;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      void main(){
        if (uPass > 0.5) { gl_FragColor = vec4(0.0, 0.0, -vV.z, 4.0 * 497.0); return; }
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        vec2 q = vW.xz * uScale;
        float t = uTime;
        float fres = pow(1.0 - max(V.y, 0.0), 3.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.6, V.y));
        col = mix(col, uFogCol * 0.95 + 0.05, fres * 0.55);
        float a = n2(q * 0.9 + vec2(t * 0.05, t * 0.03)) * 0.6 + n2(q * 2.3 - vec2(t * 0.04, -t * 0.06)) * 0.4;
        float band = abs(fract(a * 5.0) - 0.5);
        float foam = smoothstep(0.06, 0.02, band) * smoothstep(0.35, 0.75, a) * uFoamAmt * (1.0 - smoothstep(20.0, 140.0, dist));
        col = mix(col, uFoam, foam * 0.85);
        vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
        float sun = max(dot(R, normalize(uLightDir)), 0.0);
        float gl = step(0.86, n2(q * 9.0 + t * 0.6)) * pow(sun, 30.0) * uGlitter;
        col += vec3(1.0, 0.95, 0.8) * gl * 1.6 + vec3(1.0, 0.9, 0.7) * pow(sun, 80.0) * 0.5 * uGlitter;
        float fog = smoothstep(uFogNear, uFogFar, dist) * uFogAmt;
        col = mix(col, uFogCol, fog);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function waterPlane(o: { size?: number; y?: number; cx?: number; cz?: number } & Parameters<typeof waterMat>[0] = {}) {
  const g = new THREE.PlaneGeometry(o.size ?? 3000, o.size ?? 3000, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, waterMat(o));
  m.position.set(o.cx ?? 0, o.y ?? 0, o.cz ?? 0);
  m.name = "water";
  return m;
}

// ---- vegetation ----------------------------------------------------------------------------------------

export function palm(o: { x: number; z: number; y?: number; h?: number; seed?: number; lean?: number }) {
  const R = rng(o.seed ?? 2);
  const h = o.h ?? 7;
  const lean = o.lean ?? 0.6;
  const top = V3(lean, h, lean * 0.3);
  const trunk = sweep(path([V3(0, 0, 0), V3(lean * 0.2, h * 0.5, 0), top]), { rx: (t) => lerp(0.22, 0.14, t), radial: 10, segs: 18, ripple: (t) => 0.012 * Math.sin(t * 60) });
  const g = new THREE.Group();
  g.add(mesh(trunk, toon({ color: "#8c7457", th: 0.5, paint: 0.3, paintScale: 3 }), { hull: hl("#8c7457", 2, 10), cast: true }));
  const fronds: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + R() * 0.3;
    const L = 2.6 + R() * 0.8;
    const dir = V3(Math.cos(a), 0, Math.sin(a));
    const pts = [top.clone(), top.clone().addScaledVector(dir, L * 0.45).add(V3(0, 0.5, 0)), top.clone().addScaledVector(dir, L).add(V3(0, -0.6 - R() * 0.6, 0))];
    fronds.push(sweep(path(pts), { rx: (t) => 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)), ry: () => 0.012, radial: 6, segs: 14, upFn: () => V3(0, 1, 0), ripple: (t, an) => (Math.abs(Math.cos(an)) > 0.7 ? 0.05 * Math.sin(t * 40) : 0) }));
  }
  g.add(mesh(merge(fronds), toon({ color: "#7f9a5a", shade: "#4f6670", th: 0.45, rim: 0.8, side: THREE.DoubleSide }), { hull: hl("#4f6670", 1.8, 10), cast: true }));
  g.position.set(o.x, o.y ?? 0, o.z);
  g.rotation.y = R() * 6.28;
  return g;
}

export function cypress(o: { x: number; z: number; y?: number; h?: number; seed?: number }) {
  const h = o.h ?? 8;
  const g = cluster(Array.from({ length: 7 }, (_, i) => [0, h * (0.2 + i * 0.11), 0, h * 0.13 * (1 - i * 0.09)] as [number, number, number, number]), o.seed ?? 3, 0.15, 2);
  const m = mesh(g, toon({ color: "#5f7a4a", shade: "#3d4f5c", th: 0.45, paint: 0.2, paintScale: 1 }), { hull: hl("#3d4f5c", 1.8, 12), cast: true });
  m.position.set(o.x, o.y ?? 0, o.z);
  return m;
}

export function reeds(o: { n: number; along: (t: number) => THREE.Vector3; width?: number; seed?: number }) {
  const blade = cached("reed", () => { const c = new THREE.ConeGeometry(0.025, 1.4, 4); c.translate(0, 0.7, 0); return c; });
  const im = instanced(blade, toon({ color: "#9aa75e", shade: "#5c6a6a", th: 0.45 }), o.n);
  const R = rng(o.seed ?? 9);
  const d = new THREE.Object3D();
  for (let i = 0; i < o.n; i++) {
    const p = o.along(R());
    d.position.set(p.x + (R() - 0.5) * (o.width ?? 1.5), p.y, p.z + (R() - 0.5) * (o.width ?? 1.5));
    d.rotation.set((R() - 0.5) * 0.3, R() * 6, (R() - 0.5) * 0.3);
    d.scale.setScalar(0.6 + R() * 0.8);
    d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  return im;
}

// ---- sky extras ----------------------------------------------------------------------------------------

/** Star field + moon disc for night skies (unlit, drawn behind everything; invisible to the line pass). */
/** Smallest point sprite in supersampled px (2.5 final px at ss 2): smaller points shimmer frame to frame. */
export const MIN_STAR_PX = 5;

export function stars(o: { n?: number; seed?: number; moon?: THREE.Vector3 | null; moonSize?: number; bright?: number } = {}) {
  const R = rng(o.seed ?? 7);
  const n = o.n ?? 1600;
  const pos = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2;
    const y = Math.abs(u) * 0.95 + 0.03;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 2500, y * 2500, Math.sin(a) * r * 2500], i * 3);
    size[i] = (R() < 0.08 ? 3.2 : 1.6) * (0.6 + R() * 0.8);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uPass: G.uPass, uRes: G.uRes, uBright: { value: o.bright ?? 1 } },
    // points never shrink below MIN_STAR_PX (sub-pixel points flicker on and off as the camera moves); smaller stars
    // keep their brightness by dimming in proportion to the area they lost
    vertexShader: /* glsl */ `attribute float aSize; uniform vec2 uRes; varying float vS; varying float vE; void main(){ vS = aSize; float px = aSize * min(uRes.x, uRes.y) / 1080.0; float ps = max(px, ${MIN_STAR_PX.toFixed(1)}); vE = (px * px) / (ps * ps); gl_PointSize = ps; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; uniform float uPass; uniform float uBright; varying float vS; varying float vE; void main(){ if (uPass > 0.5) discard; vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); float cross_ = smoothstep(0.08, 0.0, min(abs(d.x), abs(d.y))) * smoothstep(0.5, 0.1, length(d)) * step(2.5, vS); gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * (a * 0.8 + cross_) * uBright * vE, 0.0); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = -9;
  pts.name = "stars";
  const grpS = new THREE.Group();
  grpS.add(pts);
  if (o.moon) {
    const md = new THREE.Mesh(new THREE.CircleGeometry(o.moonSize ?? 60, 48), new THREE.ShaderMaterial({
      uniforms: { uPass: G.uPass },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `precision highp float; uniform float uPass; varying vec2 vUv; void main(){ if (uPass > 0.5) discard; vec2 d = vUv - 0.5; float m = smoothstep(0.5, 0.48, length(d)); float sh = smoothstep(0.1, 0.5, length(d - vec2(0.12, 0.1))); vec3 c = mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.98, 0.9), sh); gl_FragColor = vec4(c * m + vec3(0.6,0.7,0.9) * 0.0, 1.0); if (m < 0.01) discard; }`,
    }));
    const p = o.moon.clone().normalize().multiplyScalar(2400);
    md.position.copy(p);
    md.lookAt(0, 0, 0);
    md.renderOrder = -8;
    md.name = "moon";
    grpS.add(md);
  }
  grpS.name = "skyExtras";
  return grpS;
}

// ---- landmarks -----------------------------------------------------------------------------------------

/** Stone colonnade (temple courts): row of columns with a lintel along x from x0 to x1 at z. */
export function colonnade(o: { x0: number; x1: number; z: number; h?: number; n?: number; color?: string; y?: number }) {
  const h = o.h ?? 6, n = o.n ?? 8, c = o.color ?? "#e6d8b8";
  const m = toon({ color: c, th: 0.45, paint: 0.2, paintScale: 1.5, rim: 0.4 });
  const g = new THREE.Group();
  const colG = cached(`col:${h}`, () => { const s = cyl(0.32, 0.36, h, 18); s.translate(0, h / 2, 0); const cap = rbox(0.9, 0.3, 0.9, 0.04); cap.translate(0, h + 0.15, 0); const base = rbox(0.9, 0.25, 0.9, 0.04); base.translate(0, 0.125, 0); return merge([s, cap, base]); });
  for (let i = 0; i < n; i++) {
    const col = mesh(colG, m, { hull: hl(c, 2, 12), cast: true });
    col.position.set(lerp(o.x0, o.x1, i / (n - 1)), o.y ?? 0, o.z);
    g.add(col);
  }
  const lint = mesh(cached(`lint:${o.x1 - o.x0}:${h}`, () => { const b = rbox(o.x1 - o.x0 + 1.2, 0.9, 1.2, 0.05); b.translate(0, h + 0.75, 0); return b; }), m, { hull: hl(c, 2, 12) });
  lint.position.set((o.x0 + o.x1) / 2, o.y ?? 0, o.z);
  g.add(lint);
  return g;
}

/** Paving: large stone slab floor with joint lines from vertex colours (no geometry seams). */
export function paving(o: { w: number; d: number; color?: string; tile?: number }) {
  const g = new THREE.PlaneGeometry(o.w, o.d, Math.round(o.w * 2), Math.round(o.d * 2));
  g.rotateX(-Math.PI / 2);
  const base = new THREE.Color(o.color ?? "#c9b994");
  const t = o.tile ?? 1.2;
  const pos = g.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const row = Math.floor(z / t);
    const k = (Math.sin(Math.floor(x / t + row * 0.5) * 12.9 + row * 78.2) * 43758.5) % 1;
    const c = base.clone().offsetHSL(0, 0, (Math.abs(k) - 0.5) * 0.06);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return mesh(g, toon({ color: "#ffffff", shade: "#bdb3cf", th: 0.4, soft: 0.05, vertexColors: true, paint: 0.25, paintScale: 0.8 }));
}

/** Rock-cut garden tomb: a cliff face with a dark doorway and a round rolling stone (open 0..1 rolls it aside). */
export function gardenTomb(o: { open?: number; seed?: number } = {}) {
  const g = new THREE.Group();
  const c = "#c2b08e";
  const cliff = cached("tombCliff", () => { const r = rock(6, o.seed ?? 4, 1.4, 0.75, 0.7); r.translate(0, 1.2, -3.2); return r; });
  g.add(mesh(cliff, toon({ color: c, shade: "#7a6f84", th: 0.45, flat: true, paint: 0.3, paintScale: 0.6 }), { hull: hl(c, 2.4, 10), cast: true }));
  const door = mesh(cached("tombDoor", () => { const s = new THREE.Shape(); s.moveTo(-0.6, 0); s.lineTo(0.6, 0); s.lineTo(0.6, 1.3); s.absarc(0, 1.3, 0.6, 0, Math.PI, false); s.closePath(); return new THREE.ShapeGeometry(s, 16); }), toon({ color: "#1d1416", unlit: true }), { hull: false });
  door.position.set(0, 0.05, 1.05);
  g.add(door);
  const stoneM = toon({ color: "#b5a588", shade: "#6e6578", th: 0.45, paint: 0.25, paintScale: 3 });
  const st = mesh(cached("tombStone", () => { const s = cyl(1.05, 1.05, 0.35, 32); s.rotateX(Math.PI / 2); return s; }), stoneM, { hull: hl("#b5a588", 2.4), cast: true });
  const open = o.open ?? 0;
  st.position.set(lerp(0, 1.9, open), 1.05, 1.35);
  st.rotation.z = -open * 1.8;
  st.name = "stone";
  g.add(st);
  return g;
}

/** Hill silhouette with the three distant crosses (house style: far, dark, never close). */
export function golgotha(o: { x?: number; z?: number; color?: string } = {}) {
  const g = new THREE.Group();
  const hill = cached("golHill", () => { const s = new THREE.SphereGeometry(40, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2); s.scale(1.6, 0.42, 1); deform(s, (p) => { p.y += noise2(p.x * 0.05, p.z * 0.05) * 2; }); return s; });
  const c = o.color ?? "#3a3036";
  g.add(mesh(hill, toon({ color: c, shade: c, th: 0.5, rim: 0.5, fog: 0.6 })));
  const m = toon({ color: "#1e161c", shade: "#1e161c", th: 0.5, rim: 0.6, fog: 0.5 });
  for (const [x, s] of [[-7, 0.85], [0, 1], [7, 0.85]] as const) {
    const v = new THREE.Mesh(cached("crV", () => { const b = rbox(0.5, 9, 0.45, 0.02); b.translate(0, 4.5, 0); return b; }), m);
    const h = new THREE.Mesh(cached("crH", () => { const b = rbox(4.6, 0.45, 0.42, 0.02); b.translate(0, 7, 0); return b; }), m);
    const cr = new THREE.Group();
    cr.add(v, h);
    cr.position.set(x, 16.6, 0);
    cr.scale.setScalar(s);
    g.add(cr);
  }
  g.position.set(o.x ?? 0, 0, o.z ?? 0);
  return g;
}

/** Desert height field: dunes and wind ridges, with rock outcrops placed by the caller. */
export const desertHeight = (seed = 1) => (x: number, z: number) => fbm(x * 0.012 + seed, z * 0.012, 4) * 9 + Math.abs(noise2(x * 0.04 + z * 0.02, z * 0.03)) * 3 - z * 0.02;

/** Jordan valley: a river channel along z = f(x) cut into the terrain height function. */
export function riverValley(base: (x: number, z: number) => number, course: (x: number) => number, width = 7, depth = 1.6) {
  return (x: number, z: number) => {
    const d = Math.abs(z - course(x));
    const k = sstep(width * 0.5, width * 0.5 + 6, d);
    return lerp(-depth, base(x, z), k);
  };
}

void cluster;
