/** Wireframe solids projected to the screen (film [0-2]'s Kepler nest): SOLIDS outermost first, project() per vertex. */
export type P3 = [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;

const norm = (pts: P3[]): P3[] => {
  const r = Math.max(...pts.map((p) => Math.hypot(...p)));
  return pts.map((p) => [p[0] / r, p[1] / r, p[2] / r]);
};

/** Edges = vertex pairs at the minimum non-zero distance (true for all Platonic solids). */
const edgesOf = (v: P3[]) => {
  let min = Infinity;
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) min = Math.min(min, Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]));
  const e: [number, number][] = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) < min * 1.01) e.push([i, j]);
  return e;
};

const solid = (pts: P3[]) => {
  const v = norm(pts);
  return { v, e: edgesOf(v) };
};

const signs = [-1, 1];
const cube: P3[] = signs.flatMap((x) => signs.flatMap((y) => signs.map((z) => [x, y, z] as P3)));
const tetra: P3[] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
const octa: P3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const icosa: P3[] = signs.flatMap((a) => signs.flatMap((b) => [[0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]] as P3[]));
const dodeca: P3[] = [...cube, ...signs.flatMap((a) => signs.flatMap((b) => [[0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]] as P3[]))];

/** Kepler-style nesting, outermost first: icosahedron, dodecahedron, cube, octahedron, tetrahedron. */
export const SOLIDS = [solid(icosa), solid(dodeca), solid(cube), solid(octa), solid(tetra)];
export const CUBE = solid(cube);

/** Rotate by yaw (about y) then pitch (about x); returns screen x, y and depth z. */
export const project = ([x, y, z]: P3, yaw: number, pitch: number, scale: number, cx: number, cy: number, persp = 3.2) => {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  const k = persp / (persp - z2);
  return { x: cx + x1 * scale * k, y: cy + y2 * scale * k, z: z2 };
};
