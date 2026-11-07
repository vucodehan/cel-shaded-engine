/**
 * Cel materials.
 *
 * toon(): threshold shading in display space. Two shadow bands (shade, shade2) hue-shifted toward the scene's
 * shadow tint instead of darkened toward black; a hard specular shape; rim light from G.uRimDir; aerial fog;
 * optional cast shadows (engine shadow pass); optional "sphere" normal transfer (faces shade as clean
 * ellipsoids, the Arc System Works / anime-face trick); optional face decal (eyes, brows, mouth drawn on a
 * canvas and projected in object space along +z); optional hair highlight band on strand UVs.
 * In G.uPass 1 every toon material writes (view normal xy, view depth, id*4+flags) for the line pass.
 *
 * hull(): inverted-hull outline with constant pixel width (clip-space extrusion), thinned by distance and by
 * the vertex attribute aLineK (0 full, 1 none), coloured per material, fogged with distance.
 */
import * as THREE from "three";
import { G, LAYER } from "./engine";

let NEXT_ID = 1;
const nextId = () => {
  const id = NEXT_ID;
  NEXT_ID = (NEXT_ID % 480) + 1;
  return id;
};

const COMMON = /* glsl */ `
uniform float uPass; uniform vec3 uLightDir; uniform vec3 uLightCol; uniform vec3 uRimDir; uniform vec3 uRimCol; uniform float uRimAmt;
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar; uniform float uFogAmt;
uniform float uShadowOn; uniform sampler2D uShadowMap; uniform mat4 uShadowMat; uniform float uShadowSoft; uniform vec2 uRes; uniform float uLineScale;
uniform vec3 uShadeK; uniform float uRevZ;
`;

const TOON_VERT = /* glsl */ `
${COMMON}
#ifdef USE_INSTANCING_COLOR
#endif
attribute float aBias;
uniform vec4 uSphere;
uniform vec4 uClear[48]; uniform int uClearN; uniform float uClearK;
varying vec3 vWPos; varying vec3 vWN; varying vec3 vVPos; varying vec3 vVN; varying vec3 vOPos; varying vec3 vON; varying vec2 vUv; varying vec3 vCol; varying float vBias; varying vec3 vSN;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  if (uClearK > 0.5) {
    // grass: a blade rooted under a resting prop or a seated person collapses to a point
    vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    for (int i = 0; i < 48; i++) {
      if (i >= uClearN) break;
      vec4 c = uClear[i];
      if (distance(root.xz, c.xz) < c.w && root.y > c.y - 0.25 && root.y < c.y + 0.1) p = vec4(0.0, 0.0, 0.0, 1.0);
    }
  }
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
#endif
  vOPos = position; vON = normal;
  vec4 wp = modelMatrix * p;
  vWPos = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * n);
  vSN = normalize(mat3(modelMatrix) * normalize(position - uSphere.xyz + vec3(0.0, 0.0, 1e-5)));
  vec4 vp = viewMatrix * wp;
  vVPos = vp.xyz;
  vVN = normalize(mat3(viewMatrix) * vWN);
  vUv = uv;
  vCol = vec3(1.0);
#ifdef USE_COLOR
  vCol = color.rgb;
#endif
#ifdef USE_INSTANCING_COLOR
  vCol *= instanceColor;
#endif
  vBias = aBias;
  gl_Position = projectionMatrix * vp;
}`;

const TOON_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uShade2; uniform vec3 uHi; uniform vec3 uEmit;
uniform float uTh; uniform float uTh2; uniform float uSoft; uniform float uBias; uniform float uSpec; uniform float uSpecTh;
uniform float uRimK; uniform float uFogK; uniform float uReceive; uniform float uId; uniform float uOpacity;
uniform vec4 uSphere; uniform float uDecalOn; uniform sampler2D uDecal; uniform vec4 uDecalRect; uniform float uDecalShade;
uniform float uHair; uniform vec3 uHairHi; uniform vec2 uHairBand; uniform float uFlat; uniform float uUnlit;
uniform float uPaint; uniform float uPaintScale; uniform float uInner;
varying vec3 vWPos; varying vec3 vWN; varying vec3 vVPos; varying vec3 vVN; varying vec3 vOPos; varying vec3 vON; varying vec2 vUv; varying vec3 vCol; varying float vBias; varying vec3 vSN;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// lit (1) when the stored occluder depth is not nearer than the fragment; reversed depth stores 1 at the near plane
float shadowTap(float z, vec2 uv) {
  float d = texture2D(uShadowMap, uv).r;
  return uRevZ > 0.5 ? step(d, z + 0.0012) : step(z - 0.0012, d);
}
float shadowAt(vec3 wp) {
  vec4 sp = uShadowMat * vec4(wp, 1.0);
  vec3 s = sp.xyz / sp.w;
  s.xy = s.xy * 0.5 + 0.5;
  if (uRevZ < 0.5) s.z = s.z * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0 || s.z < 0.0) return 1.0;
  vec2 tx = vec2(uShadowSoft / 2048.0);
  float acc = 0.0;
  acc += shadowTap(s.z, s.xy + vec2(-tx.x, -tx.y));
  acc += shadowTap(s.z, s.xy + vec2(tx.x, -tx.y));
  acc += shadowTap(s.z, s.xy + vec2(-tx.x, tx.y));
  acc += shadowTap(s.z, s.xy + vec2(tx.x, tx.y));
  return smoothstep(0.24, 0.76, acc * 0.25);
}
void main() {
  vec3 Ng = normalize(vWN);
  if (!gl_FrontFacing) Ng = -Ng;
  if (uPass > 0.5) {
    vec3 vn = normalize(vVN);
    if (!gl_FrontFacing) vn = -vn;
    gl_FragColor = vec4(vn.xy, -vVPos.z, uId);
    return;
  }
  vec3 N = Ng;
  if (uFlat > 0.5) N = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
  if (uSphere.w > 0.0) N = normalize(mix(N, normalize(vSN), uSphere.w));
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(cameraPosition - vWPos);
  float ndl = dot(N, L);
  float t = ndl * 0.5 + 0.5 + vBias + uBias;
  float lit = smoothstep(uTh - uSoft, uTh + uSoft, t);
  if (uShadowOn > 0.5 && uReceive > 0.5) lit *= shadowAt(vWPos + Ng * 0.015);
  float inner = gl_FrontFacing ? 1.0 : uInner;
  vec3 base = uColor * vCol * uLightCol * inner;
  vec3 sh = uShade * vCol * inner * uShadeK;
  vec3 col = mix(sh, base, lit);
  if (uTh2 > 0.0) col = mix(uShade2 * vCol * uShadeK, col, smoothstep(uTh2 - uSoft, uTh2 + uSoft, t));
  if (uUnlit > 0.5) { col = uColor * vCol; lit = 1.0; }
  if (uSpec > 0.0) {
    vec3 H = normalize(L + V);
    float s = smoothstep(uSpecTh - 0.012, uSpecTh + 0.012, dot(N, H));
    col = mix(col, uHi, s * uSpec * lit);
  }
  if (uHair > 0.0) {
    float nv = dot(N, V);
    float c = mix(uHairBand.x, uHairBand.y, 0.5) + (1.0 - nv) * 0.06;
    float jag = sin(vUv.y * 37.0) * 0.018 + sin(vUv.y * 91.0) * 0.009;
    float band = smoothstep(0.012, 0.0, abs(vUv.x - c + jag) - (uHairBand.y - uHairBand.x) * 0.5);
    col = mix(col, uHairHi, band * uHair * mix(0.25, 1.0, lit) * smoothstep(0.1, 0.4, nv));
  }
  float fres = 1.0 - max(dot(N, V), 0.0);
  float rimL = max(dot(N, normalize(uRimDir)), 0.0);
  float rim = smoothstep(0.5, 0.56, fres) * smoothstep(0.02, 0.2, rimL);
  col = mix(col, uRimCol, rim * uRimAmt * uRimK);
  if (uDecalOn > 0.5) {
    vec2 duv = (vOPos.xy - uDecalRect.xy) / uDecalRect.zw + 0.5;
    if (duv.x > 0.0 && duv.x < 1.0 && duv.y > 0.0 && duv.y < 1.0 && vOPos.z > 0.0) {
      vec4 d = texture2D(uDecal, duv);
      float face = smoothstep(0.0, 0.35, normalize(vON).z);
      vec3 dc = d.rgb * mix(uDecalShade, 1.0, lit);
      col = mix(col, dc, d.a * face);
    }
  }
  if (uPaint > 0.0) {
    vec3 q = vWPos * uPaintScale;
    float n = n3(q) * 0.55 + n3(q * 3.7 + 11.0) * 0.3 + n3(q * 11.0 + 3.0) * 0.15;
    col *= 1.0 + (n - 0.5) * uPaint;
  }
  col += uEmit;
  float dist = length(cameraPosition - vWPos);
  float fog = smoothstep(uFogNear, uFogFar, dist) * uFogAmt * uFogK;
  col = mix(col, uFogCol, fog);
  gl_FragColor = vec4(col, max(lit, fog));
}`;

const HULL_VERT = /* glsl */ `
${COMMON}
attribute vec3 aOutN; attribute float aLineK;
uniform float uW; uniform float uDistRef; uniform float uMinK; uniform float uZPush;
varying float vDist;
void main() {
  vec3 on = length(aOutN) > 0.5 ? aOutN : normal;
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  on = mat3(instanceMatrix) * on;
#endif
  vec4 wp = modelMatrix * p;
  vec4 clip = projectionMatrix * viewMatrix * wp;
  vec3 wn = normalize(mat3(modelMatrix) * on);
  vec4 cn = projectionMatrix * viewMatrix * vec4(wn, 0.0);
  vec2 dpx = cn.xy * uRes;
  vec2 dir = length(dpx) > 1e-6 ? normalize(dpx) : vec2(0.0);
  float w = uW * uLineScale * (1.0 - aLineK) * (min(uRes.x, uRes.y) / 1080.0);
  w *= clamp(uDistRef / max(clip.w, 1e-3), uMinK, 1.0);
  clip.xy += dir * w * 2.0 / uRes * clip.w;
  // push the hull behind the surface: reversed depth decreases with distance and maps clip z to depth 1:1 (not 0.5)
  clip.z += (uRevZ > 0.5 ? -0.5 : 1.0) * uZPush * clip.w;
  vDist = length(cameraPosition - wp.xyz);
  gl_Position = clip;
}`;

const HULL_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform vec3 uCol; uniform float uFogK;
varying float vDist;
void main() {
  float fog = smoothstep(uFogNear, uFogFar, vDist) * uFogAmt * uFogK;
  gl_FragColor = vec4(mix(uCol, uFogCol, fog), 1.0);
}`;

export type ToonOpts = {
  color: THREE.ColorRepresentation;
  shade?: THREE.ColorRepresentation;
  shade2?: THREE.ColorRepresentation;
  /** shade derived from color when shade is omitted: 0..1 how deep */
  depth?: number;
  th?: number;
  th2?: number;
  soft?: number;
  bias?: number;
  spec?: number;
  specTh?: number;
  hi?: THREE.ColorRepresentation;
  rim?: number;
  emit?: THREE.ColorRepresentation;
  emitK?: number;
  fog?: number;
  receive?: boolean;
  sphere?: [number, number, number, number];
  hair?: { hi: THREE.ColorRepresentation; band: [number, number]; amt?: number };
  decal?: { tex: THREE.Texture; rect: [number, number, number, number]; shade?: number };
  /** screen-space line flags for the line pass: depth edges (for objects without a hull) and creases */
  depthLines?: boolean;
  crease?: boolean;
  flat?: boolean;
  unlit?: boolean;
  side?: THREE.Side;
  vertexColors?: boolean;
  transparent?: boolean;
  opacity?: number;
  /** painted-background texture: world-space noise modulating the fill (0.1-0.3), scale in 1/m */
  paint?: number;
  paintScale?: number;
  /** brightness of back faces (cloth interiors 0.7; interior walls seen from inside 1) */
  inner?: number;
  /** instanced ground cover (grass): instances rooted inside the G.uClear discs are not drawn */
  clearable?: boolean;
};

const SHADOW_TINT = new THREE.Color("#8079b0");

/** Hue-shifted shadow of a base colour: multiplied toward the shadow tint (cool violet by default). */
export function shadeOf(base: THREE.ColorRepresentation, depth = 1, tint: THREE.Color = SHADOW_TINT) {
  const b = new THREE.Color(base);
  const t = tint.clone().multiplyScalar(1.32);
  const s = new THREE.Color(b.r * t.r, b.g * t.g, b.b * t.b);
  return b.clone().lerp(s, Math.min(1, depth));
}

export function inkOf(base: THREE.ColorRepresentation, k = 0.32) {
  const b = new THREE.Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  b.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.9 + 0.15), Math.max(0.04, hsl.l * k));
}

export function toon(o: ToonOpts) {
  const color = new THREE.Color(o.color);
  const shade = o.shade !== undefined ? new THREE.Color(o.shade) : shadeOf(color, o.depth ?? 1);
  const shade2 = o.shade2 !== undefined ? new THREE.Color(o.shade2) : shadeOf(shade, 0.6);
  const flags = (o.depthLines ? 1 : 0) + (o.crease ? 2 : 0);
  const m = new THREE.ShaderMaterial({
    vertexShader: TOON_VERT,
    fragmentShader: TOON_FRAG,
    side: o.side ?? THREE.FrontSide,
    vertexColors: !!o.vertexColors,
    transparent: !!o.transparent,
    uniforms: {
      ...G,
      uColor: { value: color },
      uShade: { value: shade },
      uShade2: { value: shade2 },
      uHi: { value: new THREE.Color(o.hi ?? "#ffffff") },
      uEmit: { value: new THREE.Color(o.emit ?? "#000000").multiplyScalar(o.emitK ?? 1) },
      uTh: { value: o.th ?? 0.5 },
      uTh2: { value: o.th2 ?? 0 },
      uSoft: { value: o.soft ?? 0.012 },
      uBias: { value: o.bias ?? 0 },
      uSpec: { value: o.spec ?? 0 },
      uSpecTh: { value: o.specTh ?? 0.97 },
      uRimK: { value: o.rim ?? 1 },
      uFogK: { value: o.fog ?? 1 },
      uReceive: { value: o.receive === false ? 0 : 1 },
      uId: { value: nextId() * 4 + flags },
      uOpacity: { value: o.opacity ?? 1 },
      uSphere: { value: new THREE.Vector4(...(o.sphere ?? [0, 0, 0, 0])) },
      uDecalOn: { value: o.decal ? 1 : 0 },
      uDecal: { value: o.decal?.tex ?? null },
      uDecalRect: { value: new THREE.Vector4(...(o.decal?.rect ?? [0, 0, 1, 1])) },
      uDecalShade: { value: o.decal?.shade ?? 0.86 },
      uHair: { value: o.hair ? o.hair.amt ?? 1 : 0 },
      uHairHi: { value: new THREE.Color(o.hair?.hi ?? "#ffffff") },
      uHairBand: { value: new THREE.Vector2(...(o.hair?.band ?? [0.2, 0.3])) },
      uFlat: { value: o.flat ? 1 : 0 },
      uUnlit: { value: o.unlit ? 1 : 0 },
      uPaint: { value: o.paint ?? 0 },
      uPaintScale: { value: o.paintScale ?? 0.6 },
      uInner: { value: o.inner ?? 0.7 },
      uClearK: { value: o.clearable ? 1 : 0 },
    },
  });
  return m;
}

export type HullOpts = { color?: THREE.ColorRepresentation; width?: number; distRef?: number; minK?: number; zpush?: number; fog?: number };

export function hullMat(o: HullOpts = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: HULL_VERT,
    fragmentShader: HULL_FRAG,
    side: THREE.BackSide,
    uniforms: {
      ...G,
      uCol: { value: new THREE.Color(o.color ?? "#1d1216") },
      uW: { value: o.width ?? 2.6 },
      uDistRef: { value: o.distRef ?? 3.5 },
      uMinK: { value: o.minK ?? 0.3 },
      uZPush: { value: o.zpush ?? 0.0006 },
      uFogK: { value: o.fog ?? 1 },
    },
  });
}

/** Average normals of coincident vertices into aOutN so hulls stay closed on hard edges and seams. */
export function smoothOutlineNormals(g: THREE.BufferGeometry) {
  if (g.getAttribute("aOutN")) return g;
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const map = new Map<string, THREE.Vector3>();
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const v = map.get(k) ?? new THREE.Vector3();
    v.x += nor.getX(i); v.y += nor.getY(i); v.z += nor.getZ(i);
    map.set(k, v);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = map.get(key(i))!.clone().normalize();
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
  g.setAttribute("aOutN", new THREE.BufferAttribute(out, 3));
  return g;
}

/** A toon mesh (layer BASE, optionally a shadow caster) with an optional inverted-hull outline child. */
export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, o: { hull?: HullOpts | false; cast?: boolean; name?: string } = {}) {
  const me = new THREE.Mesh(geo, m);
  me.layers.set(LAYER.BASE);
  if (o.cast) me.layers.enable(LAYER.CASTER);
  if (o.name) me.name = o.name;
  if (o.hull !== false && o.hull !== undefined) {
    smoothOutlineNormals(geo);
    const h = new THREE.Mesh(geo, hullMat(o.hull));
    h.layers.set(LAYER.HULL);
    h.name = "hull";
    me.add(h);
  }
  return me;
}

/** Instanced toon mesh with optional hull (shares the instance matrices). */
export function instanced(geo: THREE.BufferGeometry, m: THREE.Material, count: number, o: { hull?: HullOpts | false; cast?: boolean } = {}) {
  const im = new THREE.InstancedMesh(geo, m, count);
  im.layers.set(LAYER.BASE);
  if (o.cast) im.layers.enable(LAYER.CASTER);
  im.frustumCulled = false;
  let h: THREE.InstancedMesh | null = null;
  if (o.hull) {
    smoothOutlineNormals(geo);
    h = new THREE.InstancedMesh(geo, hullMat(o.hull), count);
    h.layers.set(LAYER.HULL);
    h.frustumCulled = false;
    h.instanceMatrix = im.instanceMatrix;
    im.add(h);
  }
  return im;
}

/** Unlit additive sprite-like material for glows and light FX (drawn in the colour pass, invisible to lines). */
export function glowMat(tex: THREE.Texture, color: THREE.ColorRepresentation, opacity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: { ...G, tMap: { value: tex }, uCol: { value: new THREE.Color(color) }, uOp: { value: opacity } },
    vertexShader: /* glsl */ `varying vec2 vUv;
      void main(){ vUv = uv; vec4 p = vec4(position,1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    fragmentShader: /* glsl */ `precision highp float; uniform float uPass; uniform sampler2D tMap; uniform vec3 uCol; uniform float uOp; varying vec2 vUv;
      void main(){ if (uPass > 0.5) discard; vec4 t = texture2D(tMap, vUv); gl_FragColor = vec4(uCol * t.rgb * t.a * uOp, 0.0); }`,
  });
}
