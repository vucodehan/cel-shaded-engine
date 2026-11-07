/**
 * Anime FX in 3D space, all additive and invisible to the line pass: sparkles (4-point "kira" stars),
 * dust motes, light shafts, glow sprites, flames, droplets. Animate them on twos/threes like drawn FX:
 * pass a stepped time to update().
 */
import * as THREE from "three";
import { G } from "./engine";
import { V3, lerp, rng } from "./geo";

const ADD = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;

/**
 * Point particles. kind "kira": 4-point twinkling stars; "mote": soft dots; "ember": warm sparks.
 * Positions come from `at(i, t)` each update (world metres). size in px at 1080p.
 */
export function particles(o: { n: number; kind?: "kira" | "mote" | "ember"; color?: string; size?: number; at: (i: number, t: number, R: number) => THREE.Vector3 | null; seed?: number }) {
  const n = o.n;
  const pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
  const R = rng(o.seed ?? 3);
  const rr = Array.from({ length: n }, () => R());
  for (let i = 0; i < n; i++) {
    sz[i] = (o.size ?? 22) * (0.5 + rr[i]);
    ph[i] = rr[i] * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
  g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
  const kind = o.kind ?? "kira";
  const m = new THREE.ShaderMaterial({
    ...ADD,
    uniforms: { uPass: G.uPass, uRes: G.uRes, uT: { value: 0 }, uCol: { value: new THREE.Color(o.color ?? "#fff2c6") }, uOp: { value: 1 }, uKind: { value: kind === "kira" ? 0 : kind === "mote" ? 1 : 2 } },
    vertexShader: /* glsl */ `attribute float aSize; attribute float aPh; uniform vec2 uRes; uniform float uT; varying float vTw; varying float vS;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float tw = 0.55 + 0.45 * sin(uT * 7.0 + aPh * 3.0); vTw = tw;
        vS = aSize; gl_PointSize = aSize * tw * min(uRes.x, uRes.y) / 1080.0 * clamp(6.0 / -mv.z, 0.25, 2.5); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `precision highp float; uniform float uPass; uniform vec3 uCol; uniform float uOp; uniform float uKind; varying float vTw;
      void main(){ if (uPass > 0.5) discard; vec2 d = gl_PointCoord - 0.5; float r = length(d);
        float a;
        if (uKind < 0.5) { float star = max(smoothstep(0.07, 0.0, abs(d.x)) * smoothstep(0.5, 0.0, abs(d.y)), smoothstep(0.07, 0.0, abs(d.y)) * smoothstep(0.5, 0.0, abs(d.x)));
          a = max(star, smoothstep(0.16, 0.0, r)) ; }
        else if (uKind < 1.5) a = smoothstep(0.5, 0.15, r) * 0.6;
        else a = smoothstep(0.3, 0.0, r);
        gl_FragColor = vec4(uCol * a * uOp * (0.6 + vTw * 0.6), 0.0); }`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 5;
  return {
    obj: p,
    mat: m,
    update: (t: number, opacity = 1) => {
      m.uniforms.uT.value = t;
      m.uniforms.uOp.value = opacity;
      for (let i = 0; i < n; i++) {
        const v = o.at(i, t, rr[i]);
        if (v) pos.set([v.x, v.y, v.z], i * 3);
        else pos.set([0, -9999, 0], i * 3);
      }
      (g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}

/** Rising/swirling sparkles around a centre (miracle moments). */
export function miracleSparkles(center: THREE.Vector3, o: { n?: number; radius?: number; height?: number; color?: string; size?: number; seed?: number } = {}) {
  const r = o.radius ?? 0.6, h = o.height ?? 1.2;
  return particles({
    n: o.n ?? 60, kind: "kira", color: o.color ?? "#fff0c0", size: o.size ?? 26, seed: o.seed,
    at: (i, t, R) => {
      const a = R * 40 + t * (0.6 + R * 0.8);
      const life = (t * (0.25 + R * 0.25) + R) % 1;
      return V3(center.x + Math.cos(a) * r * (0.4 + R * 0.6), center.y + life * h - h * 0.2, center.z + Math.sin(a) * r * (0.4 + R * 0.6));
    },
  });
}

/** Dust motes drifting in a box (interiors, light shafts). */
export function motes(box: THREE.Box3, o: { n?: number; color?: string; size?: number; seed?: number } = {}) {
  const s = box.getSize(V3()), c = box.min;
  return particles({
    n: o.n ?? 120, kind: "mote", color: o.color ?? "#fff4dc", size: o.size ?? 7, seed: o.seed,
    at: (i, t, R) => V3(c.x + ((R * 13.1 + t * 0.03 * (R - 0.5)) % 1 + 1) % 1 * s.x, c.y + ((R * 7.7 + t * 0.02) % 1) * s.y, c.z + ((R * 3.3 + Math.sin(t * 0.3 + R * 9) * 0.02) % 1 + 1) % 1 * s.z),
  });
}

/** Light shaft: a soft cone/box of additive light from `from` toward `to` (window light, heaven light). */
export function beam(from: THREE.Vector3, to: THREE.Vector3, o: { r0?: number; r1?: number; color?: string; opacity?: number } = {}) {
  const len = from.distanceTo(to);
  const g = new THREE.CylinderGeometry(o.r0 ?? 0.3, o.r1 ?? 0.9, len, 32, 1, true);
  g.translate(0, -len / 2, 0);
  const m = new THREE.ShaderMaterial({
    ...ADD,
    side: THREE.DoubleSide,
    uniforms: { uPass: G.uPass, uCol: { value: new THREE.Color(o.color ?? "#fff0c8") }, uOp: { value: o.opacity ?? 0.35 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `precision highp float; uniform float uPass; uniform vec3 uCol; uniform float uOp; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ if (uPass > 0.5) discard; float edge = abs(dot(normalize(vN), normalize(vV))); float a = pow(edge, 1.6) * smoothstep(0.0, 0.25, vUv.y) * (0.35 + 0.65 * vUv.y);
        gl_FragColor = vec4(uCol * a * uOp, 0.0); }`,
  });
  const me = new THREE.Mesh(g, m);
  me.position.copy(from);
  me.quaternion.setFromUnitVectors(V3(0, -1, 0), to.clone().sub(from).normalize());
  me.renderOrder = 6;
  me.frustumCulled = false;
  return { obj: me, mat: m };
}

/** Camera-facing radial glow (lamps, halos, the light from the tomb). Call face(camera) per frame. */
export function glow(pos: THREE.Vector3, size: number, o: { color?: string; opacity?: number; core?: number } = {}) {
  const m = new THREE.ShaderMaterial({
    ...ADD,
    uniforms: { uPass: G.uPass, uCol: { value: new THREE.Color(o.color ?? "#ffd890") }, uOp: { value: o.opacity ?? 0.8 }, uCore: { value: o.core ?? 0.25 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; uniform float uPass; uniform vec3 uCol; uniform float uOp; uniform float uCore; varying vec2 vUv;
      void main(){ if (uPass > 0.5) discard; float r = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2) + smoothstep(uCore, 0.0, r) * 0.8;
        gl_FragColor = vec4(uCol * a * uOp, 0.0); }`,
  });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
  me.position.copy(pos);
  me.renderOrder = 7;
  me.frustumCulled = false;
  return { obj: me, mat: m, face: (cam: THREE.Camera) => me.quaternion.copy(cam.quaternion) };
}

/** Cel flame: two stacked teardrops (outer orange, inner yellow) that flicker on threes. */
export function flame(pos: THREE.Vector3, s = 1) {
  const mk = (c: string, k: number) =>
    new THREE.Mesh(
      (() => { const g = new THREE.SphereGeometry(0.02 * k, 10, 8); g.scale(1, 2.2, 1); g.translate(0, 0.03 * k, 0); return g; })(),
      new THREE.ShaderMaterial({ uniforms: { uPass: G.uPass, uC: { value: new THREE.Color(c) } }, vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: `precision highp float; uniform float uPass; uniform vec3 uC; void main(){ if (uPass > 0.5) discard; gl_FragColor = vec4(uC, 1.0); }` }),
    );
  const outer = mk("#ff9a3c", 1), inner = mk("#fff2a0", 0.55);
  inner.position.y = 0.004;
  const g = new THREE.Group();
  g.add(outer, inner);
  g.position.copy(pos);
  g.scale.setScalar(s);
  const gl = glow(pos.clone().add(V3(0, 0.04 * s, 0)), 0.5 * s, { color: "#ffb860", opacity: 0.7 });
  return {
    group: g,
    glow: gl,
    update: (f: number, cam: THREE.Camera) => {
      const k = Math.floor(f / 3);
      const fl = 0.85 + 0.25 * Math.sin(k * 2.7) * Math.cos(k * 1.3);
      g.scale.set(s * (1.0 + 0.08 * Math.sin(k * 3.1)), s * fl, s);
      gl.face(cam);
      gl.mat.uniforms.uOp.value = 0.55 + 0.2 * fl;
    },
  };
}

/** Droplets bursting from a point (stepping into the river, water in the basin). */
export function droplets(center: THREE.Vector3, o: { n?: number; speed?: number; color?: string; seed?: number } = {}) {
  return particles({
    n: o.n ?? 40, kind: "ember", color: o.color ?? "#e8f8ff", size: 10, seed: o.seed,
    at: (i, t, R) => {
      if (t < 0) return null;
      const a = R * 6.28 * 7, sp = (o.speed ?? 1.4) * (0.5 + R);
      const x = Math.cos(a) * sp * t * 0.5, z = Math.sin(a) * sp * t * 0.5;
      const y = sp * t * 1.2 - 4.9 * t * t;
      return y < -0.02 ? null : V3(center.x + x, center.y + y, center.z + z);
    },
  });
}

export { lerp };
