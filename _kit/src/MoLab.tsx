/**
 * Motion-design reference (src/mo): MoLab0 converging lines of evidence onto one light, with a kicker, a key term in
 * gold caps and strength tags; MoLab1 the dot-matrix globe under a drawn Trinity seal, a flame of reason below.
 * Render from the film or _kit: node scripts/celstills.mjs "MoLab0:150" "MoLabV0:150".
 */
import React, { useMemo } from "react";
import { random, useCurrentFrame } from "remotion";
import {
  Backdrop, C, Caps, Drift, DrawPath, Dust, Flame, GLOBE_SPIN, Globe, Glow, Header, MoScene, Rays, Reveal, Stars, Svg, Tag, Trinity, ease, prog, seg, useStage,
} from "./mo";

const Converge: React.FC = () => {
  const f = useCurrentFrame();
  const S = useStage();
  const focus = { x: S.cx, y: S.oy };
  const nodes = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + random(`cv${i}`) * 0.4;
        const r = S.p(520, 380) * (0.8 + 0.3 * random(`cr${i}`));
        return { x: focus.x + Math.cos(a) * r * S.p(1.35, 1), y: focus.y + Math.sin(a) * r * S.p(0.62, 0.9) };
      }),
    [S.W, S.H],
  );
  const hit = prog(f, 120, 30);
  return (
    <MoScene dur={180} cut={0}>
      <Backdrop inner="#141a36" outer={C.ink} cy={S.v ? 40 : 42} spread={78} />
      <Stars n={260} opacity={0.6} />
      <Drift dur={180} from={1} to={1.05} origin={`${focus.x}px ${focus.y}px`}>
        <Rays id="mo0-rays" x={focus.x} y={focus.y} count={28} length={S.p(900, 1100)} width={[2, 12]} opacity={0.25 * hit} rotate={f * 0.05} blur={3} />
        <Svg>
          {nodes.map((n, i) => {
            const p = prog(f, 30 + i * 8, 60, ease.inOut);
            return (
              <g key={i}>
                <DrawPath d={`M ${n.x} ${n.y} L ${focus.x} ${focus.y}`} progress={p} stroke="#E3B860" strokeWidth={1.6} opacity={0.85} />
                <circle cx={n.x} cy={n.y} r={6 * prog(f, 20 + i * 8, 14, ease.outBack)} fill="#F6D488" />
              </g>
            );
          })}
        </Svg>
        <Glow x={focus.x} y={focus.y} size={S.p(520, 600) * (0.4 + 0.6 * hit)} color="255,214,150" opacity={0.25 + 0.6 * hit} />
        <Glow x={focus.x} y={focus.y} size={90} color="255,250,236" opacity={hit} />
      </Drift>
      <Dust count={70} seed="mo0" opacity={0.5} />
      <Header text="CATECHISM 31" start={10} y={S.p(110, 300)} size={S.p(26, 28)} />
      <Caps text="CONVERGING" start={128} size={S.p(84, 76)} y={S.header} gold sweep={[140, 40]} glow="255,196,110" />
      <Reveal text="and convincing arguments" start={150} size={S.small} italic y={S.t1} color={C.ivoryDim} />
      <Tag text="STRONG" x={nodes[1].x} y={nodes[1].y - 40} start={70} />
      <Tag text="DEBATED" x={nodes[5].x} y={nodes[5].y - 40} start={84} color="#CFE2FF" />
    </MoScene>
  );
};

const WorldLight: React.FC = () => {
  const f = useCurrentFrame();
  const S = useStage();
  return (
    <MoScene dur={180} cut={0}>
      <Backdrop inner="#0E1838" outer={C.ink} cy={S.v ? 38 : 40} spread={80} />
      <Stars n={300} opacity={0.7} band={0.8} />
      <Trinity cx={S.cx} cy={S.oy} r={S.p(300, 360)} progress={prog(f, 10, 120, ease.inOut)} rotate={f * 0.03} opacity={0.5} />
      <Globe cx={S.cx} cy={S.oy} R={S.p(170, 210)} rot={f * GLOBE_SPIN} embrace={prog(f, 40, 90, ease.inOut)} embraceTurn={f * 0.08} glow={seg(f, 60, 140)} />
      <Flame x={S.cx} y={S.header - 20} scale={0.55} />
      <Glow x={S.cx} y={S.header - 60} size={260} color="255,170,90" opacity={0.5} />
      <Caps text="THE LIGHT OF REASON" start={30} size={S.p(44, 40)} y={S.t1} tracking={[0.5, 0.22]} color={C.ivory} />
    </MoScene>
  );
};

const VIEWS = [Converge, WorldLight];
export const MoLab: React.FC<{ v: number }> = ({ v }) => {
  const V = VIEWS[v];
  return <V />;
};
