/**
 * Cast for the Gospel films: named looks, seeded crowd looks, and an instanced crowd for thousands of people.
 * Palette rule: Jesus alone wears cream + deep red; Mary blue; everyone else earthy (ochre, olive, umber,
 * slate, madder) so the eye finds him in any wide shot.
 */
import * as THREE from "three";
import { HEAD_CHILD, HEAD_MAN, HEAD_WOMAN, cached } from "./head";
import { Human, LOOKS, Look } from "./human";
import { V3, capsule, cyl, lathe, lerp, merge, rng } from "./geo";
import { inkOf, instanced, toon } from "./toon";

const J = LOOKS.JESUS;
const M = LOOKS.MARY;

export const CAST: Record<string, Look> = {
  JESUS: J,
  JESUS_WORK: { ...J, name: "JesusWork", mantleKind: "none", sleeves: "narrow", robe: "#e3d5bb", sash: "#8a6a44", tunic: undefined },
  JESUS_PLAIN: { ...J, name: "JesusPlain", mantleKind: "none", robe: "#efe8da" },
  JESUS_SERVE: { ...J, name: "JesusServe", mantleKind: "none", sleeves: "narrow", sash: "#f4efe6" },
  JESUS_KNEEL: { ...J, name: "JesusKneel", robeMode: "legs" },
  // The boy: cream tunic and belt, no red mantle (that is the grown man's), a straight hem so it never reads as a dress.
  JESUS_BOY: {
    ...J, name: "JesusBoy", s: 0.78, head: HEAD_CHILD, headScale: 1.08, hair: "child", hairCol: "#3f2617", beard: "none", mantleKind: "none",
    sash: "#9a7a4e", sleeves: "narrow", hem: 0.72,
    robe: "#e6dcc6", face: { ...J.face, eyeH: 0.017, eyeW: 0.032, iris: 1.12, tilt: -0.05, age: 0, blush: 0.25, browT: 0.0028, mouthW: 0.013 },
  },
  MARY: M,
  MARY_OLDER: { ...M, name: "MaryOlder", veil: "#344f86", robe: "#cdbb9c", face: { ...M.face, age: 0.45, blush: 0.12 } },
  JOSEPH: {
    name: "Joseph", skin: "#d6a07a", hair: "short", hairCol: "#3b2a1f", beard: "full", beardCol: "#4d3a2c", robe: "#a98a62", robeShade: "#6f6278",
    mantle: "#6f7d55", mantleKind: "shawl", sash: "#5a4330", face: { age: 0.35, brow: "#2e2018", tilt: -0.1 },
  },
  JOHN_B: {
    name: "JohnBaptist", skin: "#c98f68", hair: "wild", hairCol: "#2a1a12", hairLen: 0.28, beard: "wild", beardCol: "#2f1d14", robe: "#8a6a45", robeShade: "#5b4f63",
    sleeves: "narrow", sash: "#4a321f", mantleKind: "none", ragged: true, face: { brow: "#22140c", browT: 0.0046, tilt: 0.05, age: 0.25 },
  },
  PETER: {
    name: "Peter", skin: "#d39c76", hair: "curly", hairCol: "#55504d", beard: "full", beardCol: "#6b6560", robe: "#6f7f93", robeShade: "#4d5070",
    mantle: "#b58a3e", mantleKind: "shawl", face: { age: 0.55, brow: "#3b3633", tilt: 0.0, mouthW: 0.018 }, build: 1.08,
  },
  JOHN_A: { name: "JohnApostle", skin: "#dfac88", hair: "short", hairCol: "#3a2618", beard: "none", robe: "#7d9a6e", robeShade: "#57667c", mantle: "#c9b07a", mantleKind: "shawl", face: { age: 0, tilt: -0.05 } },
  LEPER: {
    name: "Leper", skin: "#b9aea4", hair: "short", hairCol: "#4a4440", beard: "short", beardCol: "#5a534e", robe: "#8c857c", robeShade: "#5d5a68", headcloth: "#7a736a",
    ragged: true, mantleKind: "none", sash: "#5e574f", face: { age: 0.5, tilt: -0.05 }, robeMode: "legs",
  },
  PARALYTIC: { name: "Paralytic", skin: "#cf9a76", hair: "short", hairCol: "#2e2119", beard: "short", robe: "#cbbd9f", robeShade: "#8b8798", mantleKind: "none", sash: "#7c6a52", face: { age: 0.2 } },
  BARTIMAEUS: {
    name: "Bartimaeus", skin: "#c99572", hair: "elder", hairCol: "#8d8781", beard: "full", beardCol: "#9a948e", robe: "#7a6450", robeShade: "#534a5c", mantle: "#5a4c3e", mantleKind: "shawl",
    ragged: true, robeMode: "legs", face: { age: 0.8, tilt: -0.1 },
  },
  BOY: { name: "Boy", s: 0.66, head: HEAD_CHILD, headScale: 1.1, skin: "#d9a27c", hair: "child", hairCol: "#2b1b12", robe: "#c2a36b", robeShade: "#7e7488", mantleKind: "none", sash: "#7a5a3a", face: { eyeH: 0.0175, eyeW: 0.032, iris: 1.14, age: 0, blush: 0.35, tilt: 0.02 } },
  WOMAN: {
    name: "Woman", s: 0.93, head: HEAD_WOMAN, skin: "#d9a582", hair: "veiled", hairCol: "#20140e", robe: "#8e4b3c", robeShade: "#5e4058", veil: "#b7956c", veilDrop: 0.36, mantleKind: "none",
    robeMode: "legs", face: { lashes: true, lash: 0.0024, eyeH: 0.0158, tilt: 0.02, browT: 0.0024, mouthW: 0.0145, blush: 0.25 },
  },
  PHARISEE: {
    name: "Pharisee", skin: "#d4a07c", hair: "short", hairCol: "#2b2420", beard: "long", beardCol: "#3a332e", robe: "#e0d6bf", robeShade: "#9d97ac", mantle: "#3f5e8c", mantleKind: "drape",
    headcloth: "#efe6d3", face: { age: 0.6, tilt: 0.15, brow: "#2a221d" },
  },
  RICH: {
    name: "Rich", skin: "#e0b08c", hair: "short", hairCol: "#1f1712", beard: "short", robe: "#6d3a72", robeShade: "#3e2f5c", mantle: "#c9a24a", mantleKind: "drape", sash: "#d8b65a",
    face: { age: 0.15, tilt: 0.12 },
  },
  BRIDE: { ...M, name: "Bride", veil: "#f1e7d2", robe: "#c96f5a", robeShade: "#7a4f6a", face: { ...M.face, blush: 0.4 } },
  GROOM: { name: "Groom", skin: "#dba67f", hair: "short", hairCol: "#24170f", beard: "short", robe: "#3f6f6a", robeShade: "#34495e", mantle: "#d9b45f", mantleKind: "shawl", face: { age: 0.05 } },
  STEWARD: { name: "Steward", skin: "#d39d78", hair: "elder", hairCol: "#9c968f", beard: "full", beardCol: "#a7a19a", robe: "#9b5c3a", robeShade: "#5f4558", mantle: "#d2b778", mantleKind: "shawl", face: { age: 0.7 } },
};

const ROBES = ["#a98a62", "#8a6a45", "#6f7d55", "#7a5b46", "#9b6a4a", "#5f6b78", "#b49a6a", "#8c4f3f", "#6b5b4b", "#a07850", "#7d7258", "#5d6650"];
const MANTLES = ["#6f7d55", "#5a4c3e", "#b58a3e", "#7a4a3a", "#4f5f73", "#8a7a5a", "#9d8a6a", "#5b6b5b"];
const VEILS = ["#b7956c", "#8f6f5f", "#d4c3a2", "#7e8a74", "#a77b5c", "#c9b48b", "#6e7d8a"];
const SKINS = ["#d9a27c", "#c98f68", "#e0ae8a", "#cf9874", "#b98260", "#dcab84"];
const HAIRS = ["#2a1a12", "#3b2a1f", "#1f1712", "#4a3626", "#6b625a", "#8d8781"];

/** A seeded villager: kind "man" | "woman" | "child" | "elder". */
export function crowdLook(i: number, kind: "man" | "woman" | "child" | "elder" = "man"): Look {
  const R = rng(i * 7919 + 13);
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const skin = pick(SKINS);
  if (kind === "woman")
    return { name: `woman${i}`, s: 0.92 + R() * 0.04, head: HEAD_WOMAN, skin, hair: "veiled", hairCol: pick(HAIRS.slice(0, 4)), robe: pick(ROBES), veil: pick(VEILS), mantleKind: "none", face: { lashes: true, lash: 0.0023, tilt: 0.02, blush: 0.2, mouthW: 0.0145 } };
  if (kind === "child")
    return { name: `child${i}`, s: 0.6 + R() * 0.12, head: HEAD_CHILD, headScale: 1.1, skin, hair: "child", sleeves: "narrow", hairCol: pick(HAIRS.slice(0, 4)), robe: pick(ROBES), mantleKind: "none", sash: pick(MANTLES), face: { eyeH: 0.0175, iris: 1.14, age: 0, blush: 0.3 } };
  const elder = kind === "elder";
  const hc = elder ? pick(HAIRS.slice(4)) : pick(HAIRS.slice(0, 4));
  return {
    name: `man${i}`, s: 0.97 + R() * 0.06, build: 0.95 + R() * 0.12, head: HEAD_MAN, skin, hair: R() < 0.35 ? "short" : R() < 0.5 ? "curly" : "short", hairCol: hc,
    beard: R() < 0.8 ? (R() < 0.5 ? "full" : "short") : "none", beardCol: hc, robe: pick(ROBES), mantle: pick(MANTLES), mantleKind: R() < 0.5 ? "shawl" : "none",
    headcloth: R() < 0.45 ? pick(VEILS) : undefined, sash: pick(MANTLES), face: { age: elder ? 0.7 : 0.1 + R() * 0.3, tilt: (R() - 0.5) * 0.25 },
  };
}

/** Mid-detail villagers for groups of 2-30 near the camera. */
export function villagers(n: number, seed = 1, mix: ("man" | "woman" | "child" | "elder")[] = ["man", "woman", "man", "child", "woman", "elder"]) {
  return Array.from({ length: n }, (_, i) => new Human(crowdLook(seed * 100 + i, mix[i % mix.length]), { detail: n > 8 ? "crowd" : "mid" }));
}

/** x, y, z, yaw (radians) */
export type CrowdSpot = [number, number, number, number];
/**
 * Split one shot's crowd spots into real people and the instanced background. A spot becomes a real Human when it is
 * within `far` m (default 15) of any of the shot's camera views and inside that view's cone (`cone` deg half-angle,
 * default 70), nearest first, up to `max` (default 60). `views` are [camera position, look target] pairs: pass the
 * first and last frame of a moving camera, built with frameCam(fr, k.ctx.aspect) so 9:16 gets its own split.
 * Instanced figures closer than that read as NPC egg heads.
 */
export function splitCrowd(spots: CrowdSpot[], views: [THREE.Vector3, THREE.Vector3][], o: { far?: number; max?: number; cone?: number } = {}) {
  const far = o.far ?? 15, max = o.max ?? 60, cos = Math.cos(((o.cone ?? 70) * Math.PI) / 180);
  const dirs = views.map(([p, t]) => t.clone().sub(p).setY(0).normalize());
  const scored = spots.map((s, i) => {
    let d = Infinity;
    views.forEach(([p], v) => {
      const dx = s[0] - p.x, dz = s[2] - p.z, h = Math.hypot(dx, dz);
      if (h < 0.4 || (dx * dirs[v].x + dz * dirs[v].z) / h > cos) d = Math.min(d, Math.hypot(h, s[1] - p.y));
    });
    return { i, d };
  });
  const pick = scored.filter((s) => s.d < far).sort((a, b) => a.d - b.d).slice(0, max);
  const isNear = new Set(pick.map((s) => s.i));
  return {
    near: pick.map(({ i, d }) => ({ spot: spots[i], d, i })),
    far: spots.filter((_, i) => !isNear.has(i)),
  };
}
/** Human options by camera distance: mid detail (full face) within 6 m, crowd detail with a small face beyond. */
export const crowdDetail = (d: number) => (d < 6 ? { detail: "mid" as const } : { detail: "crowd" as const, facePPM: 1600 });

/**
 * Instanced crowd for the far background (beyond ~15 m; nearer people are real Humans, see splitCrowd): a robed body
 * with shoulders, arms and neck, a head, and a head cloth or hair cap; seated or standing. Returns the group plus
 * the placed positions. Lines come from hulls at a thin width.
 */
export function crowdField(o: { n: number; place: (i: number, R: () => number) => [number, number, number, number] | null; seated?: boolean; seed?: number; scale?: number }) {
  const R = rng(o.seed ?? 5);
  const seated = o.seated ?? true;
  // Simplified people rather than egg heads on cones: a robed body with shoulders and arms, and a neck the head sits
  // on (the head used to float 2-5 cm above the body). Still only for the far background (beyond ~15 m): nearer
  // people are real Humans.
  const limb = (from: THREE.Vector3, to: THREE.Vector3, r: number) => {
    const g = capsule(r, Math.max(0.01, from.distanceTo(to) - 2 * r), 3, 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), to.clone().sub(from).normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    return g;
  };
  const body = cached(`crowdBody2:${seated}`, () => {
    if (seated) {
      const torso = lathe([[0.001, 0], [0.23, 0.02], [0.24, 0.1], [0.19, 0.22], [0.165, 0.34], [0.17, 0.47], [0.18, 0.55], [0.15, 0.6], [0.09, 0.635], [0.045, 0.65]], 12);
      const lap = new THREE.SphereGeometry(0.26, 12, 6);
      lap.scale(1, 0.33, 1.15);
      lap.translate(0, 0.07, 0.14);
      const neck = cyl(0.042, 0.046, 0.14, 8);
      neck.translate(0, 0.68, 0);
      return merge([torso, lap, neck, limb(V3(0.18, 0.54, 0), V3(0.13, 0.22, 0.2), 0.045), limb(V3(-0.18, 0.54, 0), V3(-0.13, 0.22, 0.2), 0.045)]);
    }
    const robe = lathe([[0.001, 0], [0.25, 0.01], [0.235, 0.35], [0.2, 0.75], [0.18, 0.98], [0.19, 1.22], [0.2, 1.3], [0.17, 1.37], [0.1, 1.41], [0.045, 1.43]], 12);
    const neck = cyl(0.042, 0.046, 0.15, 8);
    neck.translate(0, 1.47, 0);
    return merge([robe, neck, limb(V3(0.2, 1.3, 0), V3(0.215, 0.88, 0.04), 0.048), limb(V3(-0.2, 1.3, 0), V3(-0.215, 0.88, 0.04), 0.048)]);
  });
  const head = cached("crowdHead2", () => capsule(0.085, 0.04, 3, 10));
  const cloth = cached("crowdCloth", () => {
    const g = new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
    g.scale(1, 1.15, 1.05);
    return g;
  });
  const n = o.n;
  const bodyM = toon({ color: "#ffffff", shade: "#b4abc8", th: 0.48, rim: 0.6 });
  const skinM = toon({ color: "#ffffff", shade: "#c3a0a8", th: 0.45 });
  const clothM = toon({ color: "#ffffff", shade: "#b4abc8", th: 0.48 });
  const hull = { color: "#2a1e22", width: 1.3, distRef: 20, minK: 0.4 };
  const ib = instanced(body, bodyM, n, { hull });
  const ih = instanced(head, skinM, n, { hull });
  const ic = instanced(cloth, clothM, n, { hull });
  const d = new THREE.Object3D();
  const pts: THREE.Vector3[] = [];
  let k = 0;
  const hy = seated ? 0.79 : 1.58;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const p = o.place(i, R);
    if (!p) continue;
    const [x, y, z, yaw] = p;
    const s = (o.scale ?? 1) * (0.85 + R() * 0.25);
    d.position.set(x, y, z);
    d.rotation.set(0, yaw, 0);
    d.scale.setScalar(s);
    d.updateMatrix();
    ib.setMatrixAt(k, d.matrix);
    d.position.set(x, y + hy * s, z);
    d.updateMatrix();
    ih.setMatrixAt(k, d.matrix);
    d.position.set(x, y + (hy + 0.03) * s, z - 0.01 * s);
    d.updateMatrix();
    ic.setMatrixAt(k, d.matrix);
    const robe = new THREE.Color(ROBES[Math.floor(R() * ROBES.length)]);
    ib.setColorAt(k, robe);
    ih.setColorAt(k, new THREE.Color(SKINS[Math.floor(R() * SKINS.length)]));
    ic.setColorAt(k, new THREE.Color(R() < 0.5 ? VEILS[Math.floor(R() * VEILS.length)] : HAIRS[Math.floor(R() * 4)]));
    pts.push(V3(x, y, z));
    k++;
  }
  for (const im of [ib, ih, ic]) {
    im.count = k;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    const h = im.children[0] as THREE.InstancedMesh | undefined;
    if (h) h.count = k;
  }
  const g = new THREE.Group();
  g.add(ib, ih, ic);
  void lerp;
  void inkOf;
  void HEAD_MAN;
  return { group: g, pts };
}
