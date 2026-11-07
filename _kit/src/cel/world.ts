/**
 * Environment builders. Backgrounds follow anime practice: painted fills (paint noise), aerial fog, NO outlines
 * on distant land (lines belong to characters and near props). Everything is metres, y up.
 */
import * as THREE from "three";
import { G } from "./engine";
import { V3, cluster, deform, fbm, lerp, merge, noise2, path, rng, rock, sstep, sweep, vcolor } from "./geo";
import { HullOpts, inkOf, instanced, mesh, toon, ToonOpts } from "./toon";

export type SkyOpts = {
  zenith: string; horizon: string; low?: string;
  sun?: THREE.Vector3; sunCol?: string; sunSize?: number; glow?: number;
  /** soft stylised cloud streaks painted into the dome */
  streaks?: number; streakCol?: string;
};

export function sky(o: SkyOpts) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uPass: G.uPass,
      uZen: { value: new THREE.Color(o.zenith) }, uHor: { value: new THREE.Color(o.horizon) }, uLow: { value: new THREE.Color(o.low ?? o.horizon) },
      uSun: { value: (o.sun ?? V3(0.3, 0.3, -1)).clone().normalize() }, uSunCol: { value: new THREE.Color(o.sunCol ?? "#fff1c8") },
      uSunSize: { value: o.sunSize ?? 0.03 }, uGlow: { value: o.glow ?? 0.5 },
      uStreak: { value: o.streaks ?? 0 }, uStreakCol: { value: new THREE.Color(o.streakCol ?? "#ffffff") },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `precision highp float;
      uniform float uPass; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uLow; uniform vec3 uSun; uniform vec3 uSunCol;
      uniform float uSunSize; uniform float uGlow; uniform float uStreak; uniform vec3 uStreakCol; varying vec3 vDir;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      void main(){
        if (uPass > 0.5) { gl_FragColor = vec4(0.0); return; }
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.5));
        c = mix(c, uLow, smoothstep(0.0, -0.25, h));
        if (uStreak > 0.0 && h > 0.0) {
          vec2 q = d.xz / (h + 0.15);
          float s = n2(q * vec2(0.9, 3.2)) * 0.6 + n2(q * vec2(2.1, 7.0)) * 0.4;
          float band = smoothstep(0.58, 0.62, s) * smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.5, 0.9, h));
          c = mix(c, uStreakCol, band * uStreak);
        }
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uSunCol * (pow(s, 14.0) * uGlow + pow(s, 3.0) * uGlow * 0.3);
        float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.85), s);
        c = mix(c, vec3(1.0, 0.98, 0.92), disc);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const me = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), m);
  me.renderOrder = -10;
  me.frustumCulled = false;
  me.name = "sky";
  return me;
}

export type TerrainOpts = {
  size: number; res?: number;
  h: (x: number, z: number) => number;
  color: (x: number, z: number, y: number) => THREE.Color;
  paint?: number; paintScale?: number; mat?: Partial<ToonOpts>; cx?: number; cz?: number;
};

export function terrain(o: TerrainOpts) {
  const res = o.res ?? 220;
  const g = new THREE.PlaneGeometry(o.size, o.size, res, res);
  g.rotateX(-Math.PI / 2);
  g.translate(o.cx ?? 0, 0, o.cz ?? 0);
  deform(g, (p) => {
    p.y = o.h(p.x, p.z);
  });
  vcolor(g, (p) => o.color(p.x, p.z, p.y));
  const m = toon({ color: "#ffffff", shade: "#c9c3dd", th: 0.42, soft: 0.05, vertexColors: true, paint: o.paint ?? 0.22, paintScale: o.paintScale ?? 0.35, rim: 0, ...o.mat });
  const me = mesh(g, m);
  me.name = "terrain";
  return me;
}

/** Ring of hills around (cx, cz): a band whose top follows noise; shaded softly, fogged into the sky. */
export function hillRing(o: { r: number; h: number; base?: number; rough?: number; seed?: number; color: string; shade?: string; cx?: number; cz?: number; segs?: number; peaks?: number }) {
  const segs = o.segs ?? 360;
  const pos: number[] = [], idx: number[] = [];
  const base = o.base ?? -20;
  const R = o.r;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const t = Math.cos(a), s = Math.sin(a);
    const n = fbm(Math.cos(a) * (o.peaks ?? 3) + (o.seed ?? 0), Math.sin(a) * (o.peaks ?? 3), 5) * (o.rough ?? 1);
    const top = o.h * (0.55 + 0.45 * (n * 1.4 + 0.3));
    for (const [rr, y] of [[R, base], [R * 0.985, top * 0.35], [R * 0.95, top]] as [number, number][]) pos.push((o.cx ?? 0) + s * rr, y, (o.cz ?? 0) + t * rr);
  }
  for (let i = 0; i < segs; i++)
    for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = a + 3;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = toon({ color: o.color, shade: o.shade, th: 0.38, soft: 0.08, paint: 0.12, paintScale: 0.02, rim: 0, side: THREE.DoubleSide });
  return mesh(g, m);
}

/** Cel cumulus: lumpy spheres with a flattened base; bright lit side, cool shadow, optional gold rim. */
export function cloud(o: { x: number; y: number; z: number; w: number; h: number; seed?: number; color?: string; shade?: string; n?: number; flat?: number }) {
  const R = rng(o.seed ?? 3);
  const n = o.n ?? 14;
  const balls: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = lerp(-o.w / 2, o.w / 2, t) + (R() - 0.5) * o.w * 0.15;
    const hump = Math.sin(Math.PI * t);
    const r = o.h * (0.35 + 0.65 * hump) * (0.7 + R() * 0.5);
    balls.push([x, r * 0.5 + hump * o.h * 0.25, (R() - 0.5) * o.w * 0.25, r]);
  }
  const g = cluster(balls, o.seed ?? 3, 0.08, 2);
  const flat = o.flat ?? 0.15;
  deform(g, (p) => {
    p.y = Math.max(p.y, -o.h * flat);
  });
  g.translate(o.x, o.y, o.z);
  const m = toon({ color: o.color ?? "#fbfaf6", shade: o.shade ?? "#b7c0da", th: 0.36, soft: 0.02, rim: 1.4, fog: 0.45 });
  return mesh(g, m);
}

export function oliveTree(o: { x: number; z: number; y?: number; s?: number; seed?: number; leaf?: string; leafShade?: string; trunk?: string; hull?: HullOpts | false }) {
  const R = rng(o.seed ?? 7);
  const s = o.s ?? 1;
  const parts: THREE.Group = new THREE.Group();
  const trunkPts = [V3(0, 0, 0), V3(0.15, 0.6, 0.05), V3(-0.1, 1.2, -0.05), V3(0.12, 1.75, 0.1)];
  const trunkM = toon({ color: o.trunk ?? "#7a6552", shade: "#4c4256", th: 0.5, paint: 0.25, paintScale: 3 });
  const leafM = toon({ color: o.leaf ?? "#9aa46c", shade: o.leafShade ?? "#5b7275", th: 0.45, soft: 0.02, paint: 0.2, paintScale: 2.5, rim: 0.8 });
  const branches: THREE.BufferGeometry[] = [sweep(path(trunkPts), { rx: (t) => lerp(0.2, 0.09, t), radial: 10, segs: 16, twist: (t) => t * 2 })];
  const ends: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + R();
    const start = trunkPts[2].clone().lerp(trunkPts[3], R());
    const end = start.clone().add(V3(Math.cos(a) * (0.9 + R() * 0.5), 0.6 + R() * 0.6, Math.sin(a) * (0.9 + R() * 0.5)));
    branches.push(sweep(path([start, start.clone().lerp(end, 0.5).add(V3(0, 0.15, 0)), end]), { rx: (t) => lerp(0.08, 0.035, t), radial: 7, segs: 8 }));
    ends.push(end);
  }
  const trunk = merge(branches);
  parts.add(mesh(trunk, trunkM, { hull: o.hull === false ? false : { color: "#2f2420", width: 2, distRef: 8, ...(o.hull || {}) }, cast: true }));
  const balls: [number, number, number, number][] = [];
  ends.forEach((e) => {
    for (let k = 0; k < 4; k++) balls.push([e.x + (R() - 0.5) * 0.8, e.y + (R() - 0.3) * 0.5, e.z + (R() - 0.5) * 0.8, 0.45 + R() * 0.35]);
  });
  balls.push([0, 2.3, 0, 0.9]);
  const leaves = cluster(balls, o.seed ?? 7, 0.18, 2);
  parts.add(mesh(leaves, leafM, { hull: o.hull === false ? false : { color: inkOf(o.leafShade ?? "#56637a", 0.45), width: 2, distRef: 8, ...(o.hull || {}) }, cast: true }));
  parts.position.set(o.x, o.y ?? 0, o.z);
  parts.scale.setScalar(s);
  parts.rotation.y = R() * Math.PI * 2;
  return parts;
}

export function rockMesh(o: { x: number; y?: number; z: number; r: number; seed?: number; color?: string; shade?: string; sy?: number; hull?: HullOpts | false }) {
  const g = rock(o.r, o.seed ?? 1, 1, o.sy ?? 0.7, 1);
  const m = toon({ color: o.color ?? "#b9a88e", shade: o.shade ?? "#6f6880", th: 0.5, flat: true, paint: 0.25, paintScale: 4 / o.r });
  const me = mesh(g, m, { hull: o.hull === false ? false : { color: "#3a3030", width: 2, distRef: 6, ...(o.hull || {}) }, cast: true });
  me.position.set(o.x, o.y ?? 0, o.z);
  return me;
}

/** Instanced grass tufts scattered by a density function; colour varies per instance. */
export function grass(o: { n: number; area: [number, number, number, number]; h: (x: number, z: number) => number; keep?: (x: number, z: number) => boolean; seed?: number; color?: string; shade?: string; size?: number }) {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const c = new THREE.ConeGeometry(0.03, 0.32, 4, 1);
    c.translate(0, 0.16, 0);
    c.rotateZ((i - 2) * 0.22);
    c.rotateY(i * 1.3);
    c.translate((i - 2) * 0.03, 0, 0);
    blades.push(c);
  }
  const g = merge(blades);
  const m = toon({ color: "#ffffff", shade: "#cfc6dc", th: 0.4, rim: 0.4, clearable: true });
  const im = instanced(g, m, o.n);
  const R = rng(o.seed ?? 11);
  const dummy = new THREE.Object3D();
  const base = new THREE.Color(o.color ?? "#a3b46c");
  const [x0, z0, x1, z1] = o.area;
  let k = 0;
  for (let tries = 0; k < o.n && tries < o.n * 6; tries++) {
    const x = lerp(x0, x1, R()), z = lerp(z0, z1, R());
    if (o.keep && !o.keep(x, z)) continue;
    dummy.position.set(x, o.h(x, z), z);
    dummy.rotation.set(0, R() * 6.28, 0);
    dummy.scale.setScalar((o.size ?? 1) * (0.6 + R() * 0.8));
    dummy.updateMatrix();
    im.setMatrixAt(k, dummy.matrix);
    im.setColorAt(k, base.clone().offsetHSL((R() - 0.5) * 0.04, 0, (R() - 0.5) * 0.12));
    k++;
  }
  im.count = k;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

/** Rolling Galilean hillside height field: gentle slope, soft noise; flattened near (fx, fz) for staging. */
export function galileeHeight(seed = 0, flatAt: [number, number, number] = [0, 0, 6]) {
  return (x: number, z: number) => {
    const n = fbm(x * 0.018 + seed, z * 0.018, 4) * 7 + fbm(x * 0.07, z * 0.07 + seed, 3) * 0.9;
    const slope = -z * 0.04;
    const d = Math.hypot(x - flatAt[0], z - flatAt[1]);
    const k = sstep(flatAt[2], flatAt[2] * 3, d);
    const h0 = fbm(flatAt[0] * 0.018 + seed, flatAt[1] * 0.018, 4) * 7 - flatAt[1] * 0.04;
    return lerp(h0 + noise2(x * 0.3, z * 0.3) * 0.05, n + slope, k);
  };
}
