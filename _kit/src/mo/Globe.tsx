import React from "react";
import { DrawPath, Svg } from "./Svg";
import { Glow } from "./Atmosphere";

export type Vec3 = [number, number, number];

const N = 1400;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const landNoise = ([x, y, z]: Vec3) =>
  Math.sin(2.1 * x + 0.3) * Math.sin(2.7 * y + 1.1) * Math.cos(2.3 * z + 0.7) + 0.5 * Math.sin(4.3 * x + 2 * y + 1.7) * Math.sin(3.9 * z - 1.2 * y + 0.4) + 0.25 * Math.sin(7.1 * y + 3.3 * z + 2.2);

/** Fibonacci-sphere dots; `land` marks the pseudo-continents. */
const POINTS = Array.from({ length: N }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / N;
  const r = Math.sqrt(1 - y * y);
  const phi = i * GOLDEN;
  const p: Vec3 = [Math.cos(phi) * r, y, Math.sin(phi) * r];
  return { p, land: landNoise(p) > 0.12 };
});

const TILT = 0.38;
const LIGHT: Vec3 = (() => {
  const l: Vec3 = [-0.45, 0.55, 0.7];
  const m = Math.hypot(...l);
  return [l[0] / m, l[1] / m, l[2] / m];
})();

/** Object space -> view space: yaw by `rot`, then tilt toward the viewer. */
export const toView = ([x, y, z]: Vec3, rot: number): Vec3 => {
  const x1 = x * Math.cos(rot) + z * Math.sin(rot);
  const z1 = -x * Math.sin(rot) + z * Math.cos(rot);
  return [x1, y * Math.cos(TILT) - z1 * Math.sin(TILT), y * Math.sin(TILT) + z1 * Math.cos(TILT)];
};

/** Inverse of `toView`. */
export const toObject = ([x, y, z]: Vec3, rot: number): Vec3 => {
  const y1 = y * Math.cos(TILT) + z * Math.sin(TILT);
  const z1 = -y * Math.sin(TILT) + z * Math.cos(TILT);
  return [x * Math.cos(rot) - z1 * Math.sin(rot), y1, x * Math.sin(rot) + z1 * Math.cos(rot)];
};

export const GLOBE_SPIN = 0.006;

const ellipseArc = (rx: number, ry: number, a0: number, a1: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = a0 + ((a1 - a0) * i) / 60;
    pts.push(`${i === 0 ? "M" : "L"} ${(rx * Math.cos(t)).toFixed(1)} ${(ry * Math.sin(t)).toFixed(1)}`);
  }
  return pts.join(" ");
};

/**
 * Dot-matrix Earth (film [0]). `rot` spins it (radians; f * GLOBE_SPIN); `lit` spreads light from `origin` over an
 * angular radius (radians); `embrace` draws two orbiting arcs of light around it (0..1); `glow` warms the halo.
 */
export const Globe: React.FC<{ cx: number; cy: number; R: number; rot: number; lit?: { origin: Vec3; angle: number }; embrace?: number; embraceTurn?: number; glow?: number }> = ({
  cx, cy, R, rot, lit, embrace = 0, embraceTurn = 0, glow = 0,
}) => {
  const dots = POINTS.map(({ p, land }) => {
    const [x, y, z] = toView(p, rot);
    const shade = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
    let litK = 0;
    if (lit) {
      const d = Math.acos(Math.max(-1, Math.min(1, p[0] * lit.origin[0] + p[1] * lit.origin[1] + p[2] * lit.origin[2])));
      litK = Math.min(1, Math.max(0, (lit.angle - d) / 0.18));
    }
    return { X: cx + R * x, Y: cy - R * y, z, land, shade, litK };
  });
  const back = dots.filter((d) => d.z < 0);
  const front = dots.filter((d) => d.z >= 0);
  const arcs = [-18, 22].map((deg, i) => ({ deg: deg + embraceTurn * (i ? -1 : 1), rx: R * (1.3 + i * 0.1), ry: R * (0.34 + i * 0.04) }));
  return (
    <>
      <Glow x={cx} y={cy} size={R * 3.2} color="90,140,255" opacity={0.28 + 0.2 * glow} />
      <Glow x={cx} y={cy} size={R * 3.6} color="255,214,150" opacity={0.45 * glow} />
      <Svg>
        <defs>
          <radialGradient id="globeBody" cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#14254D" />
            <stop offset="0.6" stopColor="#081230" />
            <stop offset="1" stopColor="#02040C" />
          </radialGradient>
        </defs>
        {arcs.map((a, i) => (
          <g key={`b${i}`} transform={`translate(${cx} ${cy}) rotate(${a.deg})`}>
            <DrawPath d={ellipseArc(a.rx, a.ry, Math.PI, Math.PI * 2)} progress={embrace} stroke="rgba(255,214,150,0.55)" strokeWidth={2} />
          </g>
        ))}
        {back.map((d, i) => <circle key={`k${i}`} cx={d.X} cy={d.Y} r={d.land ? 1.4 : 0.8} fill={`rgba(160,190,255,${0.1 + 0.1 * d.litK})`} />)}
        <circle cx={cx} cy={cy} r={R} fill="url(#globeBody)" opacity={0.88} />
        {front.map((d, i) => {
          const base = d.land ? 0.45 + 0.55 * d.shade : 0.12 + 0.2 * d.shade;
          const r = (d.land ? 2.1 : 1.1) * (0.7 + 0.3 * d.z) * (1 + 0.6 * d.litK);
          const col = d.litK > 0 ? `rgba(255,${Math.round(236 - 30 * d.litK)},${Math.round(200 - 60 * d.litK)},` : d.land ? "rgba(214,226,255," : "rgba(120,150,220,";
          return (
            <g key={`f${i}`}>
              {d.litK > 0.2 ? <circle cx={d.X} cy={d.Y} r={r * 4} fill={`rgba(255,206,130,${0.14 * d.litK})`} /> : null}
              <circle cx={d.X} cy={d.Y} r={r} fill={`${col}${Math.min(1, base + 0.5 * d.litK)})`} />
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(150,190,255,0.55)" strokeWidth={1.5} />
      </Svg>
      <Svg style={{ filter: "blur(14px)" }}>
        <circle cx={cx} cy={cy} r={R + 4} fill="none" stroke="rgba(110,160,255,0.45)" strokeWidth={18} />
      </Svg>
      <Svg>
        {arcs.map((a, i) => (
          <g key={`a${i}`} transform={`translate(${cx} ${cy}) rotate(${a.deg})`}>
            <DrawPath d={ellipseArc(a.rx, a.ry, 0, Math.PI)} progress={embrace} stroke="rgba(255,226,170,0.95)" strokeWidth={2.4} style={{ filter: "drop-shadow(0 0 8px rgba(255,200,120,0.9))" }} />
          </g>
        ))}
      </Svg>
    </>
  );
};
