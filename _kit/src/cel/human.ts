/**
 * Humans: a joint hierarchy (Groups) carrying rigid toon parts (no skinning), robes, mantle, sleeves, hands
 * with three-segment fingers, sandals, and the head (sculpt + face decal + hair + beard/veil).
 *
 * Space: metres, feet on y = 0, facing +z. Character's left = +x. Angles in poses are degrees.
 * Pose semantics (mirrored for the right side so poses read symmetrically):
 *   spine/chest/neck/head/hips [pitch fwd+, yaw to own left+, roll]
 *   sh [raise forward, twist, abduct out]   el [bend]   wr [pitch fwd, twist, flex toward palm]
 *   hip [raise forward, twist, abduct]      kn [bend]   an [toe down]
 */
import * as THREE from "three";
import { V3, capsule, clamp, lerp, merge, path, rbox, sstep, sweep } from "./geo";
import { inkOf, mesh, toon } from "./toon";
import { G } from "./engine";
import { EXPR0, Expr, FACE_MALE, Face, FaceStyle, Viseme } from "./face";
import { BeardKind, HEAD_MAN, HEAD_WOMAN, HairKind, HeadShape, beardGeo, cached, earGeo, hairGeo, headGeo, neckGeo, veilGeo } from "./head";

export type JointName = "hips" | "spine" | "chest" | "neck" | "head" | "shL" | "elL" | "wrL" | "shR" | "elR" | "wrR" | "hipL" | "knL" | "anL" | "hipR" | "knR" | "anR";
export type HandPose = { curl: [number, number, number, number, number]; spread: number; thumb?: number };
export const HANDS: Record<string, HandPose> = {
  relax: { curl: [0.25, 0.3, 0.35, 0.42, 0.5], spread: 0.1 },
  open: { curl: [0.05, 0.04, 0.05, 0.07, 0.1], spread: 0.45, thumb: 0.7 },
  flat: { curl: [0.05, 0.02, 0.02, 0.02, 0.03], spread: 0.0, thumb: 0.2 },
  fist: { curl: [0.8, 1, 1, 1, 1], spread: 0 },
  point: { curl: [0.6, 0.0, 0.95, 1, 1], spread: 0.05 },
  hold: { curl: [0.55, 0.7, 0.75, 0.8, 0.85], spread: 0.05, thumb: 0.3 },
  grip: { curl: [0.7, 0.85, 0.9, 0.92, 0.95], spread: 0, thumb: 0.45 },
  cup: { curl: [0.25, 0.32, 0.34, 0.36, 0.4], spread: 0.08, thumb: 0.5 },
  bless: { curl: [0.55, 0.0, 0.02, 0.9, 0.95], spread: 0.05, thumb: 0.2 },
  touch: { curl: [0.2, 0.12, 0.2, 0.3, 0.38], spread: 0.15, thumb: 0.45 },
  /** thumb and index meeting (holding a nail, a crumb, a coin) */
  pinch: { curl: [0.55, 0.62, 0.86, 0.92, 0.95], spread: 0.05, thumb: 0.55 },
  /** palms pressed together in prayer: fingers straight and closed, the thumb laid along the index finger */
  pray: { curl: [0.02, 0.02, 0.02, 0.03, 0.04], spread: 0, thumb: 1.3 },
  /** holding something up from beneath on the palm: fingers nearly straight, so the tips stay under it */
  support: { curl: [0.2, 0.1, 0.1, 0.12, 0.15], spread: 0.1, thumb: 0.6 },
};

export type Pose = Partial<Record<JointName, [number, number, number]>> & {
  root?: { p?: [number, number, number]; r?: [number, number, number] };
  handL?: HandPose | keyof typeof HANDS;
  handR?: HandPose | keyof typeof HANDS;
};

export type Look = {
  name: string;
  s?: number;
  build?: number;
  head?: HeadShape;
  face?: Partial<FaceStyle>;
  headScale?: number;
  skin: string;
  hair: HairKind;
  hairCol: string;
  hairLen?: number;
  beard?: BeardKind;
  beardCol?: string;
  robe: string;
  robeShade?: string;
  tunic?: string;
  mantle?: string;
  mantleKind?: "drape" | "shawl" | "none";
  sash?: string;
  veil?: string;
  veilDrop?: number;
  headcloth?: string;
  sleeves?: "wide" | "narrow";
  hands?: "full" | "mitten";
  robeMode?: "stand" | "legs";
  /** flare of a "stand" robe toward the hem: 1 = full (women, elders), 0.75 = a straighter tunic that does not read as a dress */
  hem?: number;
  sandal?: string;
  ink?: number;
  lineW?: number;
  ragged?: boolean;
};

const D = THREE.MathUtils.DEG2RAD;

type Built = {
  root: THREE.Group; j: Record<JointName, THREE.Group>; head: THREE.Group; headMesh: THREE.Mesh; face: Face | null;
  fingers: Record<"L" | "R", THREE.Group[][]>; thumbs: Record<"L" | "R", THREE.Group[]>;
  mats: { skin: THREE.ShaderMaterial[]; robe: THREE.ShaderMaterial[] };
  /** bare skin below the knee (ankle stubs under a full robe, shins under a legs robe): hidden with a tucked foot */
  ankles: Record<"L" | "R", THREE.Object3D[]>;
};

const lineOf = (c: string, k = 0.3) => inkOf(c, k);

/**
 * Grips: how an object sits in a hand. `grip(sd, obj, { kind, r, at, axis })` attaches obj to the wrist so that
 * its local `axis` (default +y) runs along the thumb direction and its local point `at` sits at the grip centre:
 *   wrap  power grasp round a cylinder of radius r (hammer or tool handle r 0.014, cup r 0.035-0.045, jar neck, staff,
 *         rope); the cylinder axis lies across the palm, fingers curl round it.
 *   ball  a stone or fruit of radius r held in the curled fingers, against the palm.
 *   palm  resting on the open palm (bread, an offered coin); `axis` is the object's up.
 *   pinch small things between thumb and index tip (a crumb, a pen, a coin).
 * Hand-local frame: fingers along -y, palm toward -m*x (m = 1 left, -1 right), thumb toward +z.
 */
export type GripKind = "wrap" | "ball" | "palm" | "pinch";
const GRIP_CENTER: Record<GripKind, (m: number, r: number) => THREE.Vector3> = {
  wrap: (m, r) => V3(-m * (0.013 + r), -0.074, 0.004),
  ball: (m, r) => V3(-m * (0.006 + r * 0.85), -0.072, 0.004),
  palm: (m, r) => V3(-m * (0.017 + r), -0.05, 0),
  pinch: (m) => V3(-m * 0.026, -0.112, 0.03),
};
const gripHand = (kind: GripKind, r: number): HandPose => {
  if (kind === "palm") return HANDS.cup;
  if (kind === "pinch") return { curl: [0.55, 0.62, 0.86, 0.92, 0.95], spread: 0.05, thumb: 0.55 };
  // curl less round a wider object: a 1.4 cm handle closes the fist, a 4.5 cm cup leaves it half open
  const c = clamp(0.98 - (r - 0.012) * (kind === "ball" ? 8 : 10.5), 0.3, 0.97);
  return { curl: [c * 0.75, c, c * 1.02, c * 1.04, c * 1.06].map((x) => Math.min(1, x)) as HandPose["curl"], spread: 0.03, thumb: 0.45 };
};

export class Human {
  look: Look;
  root: THREE.Group;
  j: Record<JointName, THREE.Group>;
  head: THREE.Group;
  headMesh: THREE.Mesh;
  face: Face | null;
  fs: FaceStyle;
  e: Expr = { ...EXPR0 };
  private fingers: Built["fingers"];
  private thumbs: Built["thumbs"];
  private grips: Partial<Record<"L" | "R", { obj: THREE.Object3D; hand: HandPose; kind: GripKind; r: number }>> = {};
  private rest = new Map<THREE.Group, THREE.Vector3>();
  lens = { upper: 0.285, fore: 0.255 };
  mats: Built["mats"];
  private ankles: Built["ankles"] = { L: [], R: [] };

  /** Recolour the skin (e.g. a leper healed): lerp from the current look toward `to` by k. */
  skinTo(from: string, to: string, k: number) {
    const c = new THREE.Color(from).lerp(new THREE.Color(to), k);
    const s = new THREE.Color(shadeSkin(from)).lerp(new THREE.Color(shadeSkin(to)), k);
    this.mats.skin.forEach((m) => {
      m.uniforms.uColor.value.copy(c);
      m.uniforms.uShade.value.copy(s);
    });
  }

  /** Glow the whole figure (miracle light), 0..1. */
  glow(k: number, col = "#fff2c8") {
    const e = new THREE.Color(col).multiplyScalar(k * 0.35);
    [...this.mats.skin, ...this.mats.robe].forEach((m) => m.uniforms.uEmit.value.copy(e));
  }

  constructor(look: Look, o: { facePPM?: number; detail?: "hero" | "mid" | "crowd" } = {}) {
    this.look = look;
    const detail = o.detail ?? "hero";
    const fs: FaceStyle = { ...FACE_MALE, skin: look.skin, skinShade: new THREE.Color(look.skin).multiplyScalar(0.78).getStyle(), ...look.face };
    this.fs = fs;
    const b = build(look, fs, detail, o.facePPM ?? (detail === "hero" ? 9000 : detail === "mid" ? 4500 : 0));
    this.root = b.root;
    this.j = b.j;
    this.head = b.head;
    this.headMesh = b.headMesh;
    this.face = b.face;
    this.fingers = b.fingers;
    this.thumbs = b.thumbs;
    this.mats = b.mats;
    this.ankles = b.ankles;
    (Object.values(this.j) as THREE.Group[]).forEach((g) => this.rest.set(g, g.position.clone()));
    this.root.userData.human = this;
    this.pose({});
  }

  /** Full hands (fingers and thumb) on this side; crowd figures have mittens, which the contact pass skips. */
  hasFingers(sd: "L" | "R") {
    return this.fingers[sd].length > 0;
  }

  /**
   * Move a hand rigidly by a world offset: the wrist moves, the hand keeps its world orientation and the elbow stays
   * on its side. The contact pass (contact.ts) uses it to take hands out of props.
   */
  nudgeHand(sd: "L" | "R", by: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    const wr = this.j[`wr${sd}`];
    const q = wr.getWorldQuaternion(new THREE.Quaternion());
    const W = wr.getWorldPosition(V3()), E = this.j[`el${sd}`].getWorldPosition(V3()), S = this.j[`sh${sd}`].getWorldPosition(V3());
    const ax = W.clone().sub(S).normalize();
    const pole = E.sub(S);
    pole.addScaledVector(ax, -pole.dot(ax));
    this.reach(sd, W.add(by), pole.lengthSq() > 1e-8 ? pole.normalize() : undefined);
    wr.quaternion.copy(wr.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    this.root.updateMatrixWorld(true);
  }

  /**
   * The ground disc (x, ground y, z, r) a seated or kneeling figure covers (hips, knees and feet, plus a little), for
   * clearing the grass under it; null when standing or hidden.
   */
  seatFootprint() {
    if (!this.root.visible) return null;
    this.root.updateMatrixWorld(true);
    const s = this.root.getWorldScale(V3()).x;
    const g = this.root.getWorldPosition(V3()).y;
    const hips = this.j.hips.getWorldPosition(V3());
    if (hips.y - g > 0.62 * s) return null;
    const pts = [hips, ...(["knL", "knR", "anL", "anR"] as const).map((n) => this.j[n].getWorldPosition(V3()))];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cz = pts.reduce((a, p) => a + p.z, 0) / pts.length;
    const r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz))) + 0.08 * s;
    return new THREE.Vector4(cx, g, cz, r);
  }

  /** Apply a pose (unspecified joints return to rest). */
  pose(p: Pose) {
    const set = (n: JointName, f: (a: [number, number, number]) => [number, number, number], order: THREE.EulerOrder = "ZXY") => {
      const a = p[n] ?? [0, 0, 0];
      const [x, y, z] = f(a);
      this.j[n].quaternion.setFromEuler(new THREE.Euler(x * D, y * D, z * D, order));
    };
    for (const n of ["hips", "spine", "chest", "neck", "head"] as JointName[]) set(n, ([a, b, c]) => [a, b, c], "YXZ");
    for (const sd of ["L", "R"] as const) {
      const m = sd === "L" ? 1 : -1;
      set(`sh${sd}`, ([r, t, ab]) => [-r, m * t, m * ab]);
      set(`el${sd}`, ([bend, tw]) => [-bend, m * (tw ?? 0), 0]);
      set(`wr${sd}`, ([pt, tw, fl]) => [-pt, m * tw, -m * fl], "XYZ");
      set(`hip${sd}`, ([r, t, ab]) => [-r, m * t, m * ab]);
      set(`kn${sd}`, ([bend]) => [bend, 0, 0]);
      set(`an${sd}`, ([td]) => [td, 0, 0]);
    }
    const rp = p.root?.p ?? [0, 0, 0];
    this.j.hips.position.copy(this.rest.get(this.j.hips)!).add(V3(rp[0], rp[1], rp[2]));
    this.hand("L", p.handL ?? this.grips.L?.hand ?? "relax");
    this.hand("R", p.handR ?? this.grips.R?.hand ?? "relax");
    this.posedNeck.copy(this.j.neck.quaternion);
    this.posedHead.copy(this.j.head.quaternion);
    this.root.updateMatrixWorld(true);
    if (this.autoFeet) this.tuckFeet(p);
  }

  /** Hide tucked feet automatically (kneeling, sitting on the heels); false = always show them. */
  autoFeet = true;
  /**
   * A foot folded under or behind the body (knee bent past 80°, toes behind the hips, ankle under them) is hidden with
   * its sandal: robes do not fold round the legs, so such feet stuck out through the back of the robe (in seiza the
   * ankle is right under the hips and the foot points back). Feet in front of or beside the body (sitting with knees
   * up, cross-legged, on a bench) stay.
   */
  private tuckFeet(p: Pose) {
    const inv = this.root.matrixWorld.clone().invert();
    const hips = this.j.hips.getWorldPosition(V3()).applyMatrix4(inv);
    for (const sd of ["L", "R"] as const) {
      const anJ = this.j[`an${sd}`];
      const an = anJ.getWorldPosition(V3()).applyMatrix4(inv);
      const toe = anJ.localToWorld(V3(0, -0.035, 0.165)).applyMatrix4(inv);
      const tucked = (p[`kn${sd}`]?.[0] ?? 0) >= 80 && toe.z < hips.z - 0.02 && an.z < hips.z + 0.1 && an.y < hips.y - 0.08;
      this.j[`an${sd}`].visible = !tucked;
      this.ankles[sd]?.forEach((o) => (o.visible = !tucked));
    }
  }

  private posedNeck = new THREE.Quaternion();
  private posedHead = new THREE.Quaternion();
  /**
   * Camera target: the eyes as posed, without the lookAt turn on top. Aiming a camera at point("eyes") makes every
   * glance (lookAt switching targets, on twos) jolt the whole frame; aim() follows the body and the posed head only.
   */
  aim() {
    const qn = this.j.neck.quaternion.clone(), qh = this.j.head.quaternion.clone();
    this.j.neck.quaternion.copy(this.posedNeck);
    this.j.head.quaternion.copy(this.posedHead);
    const p = this.point("eyes");
    this.j.neck.quaternion.copy(qn);
    this.j.head.quaternion.copy(qh);
    this.root.updateMatrixWorld(true);
    return p;
  }

  /** Place the whole figure: ground position (x, z), facing yaw (deg, 0 = +z), optional extra rotation. */
  place(x: number, z: number, yaw = 0, y = 0, rx = 0, rz = 0) {
    this.root.position.set(x, y, z);
    this.root.rotation.set(rx * D, yaw * D, rz * D, "YXZ");
    this.root.updateMatrixWorld(true);
    return this;
  }

  hand(sd: "L" | "R", hp: HandPose | string) {
    const h = typeof hp === "string" ? HANDS[hp] ?? HANDS.relax : hp;
    const m = sd === "L" ? 1 : -1;
    const fs = this.fingers[sd];
    fs.forEach((chain, i) => {
      const c = h.curl[i + 1];
      const spread = (i - 1.5) * h.spread * 9 * D;
      chain.forEach((seg, k) => {
        const ang = c * [62, 88, 58][k] * D;
        seg.quaternion.setFromEuler(new THREE.Euler(k === 0 ? -spread * m * 0 : 0, k === 0 ? 0 : 0, -m * ang, "XYZ"));
        if (k === 0) seg.rotateX(spread);
      });
    });
    const th = this.thumbs[sd];
    const tc = h.curl[0];
    const out = h.thumb ?? 0.35;
    th.forEach((seg, k) => {
      if (k === 0) seg.quaternion.setFromEuler(new THREE.Euler(-0.7 + out * 0.5, 0, -m * (0.25 + tc * 0.55), "XYZ"));
      else seg.quaternion.setFromEuler(new THREE.Euler(-tc * 0.25, 0, -m * tc * 0.85, "XYZ"));
    });
  }

  /** Set the face. If `light` is omitted, the nose shadow side follows the current key light (G.uLightDir). */
  expr(e: Partial<Expr>) {
    this.e = { ...EXPR0, ...e };
    if (e.light === undefined) {
      this.root.updateMatrixWorld(true);
      const q = this.headMesh.getWorldQuaternion(new THREE.Quaternion()).invert();
      const l = G.uLightDir.value.clone().applyQuaternion(q);
      this.e.light = l.x >= 0 ? 1 : -1;
    }
    this.face?.set(this.e);
  }

  /** Turn neck and head toward a world point (amount 0..1), on top of the current pose. */
  lookAt(target: THREE.Vector3, amount = 1, maxYaw = 70) {
    this.root.updateMatrixWorld(true);
    const hp = this.point("head");
    const inv = new THREE.Matrix4().copy(this.j.neck.parent!.matrixWorld).invert();
    const local = target.clone().applyMatrix4(inv).sub(hp.clone().applyMatrix4(inv)).normalize();
    const yaw = clamp(Math.atan2(local.x, local.z) / D, -maxYaw, maxYaw) * amount;
    const pitch = clamp(-Math.asin(clamp(local.y, -1, 1)) / D, -40, 50) * amount;
    this.j.neck.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * 0.35 * D, yaw * 0.4 * D, 0, "YXZ")));
    this.j.head.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * 0.65 * D, yaw * 0.6 * D, 0, "YXZ")));
  }

  /** The figure's own axes in world space: left (+x), up, forward (+z). */
  axes() {
    const q = this.root.getWorldQuaternion(new THREE.Quaternion());
    return { left: V3(1, 0, 0).applyQuaternion(q), up: V3(0, 1, 0).applyQuaternion(q), fwd: V3(0, 0, 1).applyQuaternion(q) };
  }

  /** Natural elbow direction: down, slightly back and out to the arm's own side (relative to the figure). */
  elbowPole(sd: "L" | "R") {
    const { left, up, fwd } = this.axes();
    const m = sd === "L" ? 1 : -1;
    return left.multiplyScalar(0.45 * m).addScaledVector(up, -1).addScaledVector(fwd, -0.35).normalize();
  }

  /**
   * Two-bone IK: put the wrist of `sd` at world `target`; `pole` is the world direction the elbow points toward
   * (default: elbowPole, down-back-out relative to the figure, so elbows never flip forward or across the body).
   */
  reach(sd: "L" | "R", target: THREE.Vector3, pole?: THREE.Vector3, w = 1) {
    if (w <= 0) return;
    this.root.updateMatrixWorld(true);
    pole = pole ?? this.elbowPole(sd);
    const sh = this.j[`sh${sd}`], el = this.j[`el${sd}`];
    const S = sh.getWorldPosition(V3());
    const scale = this.root.getWorldScale(V3()).x;
    const a = this.lens.upper * scale, b = this.lens.fore * scale;
    const Dv = target.clone().sub(S);
    const d = clamp(Dv.length(), Math.abs(a - b) + 1e-3, a + b - 1e-4);
    const dir = Dv.clone().normalize();
    const cosB = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const beta = Math.acos(cosB);
    const pp = pole.clone().addScaledVector(dir, -pole.dot(dir));
    if (pp.lengthSq() < 1e-6) pp.set(0, -1, 0).addScaledVector(dir, -dir.y);
    pp.normalize();
    const upper = dir.clone().multiplyScalar(Math.cos(beta)).addScaledVector(pp, Math.sin(beta)).normalize();
    const E = S.clone().addScaledVector(upper, a);
    const fore = target.clone().sub(E).normalize();
    const yAx = upper.clone().negate();
    let zAx = fore.clone().addScaledVector(upper, -fore.dot(upper));
    if (zAx.lengthSq() < 1e-6) zAx = pp.clone().negate();
    zAx.normalize();
    const xAx = V3().crossVectors(yAx, zAx).normalize();
    const mw = new THREE.Matrix4().makeBasis(xAx, yAx, zAx);
    const qw = new THREE.Quaternion().setFromRotationMatrix(mw);
    const pq = sh.parent!.getWorldQuaternion(new THREE.Quaternion());
    const ql = pq.invert().multiply(qw);
    sh.quaternion.slerp(ql, w);
    const cosE = clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1);
    const bend = Math.PI - Math.acos(cosE);
    el.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-bend, 0, 0)), w);
    this.root.updateMatrixWorld(true);
  }

  /**
   * World orientation of a hand whose palm faces `palm` and whose straight fingers point along `fingers`; with
   * `thumb` (a held tool's axis) the thumb follows it exactly and the palm is adjusted to be perpendicular to it.
   */
  private handQuat(sd: "L" | "R", palm: THREE.Vector3, fingers?: THREE.Vector3, thumb?: THREE.Vector3) {
    const m = sd === "L" ? 1 : -1;
    if (thumb) {
      const t = thumb.clone().normalize();
      const p = palm.clone().addScaledVector(t, -palm.dot(t)).normalize();
      fingers = sd === "L" ? V3().crossVectors(t, p) : V3().crossVectors(p, t);
    }
    const y = fingers!.clone().normalize().negate();
    let p = palm.clone().addScaledVector(y, -palm.dot(y));
    if (p.lengthSq() < 1e-8) p = V3(0, 0, 1).addScaledVector(y, -y.z);
    p.normalize();
    const x = p.multiplyScalar(-m);
    const z = V3().crossVectors(x, y).normalize();
    x.crossVectors(y, z).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  /**
   * Orient a hand (after reach): the palm faces world direction `palm`, the straight fingers point along `fingers`;
   * the thumb follows (left hand: palm × fingers; right hand: fingers × palm). Call after pose and reach.
   */
  aimHand(sd: "L" | "R", palm: THREE.Vector3, fingers?: THREE.Vector3, w = 1, thumb?: THREE.Vector3) {
    if (w <= 0) return;
    this.root.updateMatrixWorld(true);
    const wr = this.j[`wr${sd}`];
    const pq = wr.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
    wr.quaternion.slerp(pq.multiply(this.handQuat(sd, palm, fingers, thumb)), w);
    this.root.updateMatrixWorld(true);
  }

  /**
   * Put a hand at a world point with a given orientation: IK the arm so that the palm centre (ref "palm"), the
   * middle fingertip ("tips"), the wrist ("wrist") or the centre of the current grip ("grip": the object point given
   * as `at` in grip()) lands on `at`, palm facing `palm`, fingers along `fingers`.
   * The way to touch anything: a shoulder (palm down onto it), a table (palm down), eyes (ref "tips", palm toward
   * the face), a tool's knob; and to put a held object exactly somewhere (ref "grip": the hammer head on the nail,
   * the cup rim at the lips). Returns the wrist target used. "tips" assumes straight fingers: pass a hand pose with
   * the touching fingers straight (e.g. curl [0.3, 0, 0.05, 0.8, 0.9]) or the contact point is off.
   */
  placeHand(sd: "L" | "R", at: THREE.Vector3, o: { palm: THREE.Vector3; fingers?: THREE.Vector3; thumb?: THREE.Vector3; ref?: "palm" | "tips" | "wrist" | "grip"; w?: number; pole?: THREE.Vector3 }) {
    const w = o.w ?? 1;
    const m = sd === "L" ? 1 : -1;
    const g = this.grips[sd];
    const local = o.ref === "tips" ? V3(-m * 0.004, -0.172, 0.004) : o.ref === "wrist" ? V3() : o.ref === "grip" && g ? GRIP_CENTER[g.kind](m, g.r) : V3(-m * 0.018, -0.052, 0);
    // hand offsets are in rig units: a child (look.s 0.78) has a smaller hand
    local.multiplyScalar(this.root.getWorldScale(V3()).x);
    const wrist = at.clone().sub(local.applyQuaternion(this.handQuat(sd, o.palm, o.fingers, o.thumb)));
    this.reach(sd, wrist, o.pole, w);
    this.aimHand(sd, o.palm, o.fingers, w, o.thumb);
    return wrist;
  }

  /**
   * Both hands on one object, never crossed: palms `half` metres either side of `center` along the figure's own
   * left-right axis (or `across`), the left hand on the left. Palms face in; fingers point `fingers` (default
   * forward and down). For a basket, a jar, a loaf being broken (animate `half` outward), a board.
   */
  holdBoth(center: THREE.Vector3, o: { half: number; across?: THREE.Vector3; fingers?: THREE.Vector3; w?: number; wL?: number; wR?: number }) {
    const { left, up, fwd } = this.axes();
    const across = (o.across ?? left).clone().normalize();
    const fingers = o.fingers ?? fwd.clone().addScaledVector(up, -0.55).normalize();
    this.placeHand("L", center.clone().addScaledVector(across, o.half), { palm: across.clone().negate(), fingers, w: o.wL ?? o.w });
    this.placeHand("R", center.clone().addScaledVector(across, -o.half), { palm: across.clone(), fingers, w: o.wR ?? o.w });
  }

  /**
   * Attach an object to a hand with a proper grip (see GripKind) and keep the fingers closed round it.
   * After the axis is aligned, the object's +x points out of the palm in the right hand and out of the back of the
   * hand in the left; `roll` turns the object about its axis (a pitcher held by its handle in the right hand needs
   * roll π so its body hangs away from the palm; a hammer -π/2 so the striking face follows the fingers).
   * To hold a body part (a wrist, an arm), grip an invisible stand-in and re-place it from that limb every frame.
   */
  grip(sd: "L" | "R", obj: THREE.Object3D, o: { kind?: GripKind; r?: number; at?: THREE.Vector3; axis?: THREE.Vector3; roll?: number } = {}) {
    const kind = o.kind ?? "wrap";
    const r = o.r ?? 0.015;
    const m = sd === "L" ? 1 : -1;
    // wrap / ball / pinch: the object's axis along the thumb (+z); palm: the object's up out of the palm (-m x)
    const toward = kind === "palm" ? V3(-m, 0, 0) : V3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors((o.axis ?? V3(0, 1, 0)).clone().normalize(), toward);
    if (o.roll) q.premultiply(new THREE.Quaternion().setFromAxisAngle(toward, o.roll));
    obj.quaternion.copy(q);
    obj.position.copy(GRIP_CENTER[kind](m, r)).sub((o.at ?? V3()).clone().applyQuaternion(q));
    this.j[`wr${sd}`].add(obj);
    this.grips[sd] = { obj, hand: gripHand(kind, r), kind, r };
    this.hand(sd, this.grips[sd]!.hand);
    return obj;
  }

  /** Push both forearm sleeves up (k = sleeve length 0..1) so close hands, washing hands and bound wrists show. */
  sleevesUp(k = 0.55) {
    for (const el of [this.j.elL, this.j.elR]) {
      const sleeve = el.children.find((c) => (c as THREE.Mesh).isMesh);
      if (sleeve) sleeve.scale.y = k;
    }
  }

  /** Receive cast shadows or not: in close-ups a figure's own arms otherwise darken its hands and feet. */
  receiveShadows(on: boolean) {
    this.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.uniforms?.uReceive) m.uniforms.uReceive.value = on ? 1 : 0;
    });
  }

  /** Let go: the object goes back to `parent` (default the figure's parent) keeping its world transform. */
  release(sd: "L" | "R", parent?: THREE.Object3D) {
    const g = this.grips[sd];
    if (!g) return;
    const to = parent ?? this.root.parent;
    if (to) to.attach(g.obj);
    delete this.grips[sd];
  }

  /** World positions of landmarks. */
  point(n: "head" | "eyes" | "mouth" | "chest" | "hips" | "handL" | "handR" | "footL" | "footR" | "top" | "eyeL" | "eyeR" | "nose") {
    this.root.updateMatrixWorld(true);
    const fs = this.fs;
    const hm = this.headMesh;
    const hs = this.look.head ?? HEAD_MAN;
    switch (n) {
      case "head": return hm.localToWorld(V3(0, 0, 0));
      case "eyes": return hm.localToWorld(V3(0, fs.eyeY, hs.front * 0.92));
      case "eyeL": return hm.localToWorld(V3(fs.eyeX, fs.eyeY, hs.front * 0.85));
      case "eyeR": return hm.localToWorld(V3(-fs.eyeX, fs.eyeY, hs.front * 0.85));
      case "nose": return hm.localToWorld(V3(0, fs.noseY, hs.front + hs.nose));
      case "mouth": return hm.localToWorld(V3(0, fs.mouthY, hs.front * 0.95));
      case "top": return hm.localToWorld(V3(0, hs.top, 0));
      case "chest": return this.j.chest.localToWorld(V3(0, 0.1, 0.1));
      case "hips": return this.j.hips.getWorldPosition(V3());
      case "handL": return this.j.wrL.localToWorld(V3(0, -0.08, 0));
      case "handR": return this.j.wrR.localToWorld(V3(0, -0.08, 0));
      case "footL": return this.j.anL.getWorldPosition(V3());
      case "footR": return this.j.anR.getWorldPosition(V3());
    }
  }

  /** World sample points of a hand (wrist, palm corners and centre, fingertips, thumb tip) for containment checks. */
  handPoints(sd: "L" | "R") {
    this.root.updateMatrixWorld(true);
    const m = sd === "L" ? 1 : -1;
    const wr = this.j[`wr${sd}`];
    const pts = [V3(0, 0, 0), V3(-m * 0.018, -0.052, 0), V3(0, -0.09, 0.037), V3(0, -0.09, -0.037), V3(0, -0.01, 0.037), V3(0, -0.01, -0.037)].map((p) => wr.localToWorld(p));
    for (const chain of this.fingers[sd]) pts.push(chain[chain.length - 1].localToWorld(V3(0, -0.022, 0)));
    const th = this.thumbs[sd];
    if (th.length) pts.push(th[th.length - 1].localToWorld(V3(0, -0.02, 0)));
    else pts.push(wr.localToWorld(V3(0, -0.15, 0)));
    return pts;
  }

  /** World corners of a foot (the box from heel to toes, sole to instep) for containment checks. */
  footPoints(sd: "L" | "R") {
    this.root.updateMatrixWorld(true);
    const an = this.j[`an${sd}`];
    const pts: THREE.Vector3[] = [];
    for (const x of [-0.045, 0.045]) for (const y of [-0.072, -0.005]) for (const z of [-0.06, 0.17]) pts.push(an.localToWorld(V3(x, y, z)));
    return pts;
  }

  /** Attach an object to a hand (in wrist space: palm centre is about (−side*0.02, −0.07, 0)). */
  holdIn(sd: "L" | "R", o: THREE.Object3D, offset = V3(0, -0.08, 0.0)) {
    o.position.copy(offset);
    this.j[`wr${sd}`].add(o);
    return o;
  }
}

/** Blink amount at a frame: a blink every ~3.3 s lasting 6 frames (call with the stepped frame). */
export function blinkAt(f: number, seed = 0) {
  const period = 97 + (seed % 5) * 9;
  const t = (f + seed * 37) % period;
  const seq = [0, 0.6, 1, 1, 0.6, 0.2];
  return t < seq.length ? seq[Math.floor(t)] : 0;
}

/** A lip-sync track from _tools/lipsync.py: a mouth shape (A-H, X) and a jaw opening (0-100) per frame. */
export type LipTrack = { shapes: string; open: number[] };

/**
 * The mouth at a frame of a lip-sync track, spread into expr() over the face's own expression:
 * `j.expr({ smile: 0.2, blink: blinkAt(fs, 1), ...lips(TALK, fs - vo) })`. `frame` counts from the audio's start
 * (pass the stepped frame, like blinkAt). At rest (X) and outside the track it adds nothing, so the plain mouth shows.
 * `gain` scales the jaw (1.2 to belt a note, 0.8 to mutter).
 */
export function lips(track: LipTrack, frame: number, gain = 1): Partial<Expr> {
  const i = Math.floor(frame);
  const v = i >= 0 ? (track.shapes[i] as Viseme | undefined) : undefined;
  if (!v || v === "X") return {};
  return { mouth: v, open: clamp(((track.open[i] ?? 0) / 100) * gain) };
}

/**
 * Walk cycle pose at phase (cycles), amount 0..1. Robed steps: hips ±16° and knees up to 30°, so under a
 * full-length robe the feet step out just past the hem and the legs never leave the cloth (walkTo's default
 * stride, 0.95 m per cycle, matches this swing so the feet do not slide).
 */
export const WALK_STRIDE = 0.95;
export function walkPose(ph: number, amt = 1, base: Pose = {}): Pose {
  const s = Math.sin(ph * Math.PI * 2), c = Math.cos(ph * Math.PI * 2);
  const k = (x: number) => x * amt;
  const kneeL = Math.max(0, -c) * 24 + 6, kneeR = Math.max(0, c) * 24 + 6;
  return {
    ...base,
    hipL: [k(s * 16), 0, 1],
    hipR: [k(-s * 16), 0, 1],
    knL: [k(kneeL), 0, 0],
    knR: [k(kneeR), 0, 0],
    anL: [k(-s * 9), 0, 0],
    anR: [k(s * 9), 0, 0],
    shL: base.shL ?? [k(-s * 16), 0, 6],
    shR: base.shR ?? [k(s * 16), 0, 6],
    elL: base.elL ?? [k(12 + Math.max(0, -s) * 14), 0, 0],
    elR: base.elR ?? [k(12 + Math.max(0, s) * 14), 0, 0],
    hips: [0, k(s * 4), 0],
    chest: [base.chest?.[0] ?? 3, k(-s * 5), 0],
    root: { p: [0, k(-Math.abs(c) * 0.025), 0] },
  };
}

// ---- turning --------------------------------------------------------------------------------------------

/** Shortest signed angle from facing a to facing b, degrees in (-180, 180]. */
export function angleDelta(a: number, b: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/**
 * A facing between `from` and `to`, the short way round (t 0..1). Use this (or turnOnSpot) for every change of
 * facing: never lerp yaw values yourself. lerp(84, 163 + 360, t) turned a figure 439° in half a second and the settle
 * lerp then spun it back 309°.
 */
export function turnYaw(from: number, to: number, t: number) {
  return from + angleDelta(from, to) * clamp(t);
}

/** Frames a relaxed turn of `deg` takes at 30 fps: 0.6 s for 90°, 1 s for 180°, never under 10 frames. */
export function turnFrames(deg: number) {
  return Math.max(10, Math.round(8 + Math.abs(deg) * 0.12));
}

/**
 * A natural turn on the spot (t 0..1 over the turn, easing built in): the eyes and head lead, the chest follows,
 * the hips and feet come round last in small steps (one step per ~60°, turns over 30°). Returns the root `yaw` for
 * place() and `pose` = `base` with the chest, neck and head turned ahead of the hips plus the stepping legs. Run t
 * over turnFrames(angleDelta(from, to)) frames, from the stepped frame like every pose:
 *   const t = seg(fs, f0, f0 + turnFrames(angleDelta(A, B)));
 *   const tr = turnOnSpot(A, B, t, STAND);
 *   j.place(x, z, tr.yaw, y); j.pose(tr.pose);
 */
export function turnOnSpot(from: number, to: number, t: number, base: Pose = {}): { yaw: number; pose: Pose } {
  const d = angleDelta(from, to);
  const sm = (x: number) => x * x * (3 - 2 * x);
  const k = (a: number, b: number) => sm(clamp((t - a) / (b - a)));
  const head = k(0, 0.55), chest = k(0.08, 0.8), hips = k(0.2, 1);
  const lead = (a: number, b: number) => Math.max(-70, Math.min(70, d * (a - b)));
  const chestY = lead(chest, hips) * 0.85;
  const headY = lead(head, chest);
  const steps = Math.abs(d) > 30 ? Math.max(2, Math.round(Math.abs(d) / 60)) : 0;
  const p: Pose = steps ? walkPose(hips * steps * 0.5, Math.sin(Math.PI * hips) * 0.45, base) : { ...base };
  const add = (n: "chest" | "neck" | "head", y: number) => {
    const a = p[n] ?? [0, 0, 0];
    p[n] = [a[0], a[1] + y, a[2]];
  };
  add("chest", chestY);
  add("neck", headY * 0.4);
  add("head", headY * 0.6);
  return { yaw: from + d * hips, pose: p };
}

// --------------------------------------------------------------------------------------------------------

function group(parent: THREE.Object3D, x: number, y: number, z: number, name: string) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.name = name;
  parent.add(g);
  return g;
}

function torsoSurface(y: number, a: number, off: number, build: number) {
  // chest-local robe surface: y from -0.26 (waist) to 0.255 (neck); a = azimuth (0 = front)
  const t = clamp((y + 0.26) / 0.515);
  const rx = (lerp(0.152, 0.178, sstep(0, 0.6, t)) + 0.01 * sstep(0.55, 0.78, t) - 0.115 * Math.pow(sstep(0.78, 1, t), 1.4)) * build;
  const rz = lerp(0.112, 0.124, sstep(0, 0.5, t)) - 0.05 * sstep(0.8, 1, t);
  return V3(Math.sin(a) * (rx + off), y, Math.cos(a) * (rz + off));
}

function build(look: Look, fs: FaceStyle, detail: "hero" | "mid" | "crowd", ppm: number): Built {
  const bw = look.build ?? 1;
  const hs = look.head ?? HEAD_MAN;
  const lw = look.lineW ?? 2.8;
  const ink = look.ink ?? 0.3;
  const root = new THREE.Group();
  root.name = look.name;
  root.scale.setScalar(look.s ?? 1);
  const hips = group(root, 0, 0.93, 0, "hips");
  const spine = group(hips, 0, 0.1, 0, "spine");
  const chest = group(spine, 0, 0.2, 0, "chest");
  const neck = group(chest, 0, 0.255, -0.005, "neck");
  const head = group(neck, 0, 0.11, 0.012, "head");
  const shL = group(chest, 0.178 * bw, 0.2, -0.012, "shL"), shR = group(chest, -0.178 * bw, 0.2, -0.012, "shR");
  const elL = group(shL, 0, -0.285, 0, "elL"), elR = group(shR, 0, -0.285, 0, "elR");
  const wrL = group(elL, 0, -0.255, 0, "wrL"), wrR = group(elR, 0, -0.255, 0, "wrR");
  const hipL = group(hips, 0.092, -0.035, 0, "hipL"), hipR = group(hips, -0.092, -0.035, 0, "hipR");
  const knL = group(hipL, 0, -0.43, 0, "knL"), knR = group(hipR, 0, -0.43, 0, "knR");
  const anL = group(knL, 0, -0.41, 0, "anL"), anR = group(knR, 0, -0.41, 0, "anR");
  const j: Record<JointName, THREE.Group> = { hips, spine, chest, neck, head, shL, elL, wrL, shR, elR, wrR, hipL, knL, anL, hipR, knR, anR };

  const skinM = toon({ color: look.skin, shade: shadeSkin(look.skin), th: 0.47, rim: 1 });
  const skinH = { color: lineOf(look.skin, 0.36), width: lw, distRef: 3 };
  const robeM = toon({ color: look.robe, shade: look.robeShade, th: 0.5, th2: 0.24, rim: 0.8 });
  const robeH = { color: lineOf(look.robe, ink), width: lw, distRef: 3 };
  const cast = detail !== "crowd";

  // ---- head
  const headScale = look.headScale ?? 1;
  const headWrap = group(head, 0, 0.075, 0.012, "headWrap");
  headWrap.scale.setScalar(headScale);
  let face: Face | null = null;
  if (ppm > 0) {
    face = new Face(fs, ppm);
    face.set(EXPR0);
  }
  const headMat = toon({
    color: look.skin, shade: shadeSkin(look.skin), th: 0.37, rim: 1, sphere: [0, -0.012, -0.015, 0.86],
    decal: face ? { tex: face.tex, rect: fs.rect, shade: 0.9 } : undefined,
  });
  const headMesh = mesh(headGeo(hs, fs, detail === "hero" ? 220 : detail === "mid" ? 120 : 48), headMat, { hull: { ...skinH, width: lw * 1.05 }, cast: false, name: "headMesh" });
  headWrap.add(headMesh);
  // Under a veil or head cloth only a flat fringe shows in the face opening: full hair (locks, curls, ears) would
  // push through the cloth, which sits just 14-26 mm off the scalp.
  const covered = !!(look.veil || look.headcloth);
  if (!covered && (look.hair === "short" || look.hair === "elder" || look.hair === "child" || look.hair === "curly" || look.hair === "none"))
    headWrap.add(mesh(earGeo(hs), skinM, { hull: skinH }));
  if (covered && look.hair !== "none") {
    const hairM = toon({ color: look.hairCol, shade: shadeOf2(look.hairCol), th: 0.48 });
    headWrap.add(mesh(hairGeo("covered", hs, fs, 5), hairM, { hull: { color: lineOf(look.hairCol, 0.45), width: lw * 0.7 } }));
  }
  if (!covered && look.hair !== "none" && look.hair !== "veiled") {
    const hairM = toon({ color: look.hairCol, shade: shadeOf2(look.hairCol), th: 0.48, rim: 0.55, hair: { hi: lighten(look.hairCol, 0.3), band: [0.07, 0.115], amt: 0.7 } });
    headWrap.add(mesh(hairGeo(look.hair, hs, fs, 3, look.hairLen ?? 0.24), hairM, { hull: { color: lineOf(look.hairCol, 0.45), width: lw * 1.05, distRef: 3 }, cast }));
  }
  // stubble has no geometry (an empty mesh would break the outline pass)
  if (look.beard && look.beard !== "none" && look.beard !== "stubble") {
    const bc = look.beardCol ?? look.hairCol;
    const beardM = toon({ color: bc, shade: shadeOf2(bc), th: 0.5, rim: 1, side: THREE.DoubleSide });
    headWrap.add(mesh(beardGeo(look.beard, hs, fs, 2), beardM, { hull: { color: lineOf(bc, 0.45), width: lw, distRef: 3 } }));
  }
  if (look.veil) {
    const vm = toon({ color: look.veil, th: 0.5, th2: 0.22, rim: 1, side: THREE.DoubleSide });
    headWrap.add(mesh(veilGeo(hs, fs, look.veilDrop ?? 0.32), vm, { hull: { color: lineOf(look.veil, ink), width: lw }, cast }));
  }
  if (look.headcloth) {
    const hm = toon({ color: look.headcloth, th: 0.5, th2: 0.22, rim: 1, side: THREE.DoubleSide });
    headWrap.add(mesh(veilGeo(hs, fs, 0.2, 0.9), hm, { hull: { color: lineOf(look.headcloth, ink), width: lw } }));
  }
  // neck
  const neckM = toon({ color: look.skin, shade: shadeSkin(look.skin), th: 0.62, bias: -0.08 });
  neck.add(mesh(neckGeo(0.047 * (hs.child ? 0.85 : 1), 0.17), neckM, { hull: skinH }));

  // ---- torso robe (chest) and skirt (hips)
  const torso = cached(`torso:${bw}`, () => {
    const pts = [V3(0, -0.27, 0), V3(0, 0.255, 0)];
    return sweep(new THREE.LineCurve3(pts[0], pts[1]), {
      rx: (t) => torsoSurface(lerp(-0.27, 0.255, t), Math.PI / 2, 0, bw).x,
      ry: (t) => torsoSurface(lerp(-0.27, 0.255, t), 0, 0, bw).z,
      radial: 36, segs: 22, up: V3(0, 0, 1),
    });
  });
  chest.add(mesh(torso, robeM, { hull: robeH, cast }));
  if (look.tunic) {
    const tm = toon({ color: look.tunic, th: 0.5 });
    const collar = sweep(path([V3(-0.06, 0.235, 0.05), V3(0, 0.205, 0.085), V3(0.06, 0.235, 0.05)]), { rx: () => 0.012, ry: () => 0.006, radial: 6, segs: 10, up: V3(0, 0, 1) });
    chest.add(mesh(collar, tm, { hull: { ...robeH, width: lw * 0.6 } }));
  }
  const stand = (look.robeMode ?? "stand") === "stand";
  const hem = look.hem ?? (hs === HEAD_WOMAN ? 1 : 0.82);
  const rag = look.ragged ? 1.8 : 1;
  if (stand) {
    const skirt = cached(`skirt:${bw}:${rag}:${hem}`, () =>
      sweep(new THREE.LineCurve3(V3(0, 0.13, 0), V3(0, -0.88, 0)), {
        rx: (t) => SKIRT.rx(t, bw, hem), ry: (t) => SKIRT.ry(t, hem), ripple: (t, a) => SKIRT.rip(t, a, rag), radial: 72, segs: 26, up: V3(0, 0, -1),
      }),
    );
    hips.add(mesh(skirt, robeM, { hull: robeH, cast }));
    if (detail === "hero") {
      const inkM = toon({ color: lineOf(look.robe, ink * 1.4), unlit: true, receive: false, fog: 1 });
      // valleys of the 9-fold ripple: sin(9a + 0.6) = -1
      const valleys = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => (Math.PI * 1.5 - 0.6 + Math.PI * 2 * k) / 9);
      const specs = valleys.map((a, i) => [a, 0.28 + (i % 3) * 0.07, 0.97, 0.03 * ((i % 2) * 2 - 1)] as [number, number, number, number]);
      const folds = cached(`skirtFolds:${bw}:${rag}:${hem}`, () => foldLines((t, a, off) => skirtPoint(t, a, off, bw, rag, hem), specs, 0.0028));
      hips.add(mesh(folds, inkM, { hull: false }));
      const tf = cached(`torsoFolds:${bw}`, () =>
        foldLines((t, a, off) => torsoSurface(lerp(-0.25, 0.12, t), a, off, bw), [[1.25, 0.05, 0.8, 0.12], [-1.25, 0.05, 0.8, -0.12], [1.5, 0.1, 0.6, 0.05], [-1.5, 0.1, 0.6, -0.05], [0.25, 0.0, 0.35, 0.05]], 0.0024),
      );
      chest.add(mesh(tf, inkM, { hull: false }));
    }
  } else {
    const short = cached(`skirtS:${bw}`, () =>
      sweep(new THREE.LineCurve3(V3(0, 0.13, 0), V3(0, -0.2, 0)), { rx: (t) => lerp(0.152, 0.2, t) * bw, ry: (t) => lerp(0.114, 0.15, t), radial: 48, segs: 8, up: V3(0, 0, -1) }),
    );
    hips.add(mesh(short, robeM, { hull: robeH, cast }));
    for (const [hp, kn] of [[hipL, knL], [hipR, knR]] as const) {
      hp.add(mesh(cached("thighRobe", () => { const g = capsule(0.088, 0.36, 4, 16); g.translate(0, -0.2, 0); return g; }), robeM, { hull: robeH, cast }));
      kn.add(mesh(cached("shinRobe", () => sweep(new THREE.LineCurve3(V3(0, 0.02, 0), V3(0, -0.36, 0)), { rx: (t) => lerp(0.08, 0.1, t * t), ry: (t) => lerp(0.08, 0.11, t * t), radial: 20, segs: 6, up: V3(0, 0, 1) })), robeM, { hull: robeH, cast }));
    }
  }
  if (look.sash) {
    // The belt rides on the hips over the seam where the torso robe meets the skirt, a little outside the skirt's
    // own surface (it used to sit on the chest within a millimetre of the skirt and flickered in and out of it).
    const sm = toon({ color: look.sash, th: 0.5 });
    const belt = cached(`belt:${bw}:${stand}:${rag}:${hem}`, () => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        if (stand) pts.push(skirtPoint(0.074, a, 0.009, bw, rag, hem).setY(0.055));
        else pts.push(V3(Math.cos(a) * (lerp(0.152, 0.2, 0.227) * bw + 0.009), 0.055, -Math.sin(a) * (lerp(0.114, 0.15, 0.227) + 0.009)));
      }
      return sweep(path(pts, true), { rx: () => 0.026, ry: () => 0.008, radial: 6, segs: 64, upFn: (_t, p) => V3(p.x, 0, p.z) });
    });
    hips.add(mesh(belt, sm, { hull: { color: lineOf(look.sash, ink), width: lw * 0.8 } }));
  }
  // mantle: diagonal drape from the left shoulder to the right hip, plus a fall down the back
  if (look.mantle && (look.mantleKind ?? "drape") !== "none") {
    const mm = toon({ color: look.mantle, th: 0.5, th2: 0.25, rim: 1, side: THREE.DoubleSide });
    const mh = { color: lineOf(look.mantle, ink), width: lw };
    if ((look.mantleKind ?? "drape") === "drape") {
      const loop = cached(`mantle:${bw}`, () => {
        // stands further off the robe toward the waist so it crosses over the belt instead of through it
        const S = (y: number, a: number) => torsoSurface(y, a, 0.016 + 0.032 * sstep(-0.16, -0.3, y), bw);
        const pts = [
          S(-0.33, -1.25), S(-0.2, -2.2), S(0.0, -2.75), S(0.15, 2.55), V3(0.14 * bw, 0.255, -0.07), V3(0.155 * bw, 0.272, 0.0), V3(0.14 * bw, 0.255, 0.075),
          S(0.17, 0.75), S(0.04, 0.35), S(-0.14, -0.3), S(-0.3, -0.9),
        ];
        return sweep(path(pts, true), { rx: () => 0.085, ry: () => 0.007, radial: 8, segs: 90, upFn: (_t, p) => (p.y > 0.23 ? V3(p.x * 1.6, 1, p.z * 0.5) : V3(p.x, 0, p.z)) });
      });
      chest.add(mesh(loop, mm, { hull: mh, cast }));
      const tail = cached(`mantleTail:${bw}`, () =>
        sweep(path([V3(0.15 * bw, 0.27, -0.05), V3(0.13 * bw, 0.14, -0.15), V3(0.09 * bw, -0.35, -0.165), V3(0.07 * bw, -0.85, -0.225), V3(0.06 * bw, -1.25, -0.255)]), {
          rx: (t) => lerp(0.1, 0.17, t), ry: () => 0.009, radial: 8, segs: 40, upFn: (_t, p) => V3(p.x * 0.3, 0, -1),
          ripple: (t, a) => 0.012 * t * Math.sin(a * 3),
        }),
      );
      chest.add(mesh(tail, mm, { hull: mh, cast }));
    } else {
      const shawl = cached(`shawl:${bw}`, () => {
        const pts = [torsoSurface(0.0, 1.2, 0.02, bw), torsoSurface(0.21, 1.4, 0.02, bw), torsoSurface(0.235, 2.6, 0.02, bw), torsoSurface(0.235, -2.6, 0.02, bw), torsoSurface(0.21, -1.4, 0.02, bw), torsoSurface(0.0, -1.2, 0.02, bw)];
        return sweep(path(pts), { rx: () => 0.09, ry: () => 0.009, radial: 8, segs: 50, upFn: (_t, p) => V3(p.x, 0.4, p.z) });
      });
      chest.add(mesh(shawl, mm, { hull: mh, cast }));
    }
  }

  // ---- arms
  const fingers: Built["fingers"] = { L: [], R: [] };
  const thumbs: Built["thumbs"] = { L: [], R: [] };
  for (const [sd, sh, el, wr] of [["L", shL, elL, wrL], ["R", shR, elR, wrR]] as const) {
    const m = sd === "L" ? 1 : -1;
    const wide = (look.sleeves ?? "wide") === "wide";
    // Sleeves narrow from the shoulder to the elbow and flare again toward the wrist (user, round 5: the old 17.6 cm
    // wrist opening showed the inside of the sleeve and cut into bodies and props). Wide: 9.6 cm at the elbow, 12.8 cm
    // at the wrist; narrow (children): 8.8 cm to 10 cm.
    const elbowR = wide ? 0.05 : 0.046;
    sh.add(mesh(cached(`sleeveU2:${wide}`, () => sweep(new THREE.LineCurve3(V3(0, 0.02, 0), V3(0, -0.3, 0)), { rx: (t) => lerp(wide ? 0.064 : 0.06, elbowR, t), radial: 18, segs: 6, up: V3(0, 0, 1) })), robeM, { hull: robeH, cast }));
    sh.add(mesh(cached("shoulderBall", () => new THREE.SphereGeometry(0.068, 18, 12)), robeM, { hull: false }));
    el.add(mesh(cached(`sleeveF2:${wide}`, () => sweep(new THREE.LineCurve3(V3(0, 0.02, 0), V3(0, wide ? -0.215 : -0.2, 0)), { rx: (t) => lerp(elbowR - 0.002, wide ? 0.064 : 0.05, Math.pow(t, 1.8)), radial: 20, segs: 8, up: V3(0, 0, 1) })), toon({ color: look.robe, shade: look.robeShade, th: 0.5, th2: 0.24, side: THREE.DoubleSide }), { hull: robeH, cast }));
    el.add(mesh(cached(`elbowBall:${wide}`, () => new THREE.SphereGeometry(elbowR - 0.002, 16, 10)), robeM, { hull: false }));
    el.add(mesh(cached("forearm", () => { const g = capsule(0.032, 0.16, 4, 12); g.translate(0, -0.14, 0); return g; }), skinM, { hull: skinH }));
    // hand
    const handRoot = group(wr, 0, 0, 0, `hand${sd}`);
    if ((look.hands ?? (detail === "crowd" ? "mitten" : "full")) === "mitten" || detail === "crowd") {
      handRoot.add(mesh(cached("mitten", () => { const g = rbox(0.032, 0.15, 0.075, 0.016); g.translate(0, -0.075, 0); return g; }), skinM, { hull: skinH }));
      fingers[sd] = [];
      thumbs[sd] = [];
    } else {
      handRoot.add(mesh(cached("palm", () => { const g = rbox(0.03, 0.088, 0.078, 0.013, 2); g.translate(0, -0.046, 0.0); return g; }), skinM, { hull: skinH }));
      const zs = [0.027, 0.0095, -0.0085, -0.0255];
      const ks = [0.96, 1.0, 0.95, 0.78];
      const segs = [0.043, 0.027, 0.021];
      fingers[sd] = zs.map((z, i) => {
        const chain: THREE.Group[] = [];
        let parent: THREE.Object3D = handRoot;
        let y = -0.088;
        segs.forEach((L0, k) => {
          const L = L0 * ks[i];
          const g = group(parent, 0, y, k === 0 ? z : 0, `f${i}${k}`);
          const r = (i === 3 ? 0.0078 : 0.0089) * (1 - k * 0.08);
          g.add(mesh(cached(`fseg:${L.toFixed(4)}:${r.toFixed(4)}`, () => { const c = capsule(r, Math.max(0.001, L - r), 3, 10); c.translate(0, -L / 2, 0); return c; }), skinM, { hull: { ...skinH, width: lw * 0.8 } }));
          chain.push(g);
          parent = g;
          y = -L;
        });
        return chain;
      });
      let tp: THREE.Object3D = handRoot;
      const tl = [0.032, 0.027, 0.022];
      thumbs[sd] = tl.map((L, k) => {
        const g = group(tp, k === 0 ? -m * 0.004 : 0, k === 0 ? -0.018 : -tl[k - 1], k === 0 ? 0.032 : 0, `th${k}`);
        const r = 0.0105 - k * 0.0008;
        g.add(mesh(cached(`tseg:${L}:${r}`, () => { const c = capsule(r, L - r, 3, 10); c.translate(0, -L / 2, 0); return c; }), skinM, { hull: { ...skinH, width: lw * 0.8 } }));
        tp = g;
        return g;
      });
    }
  }

  // ---- legs and feet. Under a full-length ("stand") robe only the feet exist: bare shins swinging out past the
  // cloth read as detached legs. "legs" looks (kneeling, sitting) keep shins inside their robe tubes.
  const ankles: Built["ankles"] = { L: [], R: [] };
  for (const [hp, kn, an, sd] of [[hipL, knL, anL, "L"], [hipR, knR, anR, "R"]] as const) {
    if (!stand) {
      const s = mesh(cached("shin", () => { const g = capsule(0.042, 0.33, 4, 12); g.translate(0, -0.2, 0); return g; }), skinM, { hull: skinH });
      kn.add(s);
      ankles[sd].push(s);
    }
    // just the ankle, so a foot stepping out past the hem stays joined to the leg under the cloth
    else {
      const a = mesh(cached("ankle", () => { const g = capsule(0.038, 0.1, 4, 12); g.translate(0, -0.345, 0); return g; }), skinM, { hull: skinH });
      kn.add(a);
      ankles[sd].push(a);
    }
    void hp;
    an.add(mesh(cached("foot", () => { const g = rbox(0.085, 0.06, 0.22, 0.03); g.translate(0, -0.035, 0.055); return g; }), skinM, { hull: skinH, cast }));
    const sandal = toon({ color: look.sandal ?? "#6b4429", th: 0.5 });
    an.add(mesh(cached("sole", () => { const g = rbox(0.095, 0.016, 0.24, 0.007); g.translate(0, -0.064, 0.055); return g; }), sandal, { hull: { color: "#2a170e", width: lw * 0.7 } }));
    an.add(mesh(cached("straps", sandalStraps), sandal, { hull: { color: "#2a170e", width: lw * 0.5 } }));
  }

  return { root, j, head: headWrap, headMesh, face, fingers, thumbs, mats: { skin: [skinM, headMat, neckM], robe: [robeM] }, ankles };
}

/**
 * A flat leather strap laid along a path on a surface: `pts` on the skin, `nrm` pointing out of it. Width runs
 * across the path in the surface (tangent x normal), thickness outward.
 */
function strap(pts: THREE.Vector3[], nrm: THREE.Vector3[], w: number, thick: number, closed = false) {
  const n = pts.length;
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tan = next.clone().sub(prev).normalize();
    const ax = new THREE.Vector3().crossVectors(tan, nrm[i]).normalize().multiplyScalar(w / 2);
    const out = nrm[i].clone().multiplyScalar(thick);
    for (const v of [pts[i].clone().add(ax), pts[i].clone().sub(ax), pts[i].clone().sub(ax).add(out), pts[i].clone().add(ax).add(out)]) pos.push(v.x, v.y, v.z);
  }
  const idx: number[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * 4, b = ((i + 1) % n) * 4;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      idx.push(a + k, b + k, b + k1, a + k, b + k1, a + k1);
    }
  }
  if (!closed) idx.push(0, 1, 2, 0, 2, 3, (n - 1) * 4, (n - 1) * 4 + 2, (n - 1) * 4 + 1, (n - 1) * 4, (n - 1) * 4 + 3, (n - 1) * 4 + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // face the outer surface outward whatever the path direction
  const nr = g.getAttribute("normal");
  const o = V3(nr.getX(3), nr.getY(3), nr.getZ(3));
  if (o.dot(nrm[0]) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/**
 * Sandal straps in the ankle joint's space, laid on the foot (a rounded box 0.085 x 0.06 x 0.22 whose cross-section is
 * a stadium: end circles r 0.03 at x ±0.0125, y -0.035): two bands from the sole over the forefoot and the instep, an
 * ankle strap just above the foot, and a side strap each side from the sole up to it. The old single tilted ring hung
 * above the foot and read as a bar floating over it.
 */
function sandalStraps() {
  const D2 = Math.PI / 180;
  const cy = -0.035, cx = 0.0125, r = 0.0315, sole = -0.058;
  const cross = (z0: number, slant: number, w: number) => {
    const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = [];
    const add = (x: number, y: number, nx: number, ny: number) => { pts.push(V3(x, y, z0 + slant * x)); nrm.push(V3(nx, ny, 0)); };
    const a0 = Math.asin((sole - cy) / r) / D2;
    for (let a = a0; a < 90; a += 10) add(cx + r * Math.cos(a * D2), cy + r * Math.sin(a * D2), Math.cos(a * D2), Math.sin(a * D2));
    add(cx, cy + r, 0, 1);
    add(0, cy + r, 0, 1);
    add(-cx, cy + r, 0, 1);
    for (let a = 100; a <= 180 - a0; a += 10) add(-cx + r * Math.cos(a * D2), cy + r * Math.sin(a * D2), Math.cos(a * D2), Math.sin(a * D2));
    add(-cx + r * Math.cos((180 - a0) * D2), sole, Math.cos((180 - a0) * D2), Math.sin((180 - a0) * D2));
    return strap(pts, nrm, w, 0.0028);
  };
  // ankle strap: just above the top of the foot, round the ankle (r 0.038 bare, 0.042 under a legs robe)
  const ay = 0.008, ar = 0.0425, az = 0.002;
  const ring: THREE.Vector3[] = [], rn: THREE.Vector3[] = [];
  for (let a = 0; a < 360; a += 15) {
    const s = Math.sin(a * D2), c = Math.cos(a * D2);
    ring.push(V3(ar * s, ay, az + ar * c));
    rn.push(V3(s, 0, c));
  }
  const side = (m: number) => {
    const from = V3(m * (cx + r), sole + 0.004, 0.035), to = V3(m * ar * 0.97, ay, az - 0.01);
    const pts = [0, 0.33, 0.66, 1].map((t) => from.clone().lerp(to, t));
    return strap(pts, pts.map(() => V3(m, 0, 0)), 0.009, 0.0026);
  };
  return merge([cross(0.118, -0.25, 0.013), cross(0.052, 0.2, 0.012), strap(ring, rn, 0.01, 0.0026, true), side(1), side(-1)]);
}

function shadeSkin(skin: string) {
  const c = new THREE.Color(skin);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return new THREE.Color().setHSL((hsl.h + 0.975) % 1, hsl.s * 0.62, hsl.l * 0.76).getStyle();
}
function shadeOf2(c: string) {
  const x = new THREE.Color(c);
  const hsl = { h: 0, s: 0, l: 0 };
  x.getHSL(hsl);
  return new THREE.Color().setHSL((hsl.h + 0.975) % 1, Math.min(1, hsl.s * 0.9), hsl.l * 0.66).getStyle();
}

/** Inner ink lines on cloth (the Motomura / Arc System Works approach): tapered strokes laid on the surface. */
function foldLines(surf: (t: number, a: number, off: number) => THREE.Vector3, specs: [number, number, number, number][], w: number) {
  const gs = specs.map(([a, t0, t1, bend]) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = lerp(t0, t1, i / 8);
      pts.push(surf(t, a + bend * Math.sin((i / 8) * Math.PI), 0.0022));
    }
    return sweep(path(pts), { rx: (t) => w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7) + 0.0002, ry: () => 0.0006, radial: 4, segs: 16, upFn: (_t, p) => V3(p.x, 0, p.z) });
  });
  return gs.length > 1 ? mergeAll(gs) : gs[0];
}
const mergeAll = (gs: THREE.BufferGeometry[]) => merge(gs);

const SKIRT = {
  rx: (t: number, bw: number, hem = 1) => (lerp(0.152, 0.152 + 0.118 * hem, Math.pow(t, 1.15)) + 0.02 * sstep(0.0, 0.25, t) * (1 - t)) * bw,
  ry: (t: number, hem = 1) => lerp(0.114, 0.114 + 0.096 * hem, Math.pow(t, 1.2)),
  rip: (t: number, a: number, rag: number) => (0.011 * Math.pow(t, 1.3) * Math.sin(a * 9 + 0.6) + 0.006 * t * Math.sin(a * 5 + 1.3)) * rag,
};
const skirtPoint = (t: number, a: number, off: number, bw: number, rag: number, hem = 1) => {
  const rip = SKIRT.rip(t, a, rag);
  return V3(Math.cos(a) * (SKIRT.rx(t, bw, hem) + rip + off), lerp(0.13, -0.88, t), -Math.sin(a) * (SKIRT.ry(t, hem) + rip * 0.3 + off));
};
function lighten(c: string, k: number) {
  return new THREE.Color(c).lerp(new THREE.Color("#fff4e0"), k).getStyle();
}

// ---- looks ----------------------------------------------------------------------------------------------

const SKIN_WARM = "#e2b08d";
export const LOOKS: Record<string, Look> = {
  JESUS: {
    name: "Jesus", skin: SKIN_WARM, hair: "long", hairCol: "#4a2d1b", hairLen: 0.25, beard: "full", beardCol: "#5a3a25",
    robe: "#ece3d0", robeShade: "#a397ad", mantle: "#8f2b2b", mantleKind: "drape", tunic: "#d9ccb2", sash: "#b48a52",
    face: { irisTop: "#2a160c", irisBot: "#8a5a2c", brow: "#33200f", tilt: -0.16, eyeW: 0.0318, eyeH: 0.0158, iris: 1.06, browT: 0.0042, browY: 0.0168 },
  },
  MARY: {
    name: "Mary", s: 0.94, head: HEAD_WOMAN, skin: "#e0aa84", hair: "veiled", hairCol: "#2c1b12", beard: "none",
    robe: "#d9c7a6", robeShade: "#a9a0b8", veil: "#3d5e9c", veilDrop: 0.42, mantleKind: "none",
    face: { lashes: true, lash: 0.0024, eyeH: 0.0158, eyeW: 0.0305, tilt: 0.02, browT: 0.0024, irisTop: "#24140c", irisBot: "#6e4426", mouthW: 0.0145, blush: 0.3, age: 0.1 },
  },
};
