/**
 * Cel engine core: one shared WebGL2 renderer per browser tab, supersampled render targets and the
 * anime "satsuei" (compositing) chain.
 *
 * Passes per frame
 *  1. shadow   directional light depth from casters (layer CASTER), optional
 *  2. colour   toon materials + inverted-hull outlines (layers BASE + HULL); alpha = lit mask
 *  3. normal   the same materials with G.uPass = 1 write (view normal xy, view depth, id*4+flags)
 *  4. comp     colour + screen-space lines (inverse-depth Laplacian, normal creases, id borders) + halftone
 *  5. half     downsample of comp, then bloom (two levels) and depth-of-field blur
 *  6. final    DOF mix, bloom, god rays toward the sun, grade, para gradient, aberration, vignette, grain
 *
 * Colours are authored and blended in display space (ColorManagement off): band colours are exact.
 */
import * as THREE from "three";

THREE.ColorManagement.enabled = false;

export const LAYER = { BASE: 0, HULL: 1, CASTER: 3 } as const;

/** Uniforms shared by every cel material (by reference). */
export const G = {
  uPass: { value: 0 },
  uLightDir: { value: new THREE.Vector3(0.5, 0.75, 0.45).normalize() },
  uLightCol: { value: new THREE.Color(1, 1, 1) },
  uShadowTint: { value: new THREE.Color("#7c74a8") },
  uRimDir: { value: new THREE.Vector3(-0.6, 0.3, -0.7).normalize() },
  uRimCol: { value: new THREE.Color("#fff1d0") },
  uRimAmt: { value: 0.0 },
  uRes: { value: new THREE.Vector2(1920, 1080) },
  uFogCol: { value: new THREE.Color("#c9d8e6") },
  uFogNear: { value: 60 },
  uFogFar: { value: 900 },
  uFogAmt: { value: 0.0 },
  uShadowOn: { value: 0 },
  uShadowMap: { value: null as THREE.Texture | null },
  uShadowMat: { value: new THREE.Matrix4() },
  uShadowSoft: { value: 1.0 },
  uLineScale: { value: 1.0 },
  uTime: { value: 0 },
  /** multiplies every shadow band (night: deep blue, lamplight: warm dark); white = authored shades */
  uShadeK: { value: new THREE.Color(1, 1, 1) },
  /** ground discs (x, base y, z, r) where grass is not drawn: resting props, seated people (contact.ts) */
  uClear: { value: Array.from({ length: 48 }, () => new THREE.Vector4()) },
  uClearN: { value: 0 },
  /** 1 when the renderer uses a reversed float depth buffer (core()); shaders that compare depths read it */
  uRevZ: { value: 0 },
};

export type Post = {
  /** screen-space line width in output px (0 = off) */
  lineW: number;
  lineCol: THREE.Color;
  /** how much the line takes the hue of what it sits on (0 = pure ink) */
  lineTint: number;
  depthT: number;
  creaseT: number;
  bloom: number;
  bloomT: number;
  bloomCol: THREE.Color;
  halftone: number;
  halftoneSize: number;
  /** depth of field: focus distance (m), range (m) over which blur ramps, amount 0..1 */
  focus: number;
  focusRange: number;
  dof: number;
  /** god rays from the sun's screen position (computed from sunDir) */
  rays: number;
  raysCol: THREE.Color;
  sunDir: THREE.Vector3 | null;
  /** grade */
  exposure: number;
  contrast: number;
  saturation: number;
  lift: THREE.Color;
  gain: THREE.Color;
  /** para: vertical gradient overlay (top colour, bottom colour, amounts) */
  paraTop: THREE.Color;
  paraBot: THREE.Color;
  paraAmt: number;
  aberration: number;
  vignette: number;
  grain: number;
  paper: number;
  flash: number;
  flashCol: THREE.Color;
  /** impact frame: 0..1 posterised inverted silhouette */
  impact: number;
};

export const defaultPost = (): Post => ({
  lineW: 1.6,
  lineCol: new THREE.Color("#1c1418"),
  lineTint: 0.35,
  depthT: 0.012,
  creaseT: 0.45,
  bloom: 0.3,
  bloomT: 0.9,
  bloomCol: new THREE.Color("#fff3dc"),
  halftone: 0,
  halftoneSize: 7,
  focus: 4,
  focusRange: 6,
  dof: 0,
  rays: 0,
  raysCol: new THREE.Color("#ffe2a8"),
  sunDir: null,
  exposure: 1,
  contrast: 1.1,
  saturation: 1.12,
  lift: new THREE.Color(0, 0, 0),
  gain: new THREE.Color(1, 1, 1),
  paraTop: new THREE.Color("#ffffff"),
  paraBot: new THREE.Color("#ffffff"),
  paraAmt: 0,
  aberration: 0.6,
  vignette: 0.35,
  grain: 0.035,
  paper: 0.025,
  flash: 0,
  flashCol: new THREE.Color("#ffffff"),
  impact: 0,
});

const FSQ_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tC; uniform sampler2D tN; uniform sampler2D tD;
uniform vec2 uTexel; uniform float uLineOff; uniform vec3 uLineCol; uniform float uLineTint;
uniform float uDepthT; uniform float uCreaseT; uniform float uHalftone; uniform float uHalfSize;
uniform float uFocus; uniform float uFocusRange; uniform float uNear; uniform float uFar; uniform float uRevZ;
float lin(float d) {
  if (uRevZ > 0.5) return uNear * uFar / (uNear + d * (uFar - uNear));
  float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
vec3 nrm(vec2 e) { return vec3(e, sqrt(max(0.0, 1.0 - dot(e, e)))); }
void main() {
  vec4 c = texture2D(tC, vUv);
  vec2 o = uTexel * uLineOff;
  vec4 C = texture2D(tN, vUv);
  vec4 L = texture2D(tN, vUv - vec2(o.x, 0.0));
  vec4 R = texture2D(tN, vUv + vec2(o.x, 0.0));
  vec4 D = texture2D(tN, vUv - vec2(0.0, o.y));
  vec4 U = texture2D(tN, vUv + vec2(0.0, o.y));
  float edge = 0.0;
  if (C.a > 0.5) {
    float wc = 1.0 / max(C.z, 1e-4);
    float wl = L.a > 0.5 ? 1.0 / max(L.z, 1e-4) : 0.0;
    float wr = R.a > 0.5 ? 1.0 / max(R.z, 1e-4) : 0.0;
    float wd = D.a > 0.5 ? 1.0 / max(D.z, 1e-4) : 0.0;
    float wu = U.a > 0.5 ? 1.0 / max(U.z, 1e-4) : 0.0;
    float lap = max(2.0 * wc - wl - wr, 2.0 * wc - wu - wd) / wc;
    float flags = mod(C.a, 4.0);
    float depthOn = step(0.5, mod(flags, 2.0));
    float creaseOn = step(1.5, flags);
    float idc = floor(C.a / 4.0);
    float eD = depthOn * smoothstep(uDepthT, uDepthT * 2.0, lap);
    vec3 nc = nrm(C.xy);
    float same = 1.0;
    float dn = 0.0;
    if (floor(R.a / 4.0) == idc) dn = max(dn, 1.0 - dot(nc, nrm(R.xy)));
    if (floor(U.a / 4.0) == idc) dn = max(dn, 1.0 - dot(nc, nrm(U.xy)));
    if (floor(L.a / 4.0) == idc) dn = max(dn, 1.0 - dot(nc, nrm(L.xy)));
    if (floor(D.a / 4.0) == idc) dn = max(dn, 1.0 - dot(nc, nrm(D.xy)));
    float eC = creaseOn * smoothstep(uCreaseT, uCreaseT * 1.4, dn);
    // object border with a non-hull object nearer or level: material boundary line. Faded in over 1.5 % of depth, not
    // switched at a hard ratio: a trim 7 cm proud at 20 m, or overlapping curls of hair, sat at the old 0.5 % threshold
    // and the line popped on and off as the camera moved
    float eI = 0.0;
    if (floor(R.a / 4.0) != idc && R.a > 0.5) eI = max(eI, smoothstep(0.985, 1.0, wc / max(wr, 1e-6)));
    if (floor(U.a / 4.0) != idc && U.a > 0.5) eI = max(eI, smoothstep(0.985, 1.0, wc / max(wu, 1e-6)));
    eI *= depthOn;
    edge = max(max(eD, eC), eI);
  }
  vec3 ink = mix(uLineCol, c.rgb * uLineCol * 2.2, uLineTint);
  vec3 col = mix(c.rgb, ink, edge);
  // halftone in shadow (alpha = lit mask)
  if (uHalftone > 0.0) {
    vec2 px = gl_FragCoord.xy / uHalfSize;
    vec2 r = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px;
    vec2 cell = fract(r) - 0.5;
    float shade = 1.0 - c.a;
    float rad = 0.36 * shade;
    float dot_ = 1.0 - smoothstep(rad - 0.08, rad + 0.08, length(cell));
    col *= 1.0 - uHalftone * 0.22 * dot_ * shade;
  }
  float z = lin(texture2D(tD, vUv).r);
  float coc = clamp(abs(z - uFocus) / max(uFocusRange, 1e-3), 0.0, 1.0);
  gl_FragColor = vec4(col, coc);
}`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
void main() {
  vec4 a = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 b = texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0));
  vec4 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 d = texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0));
  gl_FragColor = (a + b + c + d) * 0.25;
}`;

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; uniform sampler2D tSrc; uniform float uT;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uT, uT + 0.25, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main() {
  vec4 s = texture2D(tSrc, vUv) * 0.2270270270;
  s += texture2D(tSrc, vUv + uDir * 1.3846153846) * 0.3162162162;
  s += texture2D(tSrc, vUv - uDir * 1.3846153846) * 0.3162162162;
  s += texture2D(tSrc, vUv + uDir * 3.2307692308) * 0.0702702703;
  s += texture2D(tSrc, vUv - uDir * 3.2307692308) * 0.0702702703;
  gl_FragColor = s;
}`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tComp; uniform sampler2D tDof; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tHalf;
uniform float uDof; uniform float uBloom; uniform vec3 uBloomCol;
uniform float uRays; uniform vec3 uRaysCol; uniform vec2 uSun; uniform float uSunOn;
uniform float uExposure; uniform float uContrast; uniform float uSat; uniform vec3 uLift; uniform vec3 uGain;
uniform vec3 uParaTop; uniform vec3 uParaBot; uniform float uParaAmt;
uniform float uAberr; uniform float uVig; uniform float uGrain; uniform float uPaper; uniform float uSeed;
uniform float uFlash; uniform vec3 uFlashCol; uniform float uImpact; uniform vec2 uRes;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 uv = vUv;
  vec2 dc = uv - 0.5;
  float r2 = dot(dc, dc);
  vec2 ab = dc * r2 * uAberr * 0.012;
  vec4 cc = texture2D(tComp, uv);
  vec3 col = vec3(texture2D(tComp, uv + ab).r, cc.g, texture2D(tComp, uv - ab).b);
  if (uDof > 0.0) {
    vec4 bl = texture2D(tDof, uv);
    float coc = max(cc.a, bl.a * 0.85);
    col = mix(col, bl.rgb, clamp(coc * uDof * 1.15, 0.0, 1.0));
  }
  vec3 bloom = texture2D(tB1, uv).rgb * 0.6 + texture2D(tB2, uv).rgb * 0.9;
  col += bloom * uBloom * uBloomCol;
  if (uRays > 0.0 && uSunOn > 0.5) {
    vec2 dir = (uSun - uv) / 28.0;
    vec2 p = uv; float acc = 0.0; float w = 1.0;
    for (int i = 0; i < 28; i++) {
      p += dir;
      vec3 s = texture2D(tHalf, p).rgb;
      float l = smoothstep(0.82, 1.0, max(s.r, max(s.g, s.b)));
      acc += l * w; w *= 0.955;
    }
    float fall = 1.0 - smoothstep(0.0, 1.1, length((uv - uSun) * vec2(uRes.x / uRes.y, 1.0)));
    col += uRaysCol * acc / 28.0 * uRays * (0.4 + fall);
  }
  col *= uExposure;
  col = mix(vec3(0.5), col, uContrast);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat);
  col = col * uGain + uLift * (1.0 - col);
  vec3 para = mix(uParaBot, uParaTop, uv.y);
  col = mix(col, col * para, uParaAmt);
  col *= 1.0 - uVig * smoothstep(0.18, 0.75, r2 * 1.6);
  float paper = vnoise(gl_FragCoord.xy / 3.0) * 0.6 + vnoise(gl_FragCoord.xy / 41.0) * 0.4;
  col *= 1.0 - uPaper * (paper - 0.5) * 2.0;
  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) * uGrain;
  col = mix(col, uFlashCol, uFlash);
  if (uImpact > 0.0) {
    float l2 = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 imp = l2 > 0.42 ? vec3(0.06, 0.04, 0.08) : vec3(1.0, 0.97, 0.9);
    col = mix(col, imp, uImpact);
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

type Targets = {
  w: number; h: number; ss: number;
  color: THREE.WebGLRenderTarget; normal: THREE.WebGLRenderTarget; comp: THREE.WebGLRenderTarget;
  half: THREE.WebGLRenderTarget; b1a: THREE.WebGLRenderTarget; b1b: THREE.WebGLRenderTarget;
  b2a: THREE.WebGLRenderTarget; b2b: THREE.WebGLRenderTarget; da: THREE.WebGLRenderTarget; db: THREE.WebGLRenderTarget;
  shadow: THREE.WebGLRenderTarget;
};

type Core = {
  renderer: THREE.WebGLRenderer;
  t: Targets | null;
  quad: THREE.Mesh;
  qScene: THREE.Scene;
  qCam: THREE.OrthographicCamera;
  mats: Record<string, THREE.ShaderMaterial>;
  depthMat: THREE.MeshDepthMaterial;
};

let CORE: Core | null = null;

const rt = (w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    ...opts,
  });

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: FSQ_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

function core(): Core {
  if (CORE) return CORE;
  const canvas = document.createElement("canvas");
  // Reversed float depth (EXT_clip_control): near-uniform depth precision from the 5 cm near plane to the horizon. With the
  // old 24-bit standard depth a surface 300 m away resolved only to ~13 cm, so trims, roof slabs and fold lines z-fought.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance", reversedDepthBuffer: true });
  G.uRevZ.value = renderer.capabilities.reversedDepthBuffer ? 1 : 0;
  if (!G.uRevZ.value) console.warn("[engine] EXT_clip_control missing: standard 24-bit depth (distant trims may z-fight)");
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = true;
  const qScene = new THREE.Scene();
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  qScene.add(quad);
  const mats = {
    comp: mat(COMP_FRAG, {
      tC: { value: null }, tN: { value: null }, tD: { value: null }, uTexel: { value: new THREE.Vector2() }, uLineOff: { value: 1 },
      uLineCol: { value: new THREE.Color() }, uLineTint: { value: 0.3 }, uDepthT: { value: 0.01 }, uCreaseT: { value: 0.4 },
      uHalftone: { value: 0 }, uHalfSize: { value: 8 }, uFocus: { value: 4 }, uFocusRange: { value: 4 }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uRevZ: G.uRevZ,
    }),
    down: mat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }),
    bright: mat(BRIGHT_FRAG, { tSrc: { value: null }, uT: { value: 0.8 } }),
    blur: mat(BLUR_FRAG, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }),
    final: mat(FINAL_FRAG, {
      tComp: { value: null }, tDof: { value: null }, tB1: { value: null }, tB2: { value: null }, tHalf: { value: null },
      uDof: { value: 0 }, uBloom: { value: 0.5 }, uBloomCol: { value: new THREE.Color() }, uRays: { value: 0 }, uRaysCol: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector2(0.5, 0.8) }, uSunOn: { value: 0 }, uExposure: { value: 1 }, uContrast: { value: 1 }, uSat: { value: 1 },
      uLift: { value: new THREE.Color(0, 0, 0) }, uGain: { value: new THREE.Color(1, 1, 1) }, uParaTop: { value: new THREE.Color() },
      uParaBot: { value: new THREE.Color() }, uParaAmt: { value: 0 }, uAberr: { value: 0.5 }, uVig: { value: 0.3 }, uGrain: { value: 0.03 },
      uPaper: { value: 0.02 }, uSeed: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color() }, uImpact: { value: 0 },
      uRes: { value: new THREE.Vector2(1920, 1080) },
    }),
  };
  const depthMat = new THREE.MeshDepthMaterial();
  CORE = { renderer, t: null, quad, qScene, qCam, mats, depthMat };
  return CORE;
}

function targets(c: Core, w: number, h: number, ss: number): Targets {
  if (c.t && c.t.w === w && c.t.h === h && c.t.ss === ss) return c.t;
  if (c.t) Object.values(c.t).forEach((v) => (v instanceof THREE.WebGLRenderTarget ? v.dispose() : null));
  const W = w * ss, H = h * ss;
  // 32-bit float depth everywhere (DEPTH_COMPONENT32F): the reversed depth buffer only pays off with float storage
  const depth = (dw: number, dh: number) => new THREE.DepthTexture(dw, dh, THREE.FloatType);
  const color = rt(W, H, { depthBuffer: true, depthTexture: depth(W, H) });
  // the line pass reads view depth from this target: float32, since half floats hold 30 m only to ~3 cm (300 m to ~25 cm),
  // the size of a trim's step, so depth and material-border lines along distant trims popped on and off as the camera moved
  const normal = rt(W, H, { type: THREE.FloatType, depthBuffer: true, depthTexture: depth(W, H), minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const shadow = new THREE.WebGLRenderTarget(2048, 2048, { depthBuffer: true, depthTexture: depth(2048, 2048) });
  c.t = {
    w, h, ss, color, normal, comp: rt(W, H), half: rt(w / 2, h / 2),
    b1a: rt(w / 4, h / 4), b1b: rt(w / 4, h / 4), b2a: rt(w / 8, h / 8), b2b: rt(w / 8, h / 8),
    da: rt(w / 2, h / 2), db: rt(w / 2, h / 2), shadow,
  };
  return c.t;
}

function pass(c: Core, m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
  c.quad.material = m;
  c.renderer.setRenderTarget(target);
  c.renderer.render(c.qScene, c.qCam);
}

function blur2(c: Core, src: THREE.WebGLRenderTarget, a: THREE.WebGLRenderTarget, b: THREE.WebGLRenderTarget, radius: number, iters: number) {
  const m = c.mats.blur;
  let from = src;
  for (let i = 0; i < iters; i++) {
    m.uniforms.tSrc.value = from.texture;
    m.uniforms.uDir.value.set((radius * (i + 1)) / a.width, 0);
    pass(c, m, a);
    m.uniforms.tSrc.value = a.texture;
    m.uniforms.uDir.value.set(0, (radius * (i + 1)) / a.height);
    pass(c, m, b);
    from = b;
  }
}

export type ShadowBox = { center: THREE.Vector3; size: number; depth?: number };

/** Render one frame of `scene` through `camera` and the post chain into the core canvas; returns that canvas. */
export function renderFrame(scene: THREE.Scene, camera: THREE.PerspectiveCamera, w: number, h: number, post: Post, opts: { ss?: number; shadow?: ShadowBox | null; seed?: number; clear?: THREE.Color } = {}) {
  const c = core();
  const ss = opts.ss ?? 2;
  const t = targets(c, w, h, ss);
  const r = c.renderer;
  if (r.domElement.width !== w || r.domElement.height !== h) r.setSize(w, h, false);
  G.uRes.value.set(w * ss, h * ss);
  r.setClearColor(opts.clear ?? new THREE.Color("#000000"), 1);

  // 1 shadow
  if (opts.shadow) {
    const sb = opts.shadow;
    const L = G.uLightDir.value.clone().normalize();
    const dist = sb.depth ?? sb.size * 3;
    const sc = new THREE.OrthographicCamera(-sb.size, sb.size, sb.size, -sb.size, 0.1, dist * 2);
    sc.position.copy(sb.center).addScaledVector(L, dist);
    sc.up.set(0, 1, 0);
    if (Math.abs(L.y) > 0.98) sc.up.set(0, 0, 1);
    sc.lookAt(sb.center);
    sc.updateMatrixWorld();
    sc.updateProjectionMatrix();
    sc.layers.set(LAYER.CASTER);
    scene.overrideMaterial = c.depthMat;
    G.uShadowOn.value = 0;
    r.setRenderTarget(t.shadow);
    r.clear();
    r.render(scene, sc);
    scene.overrideMaterial = null;
    G.uShadowMap.value = t.shadow.depthTexture;
    G.uShadowMat.value.multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse);
    G.uShadowOn.value = 1;
  } else {
    G.uShadowOn.value = 0;
  }

  // 2 colour
  camera.layers.set(LAYER.BASE);
  camera.layers.enable(LAYER.HULL);
  G.uPass.value = 0;
  r.setRenderTarget(t.color);
  r.clear();
  r.render(scene, camera);

  // 3 normal / depth / id
  camera.layers.set(LAYER.BASE);
  G.uPass.value = 1;
  r.setClearColor(new THREE.Color(0, 0, 0), 0);
  r.setRenderTarget(t.normal);
  r.clear();
  r.render(scene, camera);
  G.uPass.value = 0;
  camera.layers.enable(LAYER.HULL);

  // 4 comp
  const m = c.mats.comp.uniforms;
  m.tC.value = t.color.texture;
  m.tN.value = t.normal.texture;
  m.tD.value = t.color.depthTexture;
  m.uTexel.value.set(1 / (w * ss), 1 / (h * ss));
  m.uLineOff.value = Math.max(0.5, post.lineW * ss * 0.5);
  m.uLineCol.value.copy(post.lineCol);
  m.uLineTint.value = post.lineTint;
  m.uDepthT.value = post.lineW > 0 ? post.depthT : 1e9;
  m.uCreaseT.value = post.lineW > 0 ? post.creaseT : 1e9;
  m.uHalftone.value = post.halftone;
  m.uHalfSize.value = post.halftoneSize * ss;
  m.uFocus.value = post.focus;
  m.uFocusRange.value = post.focusRange;
  m.uNear.value = camera.near;
  m.uFar.value = camera.far;
  pass(c, c.mats.comp, t.comp);

  // 5 half, bloom, dof
  const d = c.mats.down.uniforms;
  d.tSrc.value = t.comp.texture;
  d.uTexel.value.set(0.5 / (w * ss) * ss, 0.5 / (h * ss) * ss);
  pass(c, c.mats.down, t.half);
  const b = c.mats.bright.uniforms;
  b.tSrc.value = t.half.texture;
  b.uT.value = post.bloomT;
  pass(c, c.mats.bright, t.b1a);
  blur2(c, t.b1a, t.b1b, t.b1a, 1.0, 2);
  d.tSrc.value = t.b1a.texture;
  d.uTexel.value.set(0.5 / t.b1a.width, 0.5 / t.b1a.height);
  pass(c, c.mats.down, t.b2a);
  blur2(c, t.b2a, t.b2b, t.b2a, 1.2, 3);
  if (post.dof > 0) blur2(c, t.half, t.da, t.db, 1.4, 3);

  // 6 final
  const f = c.mats.final.uniforms;
  f.tComp.value = t.comp.texture;
  f.tDof.value = post.dof > 0 ? t.db.texture : t.half.texture;
  f.tB1.value = t.b1a.texture;
  f.tB2.value = t.b2a.texture;
  f.tHalf.value = t.half.texture;
  f.uDof.value = post.dof;
  f.uBloom.value = post.bloom;
  f.uBloomCol.value.copy(post.bloomCol);
  f.uRays.value = post.rays;
  f.uRaysCol.value.copy(post.raysCol);
  f.uSunOn.value = 0;
  if (post.sunDir && post.rays > 0) {
    const sunW = camera.position.clone().addScaledVector(post.sunDir.clone().normalize(), 1000);
    const inFront = sunW.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
    const sp = sunW.project(camera);
    if (inFront) {
      f.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
      f.uSunOn.value = 1;
    }
  }
  f.uExposure.value = post.exposure;
  f.uContrast.value = post.contrast;
  f.uSat.value = post.saturation;
  f.uLift.value.copy(post.lift);
  f.uGain.value.copy(post.gain);
  f.uParaTop.value.copy(post.paraTop);
  f.uParaBot.value.copy(post.paraBot);
  f.uParaAmt.value = post.paraAmt;
  f.uAberr.value = post.aberration;
  f.uVig.value = post.vignette;
  f.uGrain.value = post.grain;
  f.uPaper.value = post.paper;
  f.uSeed.value = ((opts.seed ?? 0) * 7.13) % 97;
  f.uFlash.value = post.flash;
  f.uFlashCol.value.copy(post.flashCol);
  f.uImpact.value = post.impact;
  f.uRes.value.set(w, h);
  pass(c, c.mats.final, null);
  return r.domElement;
}

/** Dispose every geometry, material and texture under `root` that is not marked userData.keep. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh || (o as THREE.Points).isPoints) {
      if (!m.geometry?.userData?.keep) m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => {
        if (!mt || mt.userData?.keep) return;
        const sm = mt as THREE.ShaderMaterial;
        if (sm.uniforms) Object.values(sm.uniforms).forEach((u) => (u.value instanceof THREE.Texture && !u.value.userData?.keep ? u.value.dispose() : null));
        mt.dispose();
      });
    }
  });
}
