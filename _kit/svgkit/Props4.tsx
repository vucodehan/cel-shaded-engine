import React from "react";
import { random, useCurrentFrame } from "remotion";
import { Pt, lerp, mod, range, smooth } from "./anim";
import { mixHex, tone } from "./color";
import { GlowS, useUid } from "./Atmos";
import { Smoke } from "./Fx";
import { Look, Person } from "./Person";
import { Palm } from "./Plants";
import { SPECS } from "./Animals";
import { NoScale, SvgIfLoose, useBand, useInk, useRim } from "./Stage";

/**
 * Props for 1 Kings – Esther, Tobit and Judith. Same conventions as Props.tsx: feet/base at y = 0 (on the band's ground
 * at x unless y is given), the band scale k applied automatically, up is negative. Two scales are used:
 *  - Monumental props seen from a distance (SolomonTemple, FortCity, Army, SiegeEngine, Skyline) are drawn like the
 *    kit's City and Host: a man is about 40 units tall there (a Person at s ≈ 0.23 in the same band).
 *  - Everything else is at Person scale (a man = 174 units): Cherubim, BronzeSea, BronzeAltar, PersianThrone, Bed,
 *    Lying, BuildWall, Ruins, Pole, Fish, ChariotOfFire.
 * Heights below are local units at s = 1; multiply by s * K.<band> for screen pixels.
 */

type Base = { x: number; y?: number; s?: number; flip?: boolean };
const useBase = (x: number, y?: number) => {
  const band = useBand();
  return y ?? band.gy(x);
};

const flame = (fx: number, w: number, h: number, lean: number) => `M ${fx - w / 2} 0 Q ${fx - w * 0.45} ${-h * 0.6} ${fx + lean} ${-h} Q ${fx + w * 0.45} ${-h * 0.6} ${fx + w / 2} 0 Z`;

/** A row of n flickering flame tongues, base centred at (x, y), `w` wide and up to `h` tall, strength a 0..1. */
const flames = (f: number, seed: string, x: number, y: number, w: number, h: number, n: number, a: number) =>
  a <= 0.01 ? null : (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      {Array.from({ length: n }, (_, i) => {
        const ww = (w / n) * 1.3;
        const fx = (i - (n - 1) / 2) * (w / n) * 0.9 + range(`${seed}o${i}`, -3, 3);
        const ph = random(`${seed}p${i}`) * 6;
        const hh = h * a * (0.6 + 0.4 * random(`${seed}h${i}`)) * (0.86 + 0.14 * Math.sin(f * 0.5 + ph) + 0.08 * Math.sin(f * 1.3 + ph));
        const lean = Math.sin(f * 0.3 + ph) * ww * 0.2;
        return (
          <g key={i}>
            <path d={flame(fx, ww, hh, lean)} fill="#FF6A18" opacity={0.9} />
            <path d={flame(fx, ww * 0.6, hh * 0.7, lean * 0.6)} fill="#FFB43C" />
            <path d={flame(fx, ww * 0.3, hh * 0.42, lean * 0.3)} fill="#FFF2C4" />
          </g>
        );
      })}
    </g>
  );

const poly = (pts: Pt[]) => `${pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} Z`;

// ── The temple ───────────────────────────────────────────────────────────────────────────

/** Heights of a SolomonTemple at s = 1 (multiply by s * K.<band>): podium/steps top, door top, top of the bronze pillars'
 *  lily capitals, porch cornice, roof of the house, side chambers. `second` lowers the house to 430 and the porch to 360. */
export const TEMPLE_H = { podium: 36, door: 266, pillar: 368, porch: 400, house: 470, chambers: 250 };

/**
 * The temple of Solomon seen from the court: a raised podium with front steps, a tall porch with the two free-standing
 * bronze pillars Jachin and Boaz (lily capitals, chains of pomegranates), cedar doors overlaid with gold, the house
 * rising behind with clerestory windows, side chambers in three storeys. Monumental scale (a man ≈ 40 units).
 * Default w = 560 (porch 314 wide, side chambers 672 wide). Heights in TEMPLE_H.
 *  glow 0..1 lights the doorway and windows; open 0..1 swings the doors (defaults to follow `cloud`);
 *  cloud 0..1 pours the cloud of glory out of the doors and over the roof (1 Kings 8:10);
 *  built 0..1 raises the courses unevenly with scaffolding (pillars cast at 0.8–0.92, doors hung after 0.9);
 *  burn 0..1 sets it on fire (flames, smoke, charring), and past 0.55 the walls fall to broken stubs and the pillars go;
 *  second draws the plainer second temple of Ezra 3–6 (no bronze pillars, plain cedar doors, lower house).
 */
export const SolomonTemple: React.FC<Base & { w?: number; glow?: number; open?: number; cloud?: number; built?: number; burn?: number; second?: boolean; seed?: string }> = ({
  x,
  y,
  s = 1,
  w = 560,
  glow = 0,
  open,
  cloud = 0,
  built = 1,
  burn = 0,
  second = false,
  seed = "stm",
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const clip = useUid("stc");
  const puff = useUid("stp");
  const char = Math.min(1, burn * 1.3);
  const stone = ink(mixHex(second ? "#A89A80" : "#C0AA84", "#2A221E", char * 0.72));
  const gold = ink(mixHex(second ? "#8A7450" : "#D0A040", "#3A2A1A", char * 0.8));
  const bronze = ink(mixHex("#A26A32", "#3A2A1E", char * 0.6));
  const cedar = ink(mixHex("#5E3C22", "#1A120C", char));
  const P = TEMPLE_H.podium;
  const houseTop = second ? 430 : TEMPLE_H.house;
  const porchTop = second ? 360 : TEMPLE_H.porch;
  const chamTop = second ? 220 : TEMPLE_H.chambers;
  const opTop = second ? 300 : 330;
  const hw = w * 0.42;
  const cw = w * 0.6;
  const pw = w * 0.28;
  const ow = w * 0.15;
  const dw = ow * 0.76;
  const doorTop = TEMPLE_H.door;
  const collapse = Math.max(0, (burn - 0.55) / 0.45);
  const level = Math.min(built, 1 - 0.62 * collapse);
  const partial = level < 0.999;
  const nStrip = 16;
  const sw = (cw * 2 + 40) / nStrip;
  const fullH = houseTop + 14 - P;
  const stripTop = (i: number) => -(P + fullH * Math.max(0, Math.min(1, level * 1.25 - 0.25 * random(`${seed}u${i}`))));
  const roofAt = (xx: number) => (Math.abs(xx) <= hw ? houseTop + 14 : Math.abs(xx) <= cw ? chamTop + 8 : P);
  const stripY = (i: number) => Math.max(stripTop(i), -roofAt(-cw - 20 + (i + 0.5) * sw));
  const op = open ?? Math.min(1, cloud * 2);
  const fire = Math.min(1, burn * 3) * (1 - 0.6 * Math.max(0, (burn - 0.85) / 0.15));
  const pillarA = second ? 0 : Math.min(1, Math.max(0, (built - 0.8) / 0.12)) * (1 - Math.min(1, Math.max(0, (burn - 0.6) / 0.25)));
  const doorsA = Math.min(1, Math.max(0, (built - 0.9) / 0.08)) * (1 - collapse);
  const lit = Math.max(glow, cloud);
  const interior = built < 0.9 ? tone(stone, -0.45) : mixHex(mixHex("#0C0806", "#F0C070", Math.min(1, lit * 0.9 + fire * 0.4)), "#FFF8EA", cloud * 0.85);
  const win = lit > 0 || fire > 0 ? mixHex("#120C08", "#F0B860", Math.min(1, lit * 0.8 + fire * 0.6)) : "#120C08";
  const masonry = (
    <>
      {[-1, 1].map((k) => (
        <g key={k}>
          <rect x={k < 0 ? -cw : hw} y={-chamTop} width={cw - hw} height={chamTop - P} fill={tone(stone, -0.12)} stroke={rim(0.8)} strokeWidth={1.3} />
          {[1, 2].map((r) => (
            <line key={r} x1={k < 0 ? -cw : hw} y1={-P - ((chamTop - P) * r) / 3} x2={k < 0 ? -hw : cw} y2={-P - ((chamTop - P) * r) / 3} stroke={tone(stone, -0.35)} strokeWidth={2} />
          ))}
          {[0, 1, 2].map((r) =>
            [0.3, 0.7].map((u) => <rect key={`${r}${u}`} x={(k < 0 ? -cw : hw) + (cw - hw) * u - 5} y={-P - ((chamTop - P) * (r + 0.72)) / 3} width={10} height={18} fill={win} />),
          )}
          <rect x={(k < 0 ? -cw : hw) - (k < 0 ? 4 : 0)} y={-chamTop - 8} width={cw - hw + 4} height={8} fill={tone(stone, 0.06)} stroke={rim(0.7)} strokeWidth={1} />
        </g>
      ))}
      <rect x={-hw} y={-houseTop} width={hw * 2} height={houseTop - P} fill={stone} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: Math.floor((houseTop - P) / 24) }, (_, i) => (
        <line key={i} x1={-hw} y1={-P - (i + 1) * 24} x2={hw} y2={-P - (i + 1) * 24} stroke={tone(stone, -0.22)} strokeWidth={0.9} opacity={0.7} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={`w${i}`} x={-hw + ((hw * 2) / 10) * (i + 1) - 5} y={-houseTop + 22} width={10} height={30} fill={win} />
      ))}
      <rect x={-hw - 6} y={-houseTop - 14} width={hw * 2 + 12} height={14} fill={tone(stone, 0.08)} stroke={rim(0.9)} strokeWidth={1.2} />
      {!second ? <rect x={-hw - 6} y={-houseTop - 3} width={hw * 2 + 12} height={3} fill={gold} /> : null}
      <rect x={-pw} y={-porchTop} width={pw * 2} height={porchTop - P} fill={tone(stone, 0.05)} stroke={rim(1)} strokeWidth={1.5} />
      {Array.from({ length: Math.floor((porchTop - P) / 24) }, (_, i) => (
        <line key={`p${i}`} x1={-pw} y1={-P - (i + 1) * 24} x2={pw} y2={-P - (i + 1) * 24} stroke={tone(stone, -0.18)} strokeWidth={0.9} opacity={0.6} />
      ))}
      <rect x={-pw - 10} y={-porchTop - 16} width={pw * 2 + 20} height={16} fill={second ? tone(stone, 0.1) : tone(stone, 0.12)} stroke={rim(1)} strokeWidth={1.3} />
      {!second ? (
        <>
          <rect x={-pw - 10} y={-porchTop + 2} width={pw * 2 + 20} height={7} fill={gold} />
          <path d={Array.from({ length: 18 }, (_, i) => `${i ? "L" : "M"} ${-pw + (i * pw * 2) / 17} ${-porchTop + 18 + (i % 2) * 10}`).join(" ")} stroke={gold} strokeWidth={1.6} fill="none" />
        </>
      ) : null}
      <rect x={-ow} y={-opTop} width={ow * 2} height={opTop - P} fill={interior} />
      <rect x={-ow} y={-opTop} width={ow * 2} height={opTop - P} fill="none" stroke={tone(stone, -0.3)} strokeWidth={7} />
      {!second ? <rect x={-ow - 5} y={-opTop - 5} width={ow * 2 + 10} height={opTop - P + 5} fill="none" stroke={gold} strokeWidth={1.6} /> : null}
      {doorsA > 0 ? (
        <g opacity={doorsA}>
          <rect x={-dw - 6} y={-doorTop - 8} width={dw * 2 + 12} height={doorTop - P + 8} fill={mixHex(tone(cedar, -0.2), interior, op)} />
          {[-1, 1].map((k) => (
            <g key={k} transform={`translate(${k * dw} 0) scale(${1 - 0.86 * op} 1) translate(${-k * dw} 0)`}>
              <rect x={k < 0 ? -dw : 0} y={-doorTop} width={dw} height={doorTop - P} fill={second ? cedar : gold} stroke={rim(0.8)} strokeWidth={1.1} />
              {[0, 1, 2].map((r) => (
                <rect key={r} x={(k < 0 ? -dw : 0) + dw * 0.16} y={-doorTop + 12 + r * ((doorTop - P - 24) / 3)} width={dw * 0.68} height={(doorTop - P - 24) / 3 - 10} fill="none" stroke={second ? tone(cedar, 0.2) : tone(gold, -0.3)} strokeWidth={1.4} />
              ))}
              {!second ? <path d={`M ${(k < 0 ? -dw : 0) + dw * 0.5} ${-doorTop + 30} q ${-dw * 0.18} ${30} 0 ${60} q ${dw * 0.18} ${-30} 0 ${-60}`} stroke={tone(gold, 0.25)} strokeWidth={1.2} fill="none" /> : null}
            </g>
          ))}
        </g>
      ) : null}
    </>
  );
  const scaffold =
    built < 1 && burn <= 0
      ? Array.from({ length: 6 }, (_, i) => {
          const sx = -cw + 30 + i * ((cw * 2 - 60) / 5);
          const top = -stripTop(Math.min(nStrip - 1, Math.floor((sx + cw + 20) / sw))) + 46;
          if (top <= P + 20) return null;
          return (
            <g key={`sc${i}`} stroke={ink("#7A5A36")} strokeWidth={2.4}>
              <line x1={sx - 16} y1={0} x2={sx - 16} y2={-top} />
              <line x1={sx + 16} y1={0} x2={sx + 16} y2={-top} />
              {Array.from({ length: Math.floor(top / 42) }, (_, k) => (
                <line key={k} x1={sx - 22} y1={-(k + 1) * 42} x2={sx + 22} y2={-(k + 1) * 42} strokeWidth={3} />
              ))}
              <line x1={sx - 16} y1={-10} x2={sx + 16} y2={-Math.min(top, 80)} strokeWidth={1.4} />
            </g>
          );
        })
      : null;
  const pillar = (px: number) => (
    <g key={px} opacity={pillarA} transform={`${burn > 0.6 ? `rotate(${(px > 0 ? 1 : -1) * 30 * Math.min(1, (burn - 0.6) / 0.25)} ${px} ${-P}) ` : ""}translate(${px} 0) scale(1.22 1) translate(${-px} 0)`}>
      <rect x={px - 18} y={-P - 10} width={36} height={10} fill={tone(bronze, -0.15)} stroke={rim(0.8)} strokeWidth={1} />
      <rect x={px - 13} y={-300} width={26} height={300 - P - 10} fill={bronze} stroke={rim(1)} strokeWidth={1.3} />
      <rect x={px - 10} y={-300} width={6} height={300 - P - 10} fill={tone(bronze, 0.28)} opacity={0.8} />
      <path d={`M ${px - 22} -300 Q ${px - 31} -321 ${px - 20} -342 L ${px + 20} -342 Q ${px + 31} -321 ${px + 22} -300 Z`} fill={bronze} stroke={rim(1)} strokeWidth={1.2} />
      {[-1, 1].map((d) => (
        <path key={d} d={`M ${px - 26} ${-321 + d * 8} L ${px + 26} ${-321 - d * 8}`} stroke={tone(bronze, -0.3)} strokeWidth={1} />
      ))}
      <path d={`M ${px - 27} -321 L ${px + 27} -321 M ${px - 18} -334 L ${px - 6} -306 M ${px - 6} -334 L ${px + 6} -306 M ${px + 6} -334 L ${px + 18} -306 M ${px - 6} -306 L ${px + 6} -334 M ${px + 6} -306 L ${px + 18} -334`} stroke={tone(bronze, -0.3)} strokeWidth={1} />
      {[-305, -337].map((ry) =>
        Array.from({ length: 7 }, (_, i) => <circle key={`${ry}${i}`} cx={px - 24 + i * 8} cy={ry} r={3.2} fill={ink(mixHex("#A8482A", "#2A1A14", char))} />),
      )}
      <path d={`M ${px - 21} -342 Q ${px - 28} -357 ${px - 15} -367 Q ${px - 7} -354 ${px} -369 Q ${px + 7} -354 ${px + 15} -367 Q ${px + 28} -357 ${px + 21} -342 Z`} fill={tone(bronze, 0.18)} stroke={rim(1)} strokeWidth={1.1} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={cw + 60} ry={12} fill="rgba(0,0,0,0.35)" />
      {lit > 0 ? <GlowS x={0} y={-220} r={cw * 1.1} squash={0.75} color="255,214,140" opacity={0.35 * lit} /> : null}
      {fire > 0 ? <GlowS x={0} y={-200} r={cw * 1.3} squash={0.8} color="255,130,50" opacity={0.55 * fire} /> : null}
      {partial ? (
        <defs>
          <clipPath id={clip}>
            {Array.from({ length: nStrip }, (_, i) => (
              <rect key={i} x={-cw - 20 + i * sw - 0.5} y={stripTop(i)} width={sw + 1} height={-stripTop(i) + 4} />
            ))}
          </clipPath>
        </defs>
      ) : null}
      <g clipPath={partial ? `url(#${clip})` : undefined}>{masonry}</g>
      {partial && burn > 0
        ? Array.from({ length: nStrip }, (_, i) =>
            stripY(i) < -P - 2 ? <path key={`j${i}`} d={`M ${-cw - 20 + i * sw} ${stripY(i)} l ${sw * 0.3} ${-6} l ${sw * 0.3} ${8} l ${sw * 0.4} ${-4}`} stroke={tone(stone, -0.4)} strokeWidth={2} fill="none" /> : null,
          )
        : null}
      <rect x={-cw - 30} y={-P} width={cw * 2 + 60} height={P} fill={tone(stone, -0.14)} stroke={rim(0.8)} strokeWidth={1.2} />
      <line x1={-cw - 30} y1={-P / 2} x2={cw + 30} y2={-P / 2} stroke={tone(stone, -0.35)} strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => {
        const sw2 = ow * 2 + 70 + i * 34;
        return <rect key={`st${i}`} x={-sw2 / 2} y={-P + i * 9} width={sw2} height={9} fill={i % 2 ? tone(stone, -0.05) : tone(stone, 0.08)} stroke={rim(0.6)} strokeWidth={0.8} />;
      })}
      {built < 1 && burn <= 0
        ? [-1, 1].map((k) =>
            [0, 1, 2].map((i) => <rect key={`bl${k}${i}`} x={k * (cw + 50) + (i - 1) * 26 - 12} y={-14 - (i === 1 ? 12 : 0)} width={24} height={12} fill={tone(stone, 0.05)} stroke={rim(0.6)} strokeWidth={0.8} />),
          )
        : null}
      {scaffold}
      {pillarA > 0 ? [pillar(-ow - 16), pillar(ow + 16)] : null}
      {fire > 0 ? (
        <>
          {flames(f, `${seed}fd`, 0, -P, ow * 2, 200, 5, fire)}
          {Array.from({ length: 6 }, (_, i) => {
            const i2 = Math.floor((i + 0.5) * (nStrip / 6));
            return <g key={`rf${i}`}>{flames(f, `${seed}fr${i}`, -cw - 20 + (i2 + 0.5) * sw, partial ? stripY(i2) : -roofAt(-cw - 20 + (i2 + 0.5) * sw), sw * 1.6, 130, 3, fire * (0.6 + 0.4 * random(`${seed}fa${i}`)))}</g>;
          })}
          <Smoke x={-hw * 0.4} y={-houseTop * 0.8} s={2.2} n={12} life={170} rise={1.4} drift={0.35} color="60,52,48" opacity={0.6 * Math.min(1, burn * 2)} seed={`${seed}s1`} />
          <Smoke x={hw * 0.5} y={-houseTop * 0.7} s={2.6} n={12} life={190} rise={1.2} drift={0.25} color="70,60,54" opacity={0.55 * Math.min(1, burn * 2)} seed={`${seed}s2`} />
        </>
      ) : null}
      {glow > 0 && doorsA > 0 ? <GlowS x={0} y={-P - 90} r={ow * 2.4} squash={1.2} color="255,220,150" opacity={0.6 * glow} /> : null}
      {cloud > 0 ? (
        <>
          <defs>
            <radialGradient id={puff}>
              <stop offset="0" stopColor="#FFFCF2" stopOpacity={0.95} />
              <stop offset="0.55" stopColor="#FFF6E2" stopOpacity={0.7} />
              <stop offset="1" stopColor="#FFF0D8" stopOpacity={0} />
            </radialGradient>
          </defs>
          <GlowS x={0} y={-houseTop * 0.5} r={cw * 1.3} squash={0.8} color="255,240,206" opacity={0.55 * cloud} />
          <ellipse cx={0} cy={-P - 140} rx={ow * 1.9} ry={ow * 2.4} fill={`url(#${puff})`} opacity={0.9 * cloud} />
          {Array.from({ length: 10 }, (_, i) => {
            const L = 150;
            const t = mod(f + (i * L) / 10 + random(`${seed}g${i}`) * 15, L) / L;
            const side = i % 2 ? 1 : -1;
            return <ellipse key={`gr${i}`} cx={side * (ow * 0.6 + t * cw * 1.15)} cy={-P - 30 - t * 30} rx={50 + 120 * t} ry={34 + 60 * t} fill={`url(#${puff})`} opacity={cloud * 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.05))} />;
          })}
          {Array.from({ length: 16 }, (_, i) => {
            const L = 190;
            const t = mod(f + (i * L) / 16 + random(`${seed}c${i}`) * 20, L) / L;
            const side = random(`${seed}cs${i}`) - 0.5;
            return (
              <ellipse
                key={`cl${i}`}
                cx={side * 2 * (20 + cw * 0.95 * t)}
                cy={-P - 150 - t * (houseTop * 0.85 + 140 * random(`${seed}ch${i}`))}
                rx={60 + 170 * t}
                ry={(60 + 170 * t) * 0.7}
                fill={`url(#${puff})`}
                opacity={cloud * 0.8 * Math.sin(Math.PI * Math.min(1, t * 1.1))}
              />
            );
          })}
        </>
      ) : null}
    </g>
  );
};

/** The two great gold cherubim of the Most Holy Place (1 Kings 6:23–28), side by side and facing out: each outer wing
 *  reaches a wall (x = ±w/2), the inner wings meet over the centre at (0, -0.8h), where ArkCovenant (s ≈ 1.1–1.3 in the
 *  same band) stands beneath them. Person scale, default w = 720, h = 360 (wingspan = height, as in the text). */
export const Cherubim: React.FC<Base & { w?: number; h?: number; glow?: number }> = ({ x, y, s = 1, w = 720, h = 360, glow = 0.5 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const gold = glow > 0 ? mixHex(ink("#D2A43C"), "#FFE6A8", glow * 0.25) : ink("#D2A43C");
  const dark = tone(gold, -0.3);
  const lite = tone(gold, 0.25);
  const wing = (sx: number, sy: number, tx: number, ty: number, up: number, key: string) => {
    const n = 6;
    let d = `M ${sx} ${sy} Q ${(sx + tx) / 2} ${Math.min(sy, ty) - up} ${tx} ${ty}`;
    const feathers: React.ReactNode[] = [];
    for (let i = 1; i <= n; i++) {
      const t0 = (i - 1) / n;
      const t1 = i / n;
      const ax = lerp(tx, sx, t0);
      const ay = lerp(ty, sy + 44, t0) + Math.sin(t0 * Math.PI) * 26;
      const bx = lerp(tx, sx, t1);
      const by = lerp(ty, sy + 44, t1) + Math.sin(t1 * Math.PI) * 26;
      d += ` Q ${(ax + bx) / 2} ${(ay + by) / 2 + 22} ${bx} ${by}`;
      const ux = lerp(tx, sx, t1);
      const uy = lerp(ty, sy, t1) - Math.sin(t1 * Math.PI) * up * 0.5;
      if (i < n) feathers.push(<line key={i} x1={bx} y1={by} x2={lerp(bx, ux, 0.75)} y2={lerp(by, uy, 0.75)} stroke={dark} strokeWidth={1.4} />);
    }
    return (
      <g key={key}>
        <path d={`${d} Z`} fill={gold} stroke={rim(1)} strokeWidth={1.4} />
        {feathers}
        <path d={`M ${sx} ${sy + 8} Q ${(sx + tx) / 2} ${Math.min(sy, ty) - up * 0.55 + 14} ${lerp(sx, tx, 0.86)} ${lerp(sy, ty, 0.86) + 10}`} stroke={lite} strokeWidth={1.6} fill="none" />
      </g>
    );
  };
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      {glow > 0 ? <GlowS x={0} y={-h * 0.6} r={w * 0.62} squash={0.75} color="255,214,140" opacity={0.5 * glow * (0.92 + 0.08 * Math.sin(f * 0.07))} /> : null}
      {[-1, 1].map((k) => {
        const cx = (k * w) / 4;
        const sy = -h * 0.56;
        return (
          <g key={k}>
            {wing(cx + k * 18, sy, (k * w) / 2, -h * 0.72, h * 0.22, "o")}
            {wing(cx - k * 18, sy, -k * 6, -h * 0.8, h * 0.2, "i")}
            <ellipse cx={cx} cy={0} rx={52} ry={6} fill="rgba(0,0,0,0.35)" />
            <path d={`M ${cx - 34} 0 L ${cx - 20} ${-h * 0.56} Q ${cx} ${-h * 0.6} ${cx + 20} ${-h * 0.56} L ${cx + 34} 0 Z`} fill={gold} stroke={rim(1)} strokeWidth={1.4} />
            {[-14, 0, 14].map((o) => (
              <line key={o} x1={cx + o * 0.55} y1={-h * 0.5} x2={cx + o * 1.2} y2={-6} stroke={dark} strokeWidth={1.3} opacity={0.7} />
            ))}
            <path d={`M ${cx - 20} ${-h * 0.44} Q ${cx} ${-h * 0.36} ${cx + 20} ${-h * 0.44}`} stroke={lite} strokeWidth={2} fill="none" />
            <circle cx={cx} cy={-h * 0.64} r={17} fill={gold} stroke={rim(1)} strokeWidth={1.3} />
            <path d={`M ${cx - 17} ${-h * 0.65} Q ${cx} ${-h * 0.73} ${cx + 17} ${-h * 0.65} Q ${cx} ${-h * 0.69} ${cx - 17} ${-h * 0.65} Z`} fill={dark} />
            <circle cx={cx + 5} cy={-h * 0.645} r={4} fill={lite} opacity={0.5} />
          </g>
        );
      })}
    </g>
  );
};

/** The Sea of cast bronze on twelve oxen (1 Kings 7:23–26): seen from the front, one ox side-on at each end and three
 *  facing the viewer between (the rest hidden). Person scale; default w = 420 (rim diameter); rim top at -250, oxen 120 tall. */
export const BronzeSea: React.FC<Base & { w?: number; glow?: number }> = ({ x, y, s = 1, w = 420, glow = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const br = ink("#9A6430");
  const dk = tone(br, -0.32);
  const lt = tone(br, 0.25);
  const cow = SPECS.cow;
  const sideOx = (ox: number, dir: number, shade: number, key: string) => (
    <g key={key} transform={`translate(${ox} 0) scale(${dir * 2} 2)`}>
      {cow.legs.map((l, i) => (
        <path key={i} d={`M ${l[0]} ${l[1]} L ${l[0] + 1} ${l[1] + l[2]} L ${l[0] + 1} 0`} stroke={i < 2 ? tone(br, -0.45 - shade) : tone(br, -shade)} strokeWidth={cow.legW} strokeLinecap="round" fill="none" />
      ))}
      <path d={cow.body} fill={tone(br, -shade)} stroke={rim(0.8)} strokeWidth={0.9} />
      <path d={cow.head} fill={tone(br, -shade)} stroke={rim(0.8)} strokeWidth={0.9} />
      {cow.extra ? <path d={cow.extra} stroke={tone(br, 0.1 - shade)} strokeWidth={3} fill="none" /> : null}
    </g>
  );
  const frontOx = (ox: number, key: string) => (
    <g key={key} transform={`translate(${ox} 0) scale(1.25) translate(${-ox} 0)`}>
      <rect x={ox - 16} y={-52} width={9} height={52} rx={3} fill={tone(br, -0.12)} stroke={rim(0.6)} strokeWidth={0.8} />
      <rect x={ox + 7} y={-52} width={9} height={52} rx={3} fill={tone(br, -0.12)} stroke={rim(0.6)} strokeWidth={0.8} />
      <path d={`M ${ox - 26} -96 Q ${ox} -104 ${ox + 26} -96 L ${ox + 22} -50 Q ${ox} -42 ${ox - 22} -50 Z`} fill={br} stroke={rim(0.9)} strokeWidth={1} />
      <path d={`M ${ox - 13} -88 Q ${ox} -92 ${ox + 13} -88 L ${ox + 10} -58 Q ${ox} -50 ${ox - 10} -58 Z`} fill={lt} stroke={rim(0.8)} strokeWidth={0.9} />
      <path d={`M ${ox - 12} -86 Q ${ox - 30} -92 ${ox - 30} -104 M ${ox + 12} -86 Q ${ox + 30} -92 ${ox + 30} -104`} stroke={tone(br, 0.35)} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <ellipse cx={ox - 16} cy={-82} rx={6} ry={3} fill={dk} />
      <ellipse cx={ox + 16} cy={-82} rx={6} ry={3} fill={dk} />
      <ellipse cx={ox} cy={-58} rx={7} ry={4} fill={dk} />
    </g>
  );
  const rimY = -250;
  const baseY = -122;
  const scal = Array.from({ length: 22 }, (_, i) => {
    const t = i / 21;
    const xx = lerp(-w / 2, w / 2, t);
    return `${i === 0 ? "M" : "Q"} ${i === 0 ? "" : `${xx - w / 42} ${rimY - 12} `}${xx} ${rimY}`;
  }).join(" ");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.62} ry={9} fill="rgba(0,0,0,0.35)" />
      {sideOx(-w * 0.34, -1, 0.12, "l")}
      {sideOx(w * 0.34, 1, 0.12, "r")}
      {[-w * 0.15, 0, w * 0.15].map((ox, i) => frontOx(ox, `f${i}`))}
      <rect x={-w * 0.3} y={baseY - 6} width={w * 0.6} height={10} rx={4} fill={dk} stroke={rim(0.7)} strokeWidth={1} />
      <path d={`M ${-w / 2} ${rimY} Q ${-w * 0.46} ${-172} ${-w * 0.29} ${baseY} L ${w * 0.29} ${baseY} Q ${w * 0.46} ${-172} ${w / 2} ${rimY} Z`} fill={br} stroke={rim(1)} strokeWidth={1.5} />
      <path d={`M ${-w * 0.45} ${-200} Q ${-w * 0.4} ${-160} ${-w * 0.29} ${baseY} L ${w * 0.29} ${baseY} Q ${w * 0.4} ${-160} ${w * 0.45} ${-200} Q 0 ${-178} ${-w * 0.45} ${-200} Z`} fill={dk} opacity={0.45} />      {[rimY + 18, rimY + 30].map((ry, r) =>
        Array.from({ length: 24 }, (_, i) => {
          const xx = lerp(-w * (0.47 - r * 0.02), w * (0.47 - r * 0.02), i / 23);
          return <circle key={`${r}${i}`} cx={xx} cy={ry} r={3.6} fill={tone(br, 0.12)} stroke={dk} strokeWidth={0.8} />;
        }),
      )}
      <rect x={-w / 2 - 4} y={rimY - 4} width={w + 8} height={10} rx={4} fill={tone(br, 0.1)} stroke={rim(1)} strokeWidth={1.2} />
      <path d={scal} stroke={lt} strokeWidth={2} fill="none" />
      <path d={`M ${-w * 0.4} ${rimY - 2} Q 0 ${rimY + 4} ${w * 0.4} ${rimY - 2}`} stroke={`rgba(200,226,255,${0.45 + 0.2 * Math.sin(f * 0.08)})`} strokeWidth={1.6} fill="none" />
      {glow > 0 ? <GlowS x={0} y={rimY} r={w * 0.5} squash={0.4} color="255,220,160" opacity={0.4 * glow} /> : null}
    </g>
  );
};

/** The great bronze altar in the temple court, lowered from the biblical ten cubits so a priest can tend it: a bronze box
 *  with a grating, four horns, `fire` 0..1 on top (pair with <Smoke>). Person scale; default w = 240, h = 140 (fire base);
 *  horn tips at -h - 22. */
export const BronzeAltar: React.FC<Base & { w?: number; h?: number; fire?: number; seed?: string }> = ({ x, y, s = 1, w = 240, h = 140, fire = 0, seed = "ba" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const br = ink("#A8703A");
  const dk = tone(br, -0.35);
  const lt = tone(br, 0.22);
  const horn = (hx: number, hy: number, dir: number, c: string, k: string) => (
    <path key={k} d={`M ${hx - 9} ${hy} L ${hx - 7} ${hy - 12} Q ${hx + dir * 2} ${hy - 26} ${hx + dir * 10} ${hy - 22} Q ${hx + dir * 4} ${hy - 16} ${hx + 7} ${hy - 10} L ${hx + 9} ${hy} Z`} fill={c} stroke={rim(0.8)} strokeWidth={1} />
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.62} ry={8} fill="rgba(0,0,0,0.35)" />
      {fire > 0 ? <GlowS x={0} y={-h - 30} r={w * 0.9} squash={0.7} color="255,150,60" opacity={0.5 * fire} /> : null}
      {horn(-w / 2 + 30, -h, -1, dk, "hb1")}
      {horn(w / 2 - 30, -h, 1, dk, "hb2")}
      <rect x={-w / 2} y={-h} width={w} height={h} fill={br} stroke={rim(1)} strokeWidth={1.5} />
      <rect x={-w / 2} y={-h} width={w * 0.16} height={h} fill={lt} opacity={0.35} />
      <rect x={-w / 2 - 8} y={-h * 0.52} width={w + 16} height={10} fill={tone(br, 0.08)} stroke={rim(0.9)} strokeWidth={1.1} />
      <g stroke={dk} strokeWidth={1.3} opacity={0.85}>
        {Array.from({ length: 10 }, (_, i) => (
          <line key={`a${i}`} x1={-w / 2 + 6 + i * (w / 10)} y1={-h * 0.42} x2={-w / 2 + 6 + i * (w / 10) + 24} y2={-10} />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <line key={`b${i}`} x1={-w / 2 + 30 + i * (w / 10)} y1={-h * 0.42} x2={-w / 2 + 6 + i * (w / 10)} y2={-10} />
        ))}
      </g>
      <rect x={-w / 2 - 6} y={-h - 8} width={w + 12} height={10} fill={tone(br, 0.12)} stroke={rim(1)} strokeWidth={1.2} />
      {[-1, 1].map((k) => (
        <circle key={k} cx={k * (w / 2 - 14)} cy={-h * 0.47 + 5} r={6} fill="none" stroke={lt} strokeWidth={2} />
      ))}
      {horn(-w / 2 + 6, -h - 8, -1, br, "hf1")}
      {horn(w / 2 - 6, -h - 8, 1, br, "hf2")}
      {fire > 0 ? flames(f, seed, 0, -h - 8, w * 0.75, 110, 6, fire) : null}
    </g>
  );
};

/** A Persian royal throne on a stepped dais under a fringed canopy (Susa). Faces right (flip to face left). Person scale:
 *  dais top at -36 (that is the `seat` anchor: a Person at x = 0, y = 0 with pose sit: 1 sits on the cushion, facing the
 *  throne's way); cushion at -84..-92, back top at -206, canopy at -330. */
export const PersianThrone: React.FC<Base & { canopy?: boolean; seat?: React.ReactNode }> = ({ x, y, s = 1, flip = false, canopy = true, seat }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const gold = ink("#C8963A");
  const g2 = tone(gold, -0.3);
  const g3 = tone(gold, 0.25);
  const D = 36;
  const paw = (px: number) => (
    <g key={px}>
      <path d={`M ${px - 3} ${-D - 48} L ${px - 4} ${-D - 8} Q ${px - 2} ${-D} ${px + 8} ${-D} L ${px + 4} ${-D - 10} L ${px + 4} ${-D - 48} Z`} fill={gold} stroke={rim(0.8)} strokeWidth={1} />
      <ellipse cx={px + 3} cy={-D - 3} rx={8} ry={3.6} fill={g3} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={170} ry={8} fill="rgba(0,0,0,0.35)" />
      {canopy ? (
        <>
          <line x1={-96} y1={-D} x2={-96} y2={-330} stroke={gold} strokeWidth={4} />
          <line x1={92} y1={-D} x2={92} y2={-330} stroke={gold} strokeWidth={4} />
          <path d="M -112 -336 L 108 -336 L 108 -304 Q 0 -290 -112 -304 Z" fill={ink("#4A2266")} stroke={rim(0.9)} strokeWidth={1.2} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={-112 + i * 37} y={-336} width={18} height={32} fill={ink("#E8DCC0")} opacity={0.85} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`t${i}`} x1={-108 + i * 19.5} y1={-300 + Math.sin((i / 11) * Math.PI) * 9} x2={-108 + i * 19.5} y2={-288 + Math.sin((i / 11) * Math.PI) * 9} stroke={g3} strokeWidth={2.4} strokeLinecap="round" />
          ))}
          <circle cx={-96} cy={-340} r={5} fill={g3} />
          <circle cx={92} cy={-340} r={5} fill={g3} />
        </>
      ) : null}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={-150 + i * 20} y={-12 - i * 12} width={300 - i * 40} height={12} fill={i % 2 ? ink("#8A7A68") : ink("#A8987E")} stroke={rim(0.7)} strokeWidth={1} />
      ))}
      <rect x={-150} y={-12} width={300} height={2.5} fill={g3} />
      <rect x={-110} y={-D} width={220} height={2.5} fill={g3} />
      {paw(-28)}
      {paw(24)}
      <path d={`M -34 ${-D - 50} L -38 ${-D - 166} Q -36 ${-D - 178} -26 ${-D - 176} L -22 ${-D - 50} Z`} fill={gold} stroke={rim(1)} strokeWidth={1.3} />
      <circle cx={-31} cy={-D - 182} r={6} fill={g3} />
      <path d={`M -36 ${-D - 120} L -22 ${-D - 120} M -37 ${-D - 90} L -22 ${-D - 90}`} stroke={g2} strokeWidth={2} />
      <rect x={-36} y={-D - 56} width={72} height={10} rx={3} fill={gold} stroke={rim(0.9)} strokeWidth={1.1} />
      <rect x={-32} y={-D - 64} width={64} height={9} rx={4} fill={ink("#6A2A44")} />
      <path d={`M 20 ${-D - 56} L 24 ${-D - 86} Q 32 ${-D - 94} 40 ${-D - 86} L 38 ${-D - 56} Z`} fill={gold} stroke={rim(0.8)} strokeWidth={1} />
      <rect x={34} y={-D - 14} width={34} height={14} rx={2} fill={gold} stroke={rim(0.8)} strokeWidth={1} />
      <NoScale>
        <g transform={`translate(0 ${-D})`}>{seat}</g>
      </NoScale>
    </g>
  );
};

/** A couch with a headboard and pillow (David in old age, a sick king, the Shunammite's son on Elisha's bed). The head end
 *  is on the left (flip for right). `sleeper` lies on it face up (drawn with Lying), `cover` (a colour) lays a blanket
 *  over the legs and body, `tilt` props the sleeper up on the pillow (degrees). Person scale: mattress top at -58, len 230. */
export const Bed: React.FC<Base & { len?: number; sleeper?: Look | null; cover?: string | null; tilt?: number; color?: string; s2?: number }> = ({
  x,
  y,
  s = 1,
  flip = false,
  len = 230,
  sleeper = null,
  cover = "#5A4A6A",
  tilt = 8,
  color = "#6A4A2E",
  s2 = 1,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const wood = ink(color);
  const L = len / 2;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={L + 20} ry={7} fill="rgba(0,0,0,0.35)" />
      <rect x={-L} y={-46} width={7} height={46} fill={tone(wood, -0.2)} />
      <rect x={L - 7} y={-46} width={7} height={46} fill={tone(wood, -0.2)} />
      <path d={`M ${-L - 4} -46 L ${-L - 4} -112 Q ${-L + 6} -122 ${-L + 12} -110 L ${-L + 12} -46 Z`} fill={wood} stroke={rim(0.9)} strokeWidth={1.2} />
      <rect x={-L - 2} y={-50} width={len + 4} height={8} rx={2} fill={wood} stroke={rim(0.8)} strokeWidth={1.1} />
      <rect x={-L + 4} y={-60} width={len - 8} height={11} rx={5} fill={ink("#D8CCB4")} stroke={rim(0.5)} strokeWidth={0.8} />
      <ellipse cx={-L + 30} cy={-66} rx={24} ry={9} fill={ink("#E6DCC8")} stroke={rim(0.5)} strokeWidth={0.8} />
      {sleeper ? (
        <NoScale>
          <Lying x={0} y={-58} look={sleeper} s={s2} tilt={tilt} />
        </NoScale>
      ) : null}
      {sleeper && cover ? <path d={`M ${-L + 58} -60 Q ${-L + 62} -86 ${-L + 92} -84 L ${L - 6} -76 Q ${L + 2} -66 ${L - 4} -50 L ${-L + 54} -50 Z`} fill={ink(cover)} stroke={rim(0.7)} strokeWidth={1} /> : null}
    </g>
  );
};

/** A figure lying on the ground centred at x: face up with the head to the left, or `prone` (face down, head right).
 *  `flip` mirrors it (head right when face up). `tilt` raises the head and shoulders (degrees; 15–25 = propped on an
 *  elbow or pillow). Length about 175 * s at Person scale. */
export const Lying: React.FC<{ x: number; y?: number; look: Look; s?: number; prone?: boolean; flip?: boolean; opacity?: number; arm?: [number, number]; arm2?: [number, number]; tilt?: number; head?: number }> = ({
  x,
  y,
  look,
  s = 1,
  prone = false,
  flip = false,
  opacity = 1,
  arm = [8, 8],
  arm2 = [-4, 6],
  tilt = 0,
  head = 0,
}) => {
  const band = useBand();
  const k = s * band.k;
  const gy = y ?? band.gy(x);
  if (opacity <= 0.001) return null;
  const dir = prone ? -1 : 1;
  return (
    <g opacity={opacity} transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
      {y === undefined ? <ellipse cx={x} cy={gy} rx={96 * k} ry={6 * k} fill="rgba(0,0,0,0.3)" /> : null}
      <g transform={`translate(${x + dir * 87 * k} ${gy - 14 * k}) rotate(${prone ? 90 - tilt : -90 + tilt})`}>
        <Person x={0} y={0} s={s} look={look} pose={{ arm, arm2, head }} shadow={false} />
      </g>
    </g>
  );
};

// ── Cities, armies, sieges ───────────────────────────────────────────────────────────────

/**
 * A fortified hill city (Samaria, Jerusalem, Bethulia, Lachish): houses climbing a hill behind a massive crenellated wall
 * with towers and a gate, a citadel at the summit (or the temple with `temple`). Monumental scale (a man ≈ 40 units):
 * default w = 900, wall walk at -h (h = 130), tower tops at -(h + 44), summit about -2.1h. Defenders on the wall stand at
 * y = ridgeY(...) - h * s * K (Person s ≈ 0.23 * s).
 *  breach 0..1 breaks the wall open at local x = bx (rubble spills out); burn 0..1 sets roofs alight with smoke and
 *  brings the houses down; gate: local x of the gate (null for none), open 0..1; lit warms the windows.
 */
export const FortCity: React.FC<Base & { w?: number; h?: number; seed?: string; color?: string; lit?: number; burn?: number; breach?: number; bx?: number; gate?: number | null; open?: number; temple?: boolean; houses?: number }> = ({
  x,
  y,
  s = 1,
  w = 900,
  h = 130,
  seed = "fc",
  color = "#9A8466",
  lit = 0,
  burn = 0,
  breach = 0,
  bx,
  gate = 0,
  open = 0,
  temple = false,
  houses = 30,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const char = Math.min(1, burn * 1.2);
  const c = ink(mixHex(color, "#2A221E", char * 0.6));
  const earth = ink(mixHex("#6A5A44", "#2A221E", char * 0.4));
  const fall = Math.max(0, (burn - 0.5) / 0.5);
  const fire = Math.min(1, burn * 3) * (1 - 0.5 * Math.max(0, (burn - 0.85) / 0.15));
  const bX = bx ?? -w * 0.24;
  const gw = 70 + 90 * breach;
  const inBreach = (xx: number) => breach > 0 && Math.abs(xx - bX) < gw / 2;
  const top = (xx: number) => {
    if (!inBreach(xx)) return -h;
    const u = 1 - Math.abs(xx - bX) / (gw / 2);
    return -h + h * 0.82 * breach * Math.min(1, u * 1.6) + range(`${seed}bj${Math.round(xx / 8)}`, -6, 6) * breach;
  };
  const summit = h * 2.1;
  const hill = `M ${-w / 2 - 60} 0 Q ${-w * 0.3} ${-summit * 0.9} 0 ${-summit} Q ${w * 0.3} ${-summit * 0.9} ${w / 2 + 60} 0 Z`;
  const hs = Array.from({ length: houses }, (_, i) => {
    const hx = range(`${seed}x${i}`, -w / 2 + 30, w / 2 - 30);
    const u = hx / (w / 2);
    const base = -h * 0.5 - (1 - u * u) * (summit - h * 0.75) * range(`${seed}m${i}`, 0.75, 1);
    return { hx, base, hw: range(`${seed}w${i}`, 34, 64), hh: range(`${seed}h${i}`, 26, 58) * (1 - fall * 0.7 * random(`${seed}f${i}`)), sh: random(`${seed}c${i}`), wl: random(`${seed}l${i}`) };
  }).sort((a, b) => a.base - b.base);
  const winC = (a: number) => (lit > 0 || fire > 0 ? `rgba(255,${Math.round(190 - 60 * fire)},${Math.round(100 - 50 * fire)},${Math.min(1, 0.35 + 0.6 * Math.max(lit * a, fire))})` : tone(c, -0.55));
  const segs: string[] = [];
  for (let xx = -w / 2; xx <= w / 2; xx += 6) segs.push(`${xx === -w / 2 ? "M" : "L"} ${xx} ${top(xx).toFixed(1)}`);
  const wallPath = `${segs.join(" ")} L ${w / 2} 0 L ${-w / 2} 0 Z`;
  const towers = Array.from({ length: 7 }, (_, i) => -w / 2 + (i * w) / 6).filter((tx) => (gate === null || Math.abs(tx - gate) > 80) && !(breach > 0 && Math.abs(tx - bX) < gw / 2 + 30));
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.58} ry={12} fill="rgba(0,0,0,0.35)" />
      {fire > 0 ? <GlowS x={0} y={-summit * 0.6} r={w * 0.6} squash={0.6} color="255,130,50" opacity={0.6 * fire} /> : null}
      <path d={hill} fill={earth} stroke={rim(0.6)} strokeWidth={1.2} />
      {temple ? (
        <g transform={`translate(${-w * 0.1} ${-summit + 8})`}>
          <rect x={-104} y={-14} width={208} height={14} fill={tone(c, 0.02)} stroke={rim(0.8)} strokeWidth={1} />
          <rect x={-96} y={-62} width={192} height={48} fill={tone(c, 0.04)} stroke={rim(0.8)} strokeWidth={1.1} />
          <rect x={-62} y={-128} width={124} height={114} fill={tone(c, 0.14)} stroke={rim(0.9)} strokeWidth={1.2} />
          {[-44, -26, -8, 10, 28, 46].map((xx) => (
            <rect key={xx} x={xx - 2} y={-120} width={4} height={10} fill={winC(0.7)} />
          ))}
          <rect x={-40} y={-104} width={80} height={90} fill={tone(c, 0.2)} stroke={rim(1)} strokeWidth={1.2} />
          <rect x={-14} y={-76} width={28} height={62} fill={winC(1)} />
          <rect x={-30} y={-86} width={7} height={72} fill={ink(mixHex("#A8743A", "#2A221E", char * 0.6))} />
          <rect x={23} y={-86} width={7} height={72} fill={ink(mixHex("#A8743A", "#2A221E", char * 0.6))} />
        </g>
      ) : (
        <g transform={`translate(${w * 0.08} ${-summit + 10})`}>
          <rect x={-80} y={-70} width={160} height={70} fill={tone(c, 0.08)} stroke={rim(0.9)} strokeWidth={1.2} />
          <rect x={30} y={-112} width={40} height={112} fill={tone(c, 0.04)} stroke={rim(0.9)} strokeWidth={1.2} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={30 + i * 15} y={-120} width={9} height={8} fill={tone(c, 0.04)} />
          ))}
          {[-50, -20, 10].map((xx) => (
            <rect key={xx} x={xx} y={-50} width={10} height={14} fill={winC(0.8)} />
          ))}
        </g>
      )}
      {hs.map((q, i) => (
        <g key={i}>
          <rect x={q.hx - q.hw / 2} y={q.base - q.hh} width={q.hw} height={q.hh + 60} fill={mixHex(c, tone(c, -0.3), q.sh)} stroke={rim(0.5)} strokeWidth={1} />
          <rect x={q.hx - q.hw / 2 - 2} y={q.base - q.hh - 4} width={q.hw + 4} height={5} fill={tone(c, -0.2)} />
          <rect x={q.hx - 4} y={q.base - q.hh + 10} width={8} height={9} fill={winC(q.wl)} />
        </g>
      ))}
      <path d={wallPath} fill={tone(c, -0.08)} stroke={rim(0.9)} strokeWidth={1.4} />
      {Array.from({ length: Math.floor(h / 20) }, (_, k) => {
        const yy = -(k + 1) * 20;
        if (breach <= 0) return <line key={`co${k}`} x1={-w / 2} y1={yy} x2={w / 2} y2={yy} stroke={tone(c, -0.3)} strokeWidth={0.8} opacity={0.55} />;
        const gl = bX - gw / 2;
        const gr = bX + gw / 2;
        return (
          <g key={`co${k}`} stroke={tone(c, -0.3)} strokeWidth={0.8} opacity={0.55}>
            <line x1={-w / 2} y1={yy} x2={gl} y2={yy} />
            <line x1={gr} y1={yy} x2={w / 2} y2={yy} />
          </g>
        );
      })}
      {Array.from({ length: Math.floor(w / 18) }, (_, i) => {
        const mx = -w / 2 + i * 18 + 4;
        if (inBreach(mx) || inBreach(mx + 10)) return null;
        return <rect key={`m${i}`} x={mx} y={-h - 9} width={10} height={9} fill={tone(c, -0.08)} />;
      })}
      {towers.map((tx, i) => (
        <g key={`tw${i}`}>
          <rect x={tx - 28} y={-h - 44} width={56} height={h + 44} fill={tone(c, -0.02)} stroke={rim(0.9)} strokeWidth={1.3} />
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={tx - 28 + k * 15} y={-h - 54} width={11} height={10} fill={tone(c, -0.02)} />
          ))}
          <rect x={tx - 4} y={-h - 30} width={8} height={14} fill={winC(0.6)} />
        </g>
      ))}
      {gate !== null ? (
        <g transform={`translate(${gate} 0)`}>
          {[-1, 1].map((k) => (
            <g key={k}>
              <rect x={k * 56 - 32} y={-h - 60} width={64} height={h + 60} fill={c} stroke={rim(1)} strokeWidth={1.4} />
              {[0, 1, 2, 3].map((i) => (
                <rect key={i} x={k * 56 - 32 + i * 17} y={-h - 70} width={12} height={10} fill={c} />
              ))}
            </g>
          ))}
          <path d={`M -30 0 L -30 ${-h * 0.55} Q 0 ${-h * 0.82} 30 ${-h * 0.55} L 30 0 Z`} fill={lit > 0 ? `rgba(255,190,110,${0.3 + 0.5 * lit})` : tone(c, -0.65)} />
          {[-1, 1].map((k) => (
            <path key={k} d={`M ${k * 30} 0 L ${k * 30} ${-h * 0.55} Q ${k * 15} ${-h * 0.75} 0 ${-h * 0.8} L 0 0 Z`} fill={ink("#4A3220")} stroke={rim(0.6)} strokeWidth={1} transform={`translate(${k * 30} 0) scale(${1 - open * 0.85} 1) translate(${-k * 30} 0)`} />
          ))}
        </g>
      ) : null}
      {breach > 0
        ? Array.from({ length: 18 }, (_, i) => {
            const rx = bX + range(`${seed}rx${i}`, -gw * 0.75, gw * 0.75);
            const ry = -range(`${seed}ry${i}`, 4, 10 + 36 * breach * (1 - Math.abs(rx - bX) / gw));
            return <rect key={`r${i}`} x={rx - 9} y={ry - 7} width={range(`${seed}rw${i}`, 12, 22)} height={range(`${seed}rh${i}`, 8, 13)} fill={mixHex(c, tone(c, -0.3), random(`${seed}rc${i}`))} stroke={rim(0.5)} strokeWidth={0.8} transform={`rotate(${range(`${seed}rr${i}`, -30, 30)} ${rx} ${ry})`} opacity={Math.min(1, breach * 3)} />;
          })
        : null}
      {breach > 0.05 && breach < 0.95 ? <GlowS x={bX} y={-h * 0.5} r={gw * 1.4} squash={0.7} color="190,170,140" opacity={0.8 * Math.sin(Math.PI * breach)} /> : null}
      {fire > 0
        ? hs
            .filter((_, i) => i % 3 === 0)
            .map((q, i) => <g key={`fl${i}`}>{flames(f, `${seed}fl${i}`, q.hx, q.base - q.hh, q.hw * 0.9, 70, 3, fire * (0.5 + 0.5 * q.sh))}</g>)
        : null}
      {burn > 0 ? (
        <>
          <Smoke x={-w * 0.15} y={-summit * 0.8} s={2.4} n={12} life={180} rise={1.3} drift={0.4} color="58,50,46" opacity={0.6 * Math.min(1, burn * 2)} seed={`${seed}s1`} />
          <Smoke x={w * 0.2} y={-summit * 0.7} s={2.8} n={12} life={200} rise={1.1} drift={0.3} color="66,58,52" opacity={0.55 * Math.min(1, burn * 2)} seed={`${seed}s2`} />
        </>
      ) : null}
    </g>
  );
};

/**
 * An army as small silhouettes (monumental scale: `size` 40 = a man): ranks of spearmen with shields and helmets, archers
 * in the rear rank, standards. Cheaper than Person; use Person for anyone the story looks at. Faces right (flip: left).
 *  helm: "cone" (Assyrian), "round" (Babylonian, Aramean), "plume", "turban" (Persian), "none";
 *  p 0..1 reveals it from the leading edge; march 0..1 bobs the ranks and swings the legs; dx shifts the whole army along
 *  the ground (advance or retreat; it stays on the band's ground line); tint colours the tunics, metal the shields.
 */
export const Army: React.FC<{
  x0: number;
  x1: number;
  n?: number;
  rows?: number;
  seed?: string;
  tint?: string;
  metal?: string;
  helm?: "cone" | "round" | "plume" | "turban" | "none";
  shields?: boolean;
  spears?: boolean;
  bows?: boolean;
  banners?: number;
  p?: number;
  march?: number;
  dx?: number;
  flip?: boolean;
  size?: number;
}> = ({ x0, x1, n = 24, rows = 3, seed = "ar", tint = "#6A3A2A", metal = "#8A8478", helm = "cone", shields = true, spears = true, bows = true, banners = 1, p = 1, march = 0, dx = 0, flip = false, size = 40 }) => {
  const band = useBand();
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const k = band.k;
  const d = flip ? -1 : 1;
  if (p <= 0) return null;
  const body = ink(tint);
  const met = ink(metal);
  const skin = ink("#5A3E2C");
  const figs: React.ReactNode[] = [];
  for (let r = rows - 1; r >= 0; r--) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5 * (r % 2)) / n;
      const lead = flip ? 1 - t : t;
      if (lead > p) continue;
      const xx = x0 + (x1 - x0) * t + dx + range(`${seed}x${r}${i}`, -5, 5) * k;
      const H = range(`${seed}h${r}${i}`, 0.92, 1.06) * size * k;
      const ph = f * 0.28 + i * 1.7 + r;
      const yy = band.gy(xx) - r * 0.2 * size * k + (march > 0 ? -Math.abs(Math.sin(ph)) * 0.05 * H * march : 0);
      const c = mixHex(body, "#000000", r * 0.16);
      const sw = march > 0 ? Math.sin(ph) * 0.08 * H * march : 0;
      const archer = bows && r === rows - 1 && rows > 1;
      const hr = H * 0.1;
      const hx = xx + d * H * 0.02;
      const hy = yy - H * 0.83;
      figs.push(
        <g key={`${r}-${i}`}>
          <path d={`M ${xx - H * 0.06 - sw} ${yy} L ${xx - H * 0.02} ${yy - H * 0.3} M ${xx + H * 0.06 + sw} ${yy} L ${xx + H * 0.02} ${yy - H * 0.3}`} stroke={tone(skin, -0.2 - r * 0.1)} strokeWidth={H * 0.05} strokeLinecap="round" />
          <path d={`M ${xx - H * 0.15} ${yy - H * 0.27} L ${xx - H * 0.1} ${yy - H * 0.7} Q ${xx} ${yy - H * 0.76} ${xx + H * 0.1} ${yy - H * 0.7} L ${xx + H * 0.15} ${yy - H * 0.27} Z`} fill={c} stroke={rim(0.35)} strokeWidth={0.8} />
          <circle cx={hx} cy={hy} r={hr} fill={skin} />
          <path d={`M ${hx + d * hr * 0.6} ${hy + hr * 0.3} Q ${hx + d * hr * 0.9} ${hy + hr * 1.6} ${hx - d * hr * 0.2} ${hy + hr * 1.3} Z`} fill={ink("#1A120C")} />
          {helm === "cone" ? <path d={`M ${hx - hr * 1.12} ${hy - hr * 0.1} L ${hx + d * hr * 0.15} ${hy - hr * 2.1} L ${hx + hr * 1.12} ${hy - hr * 0.1} Z`} fill={met} /> : null}
          {helm === "round" ? <path d={`M ${hx - hr * 1.1} ${hy - hr * 0.05} Q ${hx} ${hy - hr * 1.9} ${hx + hr * 1.1} ${hy - hr * 0.05} Z`} fill={met} /> : null}
          {helm === "plume" ? <path d={`M ${hx - hr} ${hy - hr * 0.6} Q ${hx} ${hy - hr * 2.4} ${hx + hr} ${hy - hr * 0.6}`} stroke={ink("#C8B888")} strokeWidth={H * 0.05} fill="none" /> : null}
          {helm === "turban" ? <ellipse cx={hx} cy={hy - hr * 0.7} rx={hr * 1.2} ry={hr * 0.75} fill={ink("#D8CCB0")} /> : null}
          {archer ? (
            <path d={`M ${xx + d * H * 0.16} ${yy - H * 0.95} Q ${xx + d * H * 0.36} ${yy - H * 0.62} ${xx + d * H * 0.16} ${yy - H * 0.3}`} stroke={ink("#6A4A2A")} strokeWidth={H * 0.035} fill="none" />
          ) : spears && i % 2 === 0 ? (
            <g>
              <line x1={xx + d * H * 0.18} y1={yy - H * 0.15} x2={xx + d * H * 0.24} y2={yy - H * 1.5} stroke={ink("#6A5A4A")} strokeWidth={H * 0.03} />
              <path d={`M ${xx + d * H * 0.24} ${yy - H * 1.5} l ${-H * 0.025} ${H * 0.1} l ${H * 0.05} 0 Z`} fill={met} />
            </g>
          ) : null}
          {shields && r === 0 ? (
            <g>
              <circle cx={xx + d * H * 0.12} cy={yy - H * 0.47} r={H * 0.19} fill={tone(met, -0.15)} stroke={rim(0.6)} strokeWidth={0.9} />
              <circle cx={xx + d * H * 0.12} cy={yy - H * 0.47} r={H * 0.05} fill={tone(met, 0.3)} />
            </g>
          ) : null}
        </g>,
      );
    }
  }
  const flags = Array.from({ length: banners }, (_, i) => {
    const t = (i + 0.5) / banners;
    if ((flip ? 1 - t : t) > p) return null;
    const xx = x0 + (x1 - x0) * t + dx;
    const yy = band.gy(xx) - size * 0.4 * k;
    const s2 = size * k;
    return (
      <g key={`b${i}`}>
        <line x1={xx} y1={yy} x2={xx} y2={yy - s2 * 2.1} stroke={ink("#5A4A3A")} strokeWidth={s2 * 0.05} />
        <circle cx={xx} cy={yy - s2 * 2.2} r={s2 * 0.2} fill="none" stroke={ink("#C89A40")} strokeWidth={s2 * 0.06} />
        <circle cx={xx} cy={yy - s2 * 2.2} r={s2 * 0.08} fill={ink("#C89A40")} />
        <path d={`M ${xx - s2 * 0.18} ${yy - s2 * 1.96} L ${xx + s2 * 0.18} ${yy - s2 * 1.96}`} stroke={ink("#8A2A22")} strokeWidth={s2 * 0.06} />
      </g>
    );
  });
  return (
    <g>
      {figs}
      {flags}
    </g>
  );
};

/** An Assyrian siege engine: a wheeled, hide-covered battering ram with a turret, the ram swinging out with `ram` 0..1.
 *  Faces right. Monumental scale: 150 long, turret top at -112. `tilt` (degrees) sets it on a ramp. */
export const SiegeEngine: React.FC<Base & { ram?: number; tilt?: number }> = ({ x, y, s = 1, flip = false, ram = 0, tilt = 0 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const hide = ink("#7A6A50");
  const wood = ink("#5A3E26");
  const push = ram * 30;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s}) rotate(${-tilt})`}>
      <ellipse cx={0} cy={0} rx={84} ry={6} fill="rgba(0,0,0,0.35)" />
      <line x1={10 + push} y1={-36} x2={96 + push} y2={-40} stroke={wood} strokeWidth={7} strokeLinecap="round" />
      <path d={`M ${92 + push} -48 L ${112 + push} -40 L ${92 + push} -32 Z`} fill={ink("#6A6A70")} stroke={rim(0.8)} strokeWidth={1} />
      <path d="M -76 -16 L -70 -62 Q -10 -76 52 -62 L 64 -16 Z" fill={hide} stroke={rim(0.9)} strokeWidth={1.3} />
      {[-50, -24, 2, 28].map((xx) => (
        <line key={xx} x1={xx} y1={-66} x2={xx + 2} y2={-18} stroke={tone(hide, -0.25)} strokeWidth={1.2} />
      ))}
      <path d="M 20 -62 L 22 -104 Q 38 -116 54 -104 L 56 -62 Z" fill={tone(hide, 0.06)} stroke={rim(0.9)} strokeWidth={1.2} />
      <rect x={30} y={-98} width={14} height={10} fill="#0C0A08" />
      {[-52, -6, 40].map((xx) => (
        <g key={xx}>
          <circle cx={xx} cy={-14} r={14} fill={wood} stroke={rim(0.7)} strokeWidth={1.1} />
          <circle cx={xx} cy={-14} r={4} fill={tone(wood, 0.25)} />
        </g>
      ))}
    </g>
  );
};

/** A siege ramp of packed earth and timber against a wall: from the ground at local x = 0 up to the wall face at x = len,
 *  reaching `rise` (set it to the FortCity wall height times 0.8–0.9). `p` 0..1 builds it up. Monumental scale. */
export const SiegeRamp: React.FC<Base & { len?: number; rise?: number; p?: number; seed?: string }> = ({ x, y, s = 1, flip = false, len = 220, rise = 110, p = 1, seed = "sr" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  if (p <= 0) return null;
  const c = ink("#6E5A40");
  const r = rise * p;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <path d={`M ${-len * 0.1} 4 L ${len * 0.92} ${-r} L ${len} ${-r} L ${len} 4 Z`} fill={c} stroke={rim(0.8)} strokeWidth={1.2} />
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 1) / 8;
        const xx = lerp(-len * 0.1, len * 0.92, t);
        return <line key={i} x1={xx} y1={4 - (r + 4) * t} x2={xx + range(`${seed}${i}`, 10, 30)} y2={4} stroke={tone(c, -0.3)} strokeWidth={1.2} />;
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const t = (i + 0.5) / 5;
        const xx = lerp(0, len * 0.9, t);
        return <line key={`b${i}`} x1={xx - 14} y1={-(r + 4) * t * 0.98 + 4} x2={xx + 14} y2={-(r + 4) * (t + 0.06) + 4} stroke={ink("#4A3420")} strokeWidth={3} strokeLinecap="round" />;
      })}
    </g>
  );
};

/** A foreign capital's skyline for establishing shots. Monumental scale, default w = 1400, base at y = 0.
 *  "babylon": double walls, the blue Ishtar Gate with gold beasts, the great ziggurat (top at -350), terraced gardens;
 *  "nineveh": a long towered wall, the palace on its mound (top at -280), a smaller ziggurat;
 *  "susa": the acropolis mound with the columned apadana on top (top at -300), a low city wall;
 *  "ecbatana": a conical hill ringed by seven walls of seven colours, the palace at the top (-350).
 *  `lit` lights windows and torches for night. */
export const Skyline: React.FC<Base & { kind?: "babylon" | "nineveh" | "susa" | "ecbatana"; w?: number; lit?: number; seed?: string; palms?: boolean }> = ({
  x,
  y,
  s = 1,
  kind = "babylon",
  w = 1400,
  lit = 0,
  seed = "sky",
  palms = true,
}) => {
  const gy = useBase(x, y);
  const k = useBand().k;
  s = s * k;
  const ink = useInk();
  const rim = useRim();
  const brick = ink(kind === "nineveh" ? "#9A8A6A" : kind === "ecbatana" ? "#9A8E7A" : "#A88A62");
  const win = (a: number) => (lit > 0 ? `rgba(255,196,110,${(0.35 + 0.6 * lit * a).toFixed(3)})` : tone(brick, -0.5));
  const wallRun = (x0: number, x1: number, h: number, c: string, every: number, th: number, key: string, gapAt?: number, gapW = 0) => {
    const out: React.ReactNode[] = [];
    out.push(<rect key={`${key}w`} x={x0} y={-h} width={x1 - x0} height={h} fill={c} stroke={rim(0.7)} strokeWidth={1.2} />);
    for (let mx = x0; mx < x1 - 8; mx += 14) {
      if (gapAt !== undefined && Math.abs(mx - gapAt) < gapW / 2) continue;
      out.push(<rect key={`${key}m${mx}`} x={mx + 3} y={-h - 7} width={8} height={7} fill={c} />);
    }
    for (let tx = x0 + every / 2; tx < x1; tx += every) {
      if (gapAt !== undefined && Math.abs(tx - gapAt) < gapW / 2 + 20) continue;
      out.push(
        <g key={`${key}t${tx}`}>
          <rect x={tx - 13} y={-th} width={26} height={th} fill={tone(c, 0.05)} stroke={rim(0.7)} strokeWidth={1} />
          <rect x={tx - 13} y={-th - 7} width={7} height={7} fill={tone(c, 0.05)} />
          <rect x={tx + 6} y={-th - 7} width={7} height={7} fill={tone(c, 0.05)} />
          <rect x={tx - 2.5} y={-th + 10} width={5} height={8} fill={win(random(`${seed}${key}${tx}`))} />
        </g>,
      );
    }
    return out;
  };
  const zig = (zx: number, tiers: number, w0: number, th: number, c: string, shrine: string, key: string) => (
    <g key={key}>
      {Array.from({ length: tiers }, (_, i) => {
        const tw = w0 * (1 - i / (tiers + 1.6));
        return <rect key={i} x={zx - tw / 2} y={-(i + 1) * th} width={tw} height={th} fill={mixHex(c, tone(c, -0.22), i % 2 ? 0.5 : 0)} stroke={rim(0.8)} strokeWidth={1.2} />;
      })}
      <path d={`M ${zx - w0 * 0.07} 0 L ${zx - w0 * 0.03} ${-tiers * th}`} stroke={tone(c, 0.18)} strokeWidth={w0 * 0.05} opacity={0.6} />
      <rect x={zx - w0 * 0.09} y={-tiers * th - th * 0.85} width={w0 * 0.18} height={th * 0.85} fill={ink(shrine)} stroke={rim(0.9)} strokeWidth={1.2} />
      <rect x={zx - 5} y={-tiers * th - th * 0.6} width={10} height={th * 0.6} fill={win(1)} />
    </g>
  );
  const clutter = (x0: number, x1: number, y0: number, y1: number, n: number, key: string) =>
    Array.from({ length: n }, (_, i) => {
      const hx = range(`${seed}${key}x${i}`, x0, x1);
      const hb = -range(`${seed}${key}b${i}`, y0, y1);
      const hh = range(`${seed}${key}h${i}`, 22, 46);
      const hw = range(`${seed}${key}w${i}`, 26, 52);
      return (
        <g key={`${key}${i}`}>
          <rect x={hx - hw / 2} y={hb - hh} width={hw} height={hh + 30} fill={mixHex(brick, tone(brick, -0.28), random(`${seed}${key}c${i}`))} stroke={rim(0.4)} strokeWidth={0.8} />
          <rect x={hx - 3} y={hb - hh + 8} width={6} height={7} fill={win(random(`${seed}${key}l${i}`))} />
        </g>
      );
    });
  const palmRow = (xs: number[], key: string) =>
    palms ? (
      <NoScale>
        {xs.map((px, i) => (
          <Palm key={`${key}${i}`} x={px} y={0} s={range(`${seed}${key}s${i}`, 0.75, 1.05)} lean={range(`${seed}${key}l${i}`, -0.35, 0.35)} seed={`${seed}${key}${i}`} />
        ))}
      </NoScale>
    ) : null;
  let body: React.ReactNode = null;
  if (kind === "babylon") {
    const gx = -w * 0.12;
    const blue = ink("#2A4E8E");
    body = (
      <>
        <g transform={`translate(${-w * 0.31} 0)`}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={-150 + i * 26} y={-(i + 1) * 46 - 60} width={300 - i * 52} height={46} fill={tone(brick, -0.08 * (i % 2))} stroke={rim(0.7)} strokeWidth={1} />
              {Array.from({ length: 6 - i }, (_, j) => (
                <ellipse key={j} cx={-130 + i * 26 + j * ((260 - i * 52) / Math.max(1, 5 - i))} cy={-(i + 1) * 46 - 64} rx={20} ry={13} fill={ink("#3E5A2E")} />
              ))}
            </g>
          ))}
        </g>
        {zig(w * 0.2, 7, 360, 44, "#B09068", "#2A4E8E", "z")}
        {clutter(-w / 2 + 40, w / 2 - 40, 50, 120, 46, "c")}
        <g transform="translate(0 -60)">{wallRun(-w / 2, w / 2, 96, tone(brick, -0.05), 76, 122, "iw")}</g>
        {wallRun(-w / 2, w / 2, 64, brick, 92, 84, "ow", gx, 150)}
        <g transform={`translate(${gx} 0)`}>
          {[-1, 1].map((d) => (
            <g key={d}>
              <rect x={d * 52 - 30} y={-176} width={60} height={176} fill={blue} stroke={rim(1)} strokeWidth={1.3} />
              {[0, 1, 2, 3].map((i) => (
                <rect key={i} x={d * 52 - 30 + i * 16} y={-186} width={11} height={10} fill={blue} />
              ))}
            </g>
          ))}
          <rect x={-24} y={-150} width={48} height={150} fill={blue} stroke={rim(1)} strokeWidth={1.3} />
          <path d="M -18 0 L -18 -82 Q 0 -104 18 -82 L 18 0 Z" fill={lit > 0 ? `rgba(255,190,110,${0.3 + 0.5 * lit})` : "#0C0A10"} />
          {[-150, -118, -86, -54].map((ry, r) =>
            [-1, 1].map((d) =>
              [0, 1].map((j) => (
                <path key={`${r}${d}${j}`} d={`M ${d * 52 - 20 + j * 22} ${ry} l 4 -6 l 8 0 l 4 6 l -2 6 l -12 0 Z`} fill={ink(r % 2 ? "#E8C060" : "#E8DCC0")} opacity={0.9} />
              )),
            ),
          )}
          <path d="M -24 -150 L 24 -150" stroke={ink("#E8C060")} strokeWidth={2} />
        </g>
        {palmRow([-w * 0.46, -w * 0.4, -w * 0.25, -w * 0.02, w * 0.08, w * 0.34, w * 0.43], "p")}
      </>
    );
  } else if (kind === "nineveh") {
    body = (
      <>
        <g transform={`translate(${-w * 0.16} 0)`}>
          <path d="M -260 0 L -210 -150 L 210 -150 L 260 0 Z" fill={ink("#7A6A50")} stroke={rim(0.7)} strokeWidth={1.2} />
          <rect x={-170} y={-260} width={340} height={110} fill={tone(brick, 0.08)} stroke={rim(0.9)} strokeWidth={1.3} />
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={-170 + i * 15.5} y={-270} width={9} height={10} fill={tone(brick, 0.08)} />
          ))}
          <rect x={-80} y={-290} width={160} height={30} fill={tone(brick, 0.12)} stroke={rim(0.8)} strokeWidth={1} />
          {[-120, -60, 0, 60, 120].map((xx) => (
            <rect key={xx} x={xx - 6} y={-236} width={12} height={20} fill={win(0.9)} />
          ))}
          <path d="M -26 -150 L -26 -200 Q 0 -222 26 -200 L 26 -150 Z" fill={lit > 0 ? `rgba(255,190,110,${0.3 + 0.5 * lit})` : "#0E0A08"} />
          {[-1, 1].map((d) => (
            <path key={d} d={`M ${d * 30} -150 L ${d * 30} -184 L ${d * 52} -192 L ${d * 56} -150 Z`} fill={tone(brick, 0.2)} stroke={rim(0.7)} strokeWidth={0.9} />
          ))}
        </g>
        {zig(w * 0.24, 5, 230, 40, "#A08A66", "#5A6A8A", "z")}
        {clutter(-w / 2 + 40, w / 2 - 40, 30, 90, 40, "c")}
        {wallRun(-w / 2, w / 2, 104, brick, 58, 136, "w")}
        {[-w * 0.36, w * 0.06, w * 0.38].map((gx) => (
          <path key={gx} d={`M ${gx - 22} 0 L ${gx - 22} -60 Q ${gx} -80 ${gx + 22} -60 L ${gx + 22} 0 Z`} fill={lit > 0 ? `rgba(255,190,110,${0.3 + 0.5 * lit})` : "#0C0A08"} />
        ))}
        {palmRow([-w * 0.47, -w * 0.3, w * 0.12, w * 0.3, w * 0.45], "p")}
      </>
    );
  } else if (kind === "susa") {
    body = (
      <>
        {clutter(-w / 2 + 40, w / 2 - 40, 20, 60, 34, "c")}
        <g transform={`translate(${w * 0.05} 0)`}>
          <path d="M -330 0 L -240 -150 L 240 -150 L 330 0 Z" fill={ink("#7A6A52")} stroke={rim(0.7)} strokeWidth={1.2} />
          <rect x={-200} y={-170} width={400} height={20} fill={tone(brick, 0.12)} stroke={rim(0.9)} strokeWidth={1.2} />
          {Array.from({ length: 11 }, (_, i) => (
            <g key={i}>
              <rect x={-180 + i * 36 - 5} y={-276} width={10} height={106} fill={tone(brick, 0.18)} stroke={rim(0.6)} strokeWidth={0.8} />
              <rect x={-180 + i * 36 - 11} y={-286} width={22} height={10} fill={tone(brick, 0.25)} />
            </g>
          ))}
          <rect x={-196} y={-300} width={392} height={16} fill={tone(brick, 0.1)} stroke={rim(0.9)} strokeWidth={1.2} />
          {Array.from({ length: 20 }, (_, i) => (
            <path key={`s${i}`} d={`M ${-194 + i * 19.5} -300 l 0 -6 l 4 0 l 0 -4 l 4 0 l 0 -4 l 4 0 l 0 14 Z`} fill={tone(brick, 0.1)} />
          ))}
          <rect x={-170} y={-270} width={340} height={96} fill={`rgba(20,14,10,${0.55 - 0.3 * lit})`} />
          {lit > 0 ? <rect x={-170} y={-270} width={340} height={96} fill={`rgba(255,180,90,${0.25 * lit})`} /> : null}
        </g>
        {wallRun(-w / 2, w / 2, 70, brick, 100, 92, "w")}
        {palmRow([-w * 0.45, -w * 0.33, -w * 0.18, w * 0.34, w * 0.44], "p")}
      </>
    );
  } else {
    const cols = ["#E8E4DC", "#2A2A2E", "#5A2A6A", "#2A4A8A", "#C8702A", "#B8BCC4", "#D8A840"];
    body = (
      <>
        <path d={`M ${-w * 0.42} 0 Q ${-w * 0.2} -250 0 -300 Q ${w * 0.2} -250 ${w * 0.42} 0 Z`} fill={ink("#6A5E4A")} stroke={rim(0.6)} strokeWidth={1.2} />
        {cols.map((col, i) => {
          const rw = w * 0.72 * (1 - i * 0.13);
          const by = -i * 40;
          const c = ink(col);
          return (
            <g key={i}>
              {clutter(-rw / 2 + 20, rw / 2 - 20, -by + 10, -by + 34, 8 - i, `r${i}`)}
              <rect x={-rw / 2} y={by - 34} width={rw} height={34} fill={c} stroke={rim(0.8)} strokeWidth={1.1} />
              {Array.from({ length: Math.floor(rw / 14) }, (_, j) => (
                <rect key={j} x={-rw / 2 + j * 14 + 3} y={by - 41} width={8} height={7} fill={c} />
              ))}
              {[-1, 1].map((d) => (
                <rect key={d} x={d * (rw / 2) - 11} y={by - 50} width={22} height={50} fill={tone(c, 0.06)} stroke={rim(0.8)} strokeWidth={1} />
              ))}
            </g>
          );
        })}
        <rect x={-60} y={-330} width={120} height={52} fill={ink("#D8A840")} stroke={rim(1)} strokeWidth={1.2} />
        <rect x={-20} y={-352} width={40} height={22} fill={ink("#E0B450")} stroke={rim(1)} strokeWidth={1} />
        {[-36, -12, 12, 36].map((xx) => (
          <rect key={xx} x={xx - 4} y={-318} width={8} height={14} fill={win(1)} />
        ))}
        {palmRow([-w * 0.46, w * 0.45], "p")}
      </>
    );
  }
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.55} ry={10} fill="rgba(0,0,0,0.3)" />
      {body}
      {lit > 0 ? <GlowS x={0} y={-120} r={w * 0.5} squash={0.35} color="255,170,80" opacity={0.3 * lit} /> : null}
    </g>
  );
};

// ── Ruins and rebuilding ─────────────────────────────────────────────────────────────────

/** A ruined city wall (Jerusalem after 586 BC, Nehemiah's night survey): broken wall stubs with jagged tops, fallen ashlar
 *  blocks, charred beams; `char` 0..1 adds glowing embers, `smoke` 0..1 thin smoke. Person scale; default w = 640, the
 *  tallest stub reaches -h (h = 170). */
export const Ruins: React.FC<Base & { w?: number; h?: number; seed?: string; char?: number; smoke?: number; color?: string }> = ({ x, y, s = 1, flip = false, w = 640, h = 170, seed = "ru", char = 0, smoke = 0, color = "#9A8A70" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const c = ink(mixHex(color, "#3A322A", 0.25));
  const n = Math.max(3, Math.round(w / 140));
  const stubs = Array.from({ length: n }, (_, i) => {
    const cx = -w / 2 + (w * (i + 0.5)) / n + range(`${seed}x${i}`, -20, 20);
    const sw = range(`${seed}w${i}`, 60, 120);
    const sh = h * range(`${seed}h${i}`, 0.35, 1);
    const pts: Pt[] = [[cx - sw / 2, 0], [cx - sw / 2, -sh * range(`${seed}a${i}`, 0.5, 0.9)]];
    for (let j = 1; j < 6; j++) pts.push([cx - sw / 2 + (sw * j) / 6, -sh * range(`${seed}j${i}${j}`, 0.55, 1)]);
    pts.push([cx + sw / 2, -sh * range(`${seed}b${i}`, 0.3, 0.8)], [cx + sw / 2, 0]);
    return { cx, sw, sh, pts };
  });
  const blocks = Array.from({ length: Math.round(w / 26) }, (_, i) => {
    const bx = range(`${seed}bx${i}`, -w / 2 - 30, w / 2 + 30);
    return { bx, by: -range(`${seed}by${i}`, 6, 20), bw: range(`${seed}bw${i}`, 22, 40), bh: range(`${seed}bh${i}`, 14, 22), r: range(`${seed}br${i}`, -35, 35), t: random(`${seed}bc${i}`) };
  }).sort((a, b) => a.by - b.by);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={9} fill="rgba(0,0,0,0.35)" />
      {stubs.map((q, i) => (
        <g key={i}>
          <path d={poly(q.pts)} fill={mixHex(c, tone(c, -0.2), random(`${seed}c${i}`))} stroke={rim(0.85)} strokeWidth={1.3} strokeLinejoin="round" />
          {Array.from({ length: Math.floor(q.sh / 22) }, (_, r) => (
            <line key={r} x1={q.cx - q.sw / 2} y1={-(r + 1) * 22} x2={q.cx + q.sw / 2} y2={-(r + 1) * 22} stroke={tone(c, -0.3)} strokeWidth={0.9} opacity={0.6} />
          ))}
          {Array.from({ length: Math.floor(q.sh / 22) }, (_, r) => (
            <line key={`v${r}`} x1={q.cx - q.sw / 2 + ((r % 2) + 1) * (q.sw / 3)} y1={-(r + 1) * 22} x2={q.cx - q.sw / 2 + ((r % 2) + 1) * (q.sw / 3)} y2={-r * 22} stroke={tone(c, -0.3)} strokeWidth={0.9} opacity={0.5} />
          ))}
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => {
        const bx = range(`${seed}tx${i}`, -w * 0.45, w * 0.45);
        const L = range(`${seed}tl${i}`, 90, 150);
        const a = range(`${seed}ta${i}`, -28, 28);
        const ey = mod(f * 0.05 + i, 1);
        return (
          <g key={`bm${i}`} transform={`rotate(${a} ${bx} -6)`}>
            <rect x={bx - L / 2} y={-14} width={L} height={9} rx={2} fill={ink("#2A1E16")} stroke={rim(0.4)} strokeWidth={0.8} />
            {char > 0 ? <circle cx={bx + L / 2 - 4} cy={-10} r={3 + ey} fill={`rgba(255,${120 + 60 * ey},40,${0.8 * char})`} /> : null}
          </g>
        );
      })}
      {blocks.map((b, i) => (
        <rect key={`k${i}`} x={b.bx - b.bw / 2} y={b.by - b.bh / 2} width={b.bw} height={b.bh} rx={2} fill={mixHex(c, tone(c, -0.25), b.t)} stroke={rim(0.6)} strokeWidth={0.9} transform={`rotate(${b.r} ${b.bx} ${b.by})`} />
      ))}
      {char > 0
        ? Array.from({ length: 10 }, (_, i) => (
            <circle key={`e${i}`} cx={range(`${seed}ex${i}`, -w / 2, w / 2)} cy={-range(`${seed}ey${i}`, 2, 14)} r={2} fill={`rgba(255,${130 + 80 * Math.sin(f * 0.2 + i)},50,${0.7 * char})`} />
          ))
        : null}
      {char > 0 ? <GlowS x={0} y={-10} r={w * 0.5} squash={0.15} color="255,110,40" opacity={0.35 * char} /> : null}
      {smoke > 0 ? (
        <>
          <Smoke x={-w * 0.2} y={-10} s={1.2} n={8} life={160} rise={0.9} drift={0.3} color="90,84,80" opacity={0.4 * smoke} seed={`${seed}s1`} />
          <Smoke x={w * 0.25} y={-10} s={1} n={8} life={150} rise={0.8} drift={0.25} color="90,84,80" opacity={0.35 * smoke} seed={`${seed}s2`} />
        </>
      ) : null}
    </g>
  );
};

/**
 * A city wall being rebuilt (Nehemiah 3–6): ashlar courses rising unevenly as `built` goes 0..1, the old foundation
 * courses darker, gaps where the work lags, scaffolding while unfinished, and an optional gate opening at local x = gate
 * (doors 0..1 hangs its doors once the wall is high). Person scale; default w = 700, finished wall walk at -h (h = 200);
 * while building, each 70-wide strip stands between -h * (1.3 built - 0.3) and -h * 1.3 built (clamped).
 */
export const BuildWall: React.FC<Base & { w?: number; h?: number; built?: number; seed?: string; gate?: number | null; gateW?: number; doors?: number; color?: string; scaffold?: boolean }> = ({
  x,
  y,
  s = 1,
  flip = false,
  w = 700,
  h = 200,
  built = 1,
  seed = "bw",
  gate = null,
  gateW = 96,
  doors = 0,
  color = "#A8987A",
  scaffold = true,
}) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const c = ink(color);
  const rowH = 22;
  const rows = Math.round(h / rowH);
  const nStrip = Math.max(2, Math.round(w / 70));
  const stripW = w / nStrip;
  const level = (j: number) => Math.round(rows * Math.max(0, Math.min(1, built * 1.3 - 0.3 * random(`${seed}u${j}`))));
  const inGate = (xx: number, ww: number) => gate !== null && xx + ww > gate - gateW / 2 && xx < gate + gateW / 2;
  const blocks: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    let xx = -w / 2 + (r % 2 ? -12 : 0);
    let i = 0;
    while (xx < w / 2) {
      const bw = range(`${seed}${r}w${i}`, 40, 66);
      const x0 = Math.max(-w / 2, xx);
      const x1 = Math.min(w / 2, xx + bw);
      const j = Math.min(nStrip - 1, Math.floor((x0 + x1 + w) / 2 / stripW));
      const old = r < 2;
      if (x1 - x0 > 4 && (old || r < level(j)) && !inGate(x0, x1 - x0)) {
        blocks.push(
          <rect key={`${r}-${i}`} x={x0 + 1} y={-(r + 1) * rowH + 1} width={x1 - x0 - 2} height={rowH - 2} rx={2} fill={old ? tone(c, -0.3) : mixHex(c, tone(c, 0.12), random(`${seed}${r}c${i}`))} stroke={rim(0.55)} strokeWidth={0.8} />,
        );
      }
      xx += bw;
      i++;
    }
  }
  const tall = gate !== null ? Math.min(level(Math.min(nStrip - 1, Math.floor((gate - gateW / 2 + w / 2) / stripW))), level(Math.min(nStrip - 1, Math.floor((gate + gateW / 2 + w / 2) / stripW)))) : 0;
  const gateH = Math.min(tall * rowH, h);
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={0} cy={0} rx={w * 0.58} ry={9} fill="rgba(0,0,0,0.35)" />
      {blocks}
      {gate !== null && gateH > rowH * 6 ? (
        <g>
          <rect x={gate - gateW / 2 - 6} y={-gateH} width={12} height={gateH} fill={tone(c, -0.1)} stroke={rim(0.7)} strokeWidth={1} />
          <rect x={gate + gateW / 2 - 6} y={-gateH} width={12} height={gateH} fill={tone(c, -0.1)} stroke={rim(0.7)} strokeWidth={1} />
          {gateH > rowH * 8 ? <rect x={gate - gateW / 2 - 8} y={-rowH * 8 - 14} width={gateW + 16} height={14} fill={ink("#5A3E26")} stroke={rim(0.8)} strokeWidth={1} /> : null}
          {doors > 0
            ? [-1, 1].map((k) => (
                <rect key={k} x={k < 0 ? gate - gateW / 2 + 6 : gate} y={-rowH * 8} width={gateW / 2 - 6} height={rowH * 8} fill={ink("#5A3E26")} stroke={rim(0.7)} strokeWidth={1} opacity={doors} />
              ))
            : null}
        </g>
      ) : null}
      {scaffold && built < 1
        ? Array.from({ length: nStrip }, (_, j) => {
            const lv = level(j);
            if (lv >= rows || j % 2 === 1) return null;
            const sx = -w / 2 + (j + 0.5) * stripW;
            if (inGate(sx - 20, 40)) return null;
            const topY = -(Math.max(lv, 2) * rowH + 50);
            return (
              <g key={`sc${j}`} stroke={ink("#7A5A36")} strokeWidth={2.6}>
                <line x1={sx - 24} y1={6} x2={sx - 24} y2={topY} />
                <line x1={sx + 24} y1={6} x2={sx + 24} y2={topY} />
                <line x1={sx - 32} y1={-Math.max(lv, 2) * rowH + 4} x2={sx + 32} y2={-Math.max(lv, 2) * rowH + 4} strokeWidth={4} />
                <line x1={sx - 24} y1={-4} x2={sx + 24} y2={topY + 30} strokeWidth={1.6} />
              </g>
            );
          })
        : null}
    </g>
  );
};

/** A tall bare pole on a stepped platform (the gallows Haman built, Esther 5:14; drawn with restraint, no rope).
 *  Person scale; pole top at -h (h = 460), platform top at -36. */
export const Pole: React.FC<Base & { h?: number }> = ({ x, y, s = 1, h = 460 }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const wood = ink("#4A3424");
  return (
    <g transform={`translate(${x} ${gy}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={110} ry={7} fill="rgba(0,0,0,0.35)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={-90 + i * 18} y={-12 - i * 12} width={180 - i * 36} height={12} fill={ink(i % 2 ? "#6A5E50" : "#7A6E5E")} stroke={rim(0.7)} strokeWidth={1} />
      ))}
      <rect x={-8} y={-h} width={16} height={h - 36} fill={wood} stroke={rim(0.9)} strokeWidth={1.2} />
      <rect x={-8} y={-h} width={5} height={h - 36} fill={tone(wood, 0.2)} opacity={0.6} />
      <rect x={-12} y={-h - 6} width={24} height={8} rx={2} fill={tone(wood, -0.2)} />
    </g>
  );
};

/** A small iron axe head, sinking or floating up (2 Kings 6:5–7). Plain SVG units at (x, y); `rot` in degrees. */
export const AxeHead: React.FC<{ x: number; y: number; s?: number; rot?: number; glow?: number }> = ({ x, y, s = 1, rot = 0, glow = 0 }) => {
  const ink = useInk();
  const rim = useRim();
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {glow > 0 ? <GlowS x={0} y={0} r={40} color="255,236,190" opacity={0.6 * glow} /> : null}
      <path d="M -10 -7 L 4 -7 L 8 -2 L 16 -10 Q 20 0 16 10 L 8 2 L 4 7 L -10 7 Z" fill={ink("#5A5A60")} stroke={rim(0.9)} strokeWidth={1} />
      <path d="M 16 -10 Q 20 0 16 10" stroke="#C8CCD4" strokeWidth={1.4} fill="none" />
      <ellipse cx={-3} cy={0} rx={3} ry={4} fill="#0C0A08" />
    </g>
  );
};

// ── Wonders ──────────────────────────────────────────────────────────────────────────────

/** A large river fish (Tobit 6:2) facing right, 130 long at s = 1 (Person scale). With `leap` 0..1 it leaps from the
 *  water at the anchor (y = the water surface), arcs `height` up and lands `dist` ahead, splashing at both ends; the part
 *  below the surface is hidden. Without `leap` it is drawn still, rotated by `rot` (on the bank, or carried). */
export const Fish: React.FC<Base & { leap?: number; dist?: number; height?: number; rot?: number; len?: number; color?: string }> = ({ x, y, s = 1, flip = false, leap, dist = 220, height = 150, rot = 0, len = 130, color = "#6A7468" }) => {
  const gy = useBase(x, y);
  s = s * useBand().k;
  const ink = useInk();
  const rim = useRim();
  const f = useCurrentFrame();
  const clip = useUid("fsh");
  const c = ink(color);
  const belly = ink(mixHex(color, "#E8E0C8", 0.55));
  const L = len / 2;
  const fish = (
    <g>
      <path d={`M ${-L * 0.92} 0 L ${-L * 1.36} ${-L * 0.36} Q ${-L * 1.22} 0 ${-L * 1.36} ${L * 0.36} Z`} fill={tone(c, -0.15)} stroke={rim(0.8)} strokeWidth={1} />
      <path d={`M ${-L * 0.2} ${-L * 0.3} Q ${L * 0.05} ${-L * 0.56} ${L * 0.3} ${-L * 0.3} Z`} fill={tone(c, -0.15)} />
      <path d={`M ${-L} 0 Q ${-L * 0.6} ${-L * 0.36} ${L * 0.15} ${-L * 0.32} Q ${L * 0.75} ${-L * 0.26} ${L} 0 Q ${L * 0.75} ${L * 0.24} ${L * 0.15} ${L * 0.28} Q ${-L * 0.6} ${L * 0.3} ${-L} 0 Z`} fill={c} stroke={rim(1)} strokeWidth={1.3} />
      <path d={`M ${-L * 0.8} ${L * 0.08} Q ${0} ${L * 0.3} ${L * 0.8} ${L * 0.06} Q ${0} ${L * 0.2} ${-L * 0.8} ${L * 0.08} Z`} fill={belly} opacity={0.85} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M ${-L * 0.55 + i * L * 0.2} ${-L * 0.2} q ${L * 0.08} ${L * 0.12} 0 ${L * 0.26}`} stroke={tone(c, 0.18)} strokeWidth={1} fill="none" opacity={0.6} />
      ))}
      <path d={`M ${L * 0.52} ${-L * 0.2} Q ${L * 0.42} 0 ${L * 0.52} ${L * 0.18}`} stroke={tone(c, -0.35)} strokeWidth={1.4} fill="none" />
      <path d={`M ${L * 0.25} ${L * 0.12} L ${L * 0.02} ${L * 0.36} L ${L * 0.36} ${L * 0.2} Z`} fill={tone(c, -0.1)} />
      <circle cx={L * 0.7} cy={-L * 0.08} r={L * 0.07} fill="#E8E4D8" />
      <circle cx={L * 0.72} cy={-L * 0.08} r={L * 0.035} fill="#0C0A08" />
      <path d={`M ${L} 0 Q ${L * 0.9} ${L * 0.06} ${L * 0.82} ${L * 0.04}`} stroke={tone(c, -0.4)} strokeWidth={1.2} fill="none" />
    </g>
  );
  if (leap === undefined)
    return (
      <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
        <g transform={`rotate(${rot})`}>{fish}</g>
      </g>
    );
  const t = Math.min(1, Math.max(0, leap));
  const fx = dist * t;
  const fy = -height * Math.sin(Math.PI * t);
  const ang = (Math.atan2(-height * Math.PI * Math.cos(Math.PI * t), dist) * 180) / Math.PI;
  const splash = (sx: number, a: number, key: string) =>
    a > 0.01 ? (
      <g key={key}>
        {Array.from({ length: 9 }, (_, i) => {
          const u = (i / 8 - 0.5) * 2;
          const hh = (1 - Math.abs(u) * 0.6) * 46 * a;
          return <circle key={i} cx={sx + u * 34 * (1.2 - a * 0.4)} cy={-hh} r={2.6} fill="rgba(220,236,250,0.9)" opacity={a} />;
        })}
        <ellipse cx={sx} cy={2} rx={40 + 30 * (1 - a)} ry={6} fill="none" stroke="rgba(220,236,250,0.7)" strokeWidth={1.6} opacity={a} />
      </g>
    ) : null;
  return (
    <g transform={`translate(${x} ${gy}) scale(${flip ? -s : s} ${s})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={-L * 3} y={-height * 2 - len} width={dist + L * 6} height={height * 2 + len + 3} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(${fx.toFixed(1)} ${fy.toFixed(1)}) rotate(${ang.toFixed(1)})`}>{fish}</g>
      </g>
      {splash(0, t > 0 && t < 0.4 ? 1 - t / 0.4 : 0, "a")}
      {splash(dist, t > 0.82 ? Math.min(1, (t - 0.82) / 0.1) * (t < 1 ? 1 : Math.max(0, 1 - (f % 30) / 30)) : 0, "b")}
    </g>
  );
};

/** A whirlwind (2 Kings 2:11): a rising spiral funnel of light and dust from a base at (x, y), `h` tall and widening to
 *  `w` at the top. `p` 0..1 grows it. Works in a Band (band coordinates, unscaled) or loose in a scene's fx. */
export const Whirlwind: React.FC<{ x: number; y: number; h?: number; w?: number; p?: number; seed?: string; color?: string }> = ({ x, y, h = 700, w = 340, p = 1, seed = "ww", color = "255,240,214" }) => {
  const f = useCurrentFrame();
  if (p <= 0) return null;
  const H = h * Math.min(1, p * 1.3);
  const a = Math.min(1, p * 2);
  const width = (t: number) => lerp(30, w, Math.pow(t, 1.25));
  const cxAt = (t: number) => x + Math.sin(f * 0.05 + t * 4.2) * 22 * t;
  const rings = 22;
  return (
    <SvgIfLoose>
      <g style={{ mixBlendMode: "screen" }}>
        {Array.from({ length: 6 }, (_, i) => {
          const t = (i + 0.5) / 6;
          return <GlowS key={`g${i}`} x={cxAt(t)} y={y - H * t} r={width(t) * 0.8} squash={0.5} color={color} opacity={0.22 * a} />;
        })}
        {Array.from({ length: rings }, (_, i) => {
          const t = (i + 0.5) / rings;
          const ww = width(t) / 2;
          const cy = y - H * t;
          const cx = cxAt(t);
          const off = (f * (6 + 4 * t) + i * 37) % 100;
          return (
            <ellipse key={i} cx={cx} cy={cy} rx={ww} ry={ww * 0.18} fill="none" stroke={`rgba(${color},${(0.55 * a * (1 - t * 0.5)).toFixed(3)})`} strokeWidth={1.2 + 2.2 * (1 - t)} pathLength={100} strokeDasharray="38 12 22 28" strokeDashoffset={off} />
          );
        })}
        {Array.from({ length: 70 }, (_, i) => {
          const sp = range(`${seed}s${i}`, 0.004, 0.009);
          const t = mod(random(`${seed}t${i}`) + f * sp, 1);
          const ang = f * range(`${seed}a${i}`, 0.12, 0.2) + i * 1.3;
          const ww = width(t) / 2;
          const px = cxAt(t) + Math.cos(ang) * ww;
          const py = y - H * t + Math.sin(ang) * ww * 0.18;
          const front = Math.sin(ang) > 0;
          return <circle key={`d${i}`} cx={px} cy={py} r={range(`${seed}r${i}`, 1, 3) * (front ? 1.2 : 0.8)} fill={i % 3 ? `rgba(${color},${(0.8 * a).toFixed(3)})` : `rgba(200,176,140,${(0.7 * a).toFixed(3)})`} opacity={front ? 1 : 0.5} />;
        })}
      </g>
    </SvgIfLoose>
  );
};

/** A chariot of fire drawn by two horses of fire (2 Kings 2:11), galloping right (flip: left). Person scale (horses 1.5×
 *  the kit's horse, heads at about -144; the car 60 tall, its floor at the anchor's y - 4; the team spans x -100..+250).
 *  `p` 0..1 makes it appear in a
 *  flare; `run` is the gallop phase (e.g. walkPhase(f, 2.2)); `lift` 0..1 raises it into the sky (up to 900 units, nose
 *  up) with a trail of fire behind. `rider` is drawn standing in the car (a Person at x = 0, y = 0). Works in a band or
 *  loose in fx with an explicit y. */
export const ChariotOfFire: React.FC<Base & { p?: number; run?: number; lift?: number; rider?: React.ReactNode; rise?: number }> = ({ x, y, s = 1, flip = false, p = 1, run, lift = 0, rider, rise = 900 }) => {
  const band = useBand();
  const gy = y ?? band.gy(x);
  const k = s * band.k;
  const f = useCurrentFrame();
  const id = useUid("cof");
  if (p <= 0) return null;
  const ph = run ?? f * 0.45;
  const hs = SPECS.horse;
  const a = Math.min(1, p * 1.5);
  const sc = 0.7 + 0.3 * Math.min(1, p * 1.2);
  const leg = (l: [number, number, number, number], i: number) => {
    const offs = [0, Math.PI * 0.8, Math.PI, Math.PI * 1.8];
    const q = ph + offs[i];
    const sw = Math.sin(q) * 36;
    const bend = Math.max(0, -Math.cos(q)) * 60;
    const kx = l[0] + Math.sin((sw * Math.PI) / 180) * l[2];
    const ky = l[1] + Math.cos((sw * Math.PI) / 180) * l[2];
    const an = ((sw - bend) * Math.PI) / 180;
    return `M ${l[0]} ${l[1]} L ${kx.toFixed(1)} ${ky.toFixed(1)} L ${(kx + Math.sin(an) * l[3]).toFixed(1)} ${(ky + Math.cos(an) * l[3]).toFixed(1)}`;
  };
  const tongue = (bx: number, by: number, len: number, ang: number, wd: number, i: number, fill: string) => {
    const fl = 0.75 + 0.25 * Math.sin(f * 0.7 + i * 1.9);
    const L = len * fl;
    const r = (ang * Math.PI) / 180;
    const ex = bx + Math.cos(r) * L;
    const ey = by + Math.sin(r) * L;
    const nx = -Math.sin(r) * wd;
    const ny = Math.cos(r) * wd;
    return <path key={`${i}${fill}`} d={`M ${bx + nx} ${by + ny} Q ${bx + Math.cos(r) * L * 0.5 + nx * 0.8 + Math.sin(f * 0.5 + i) * 3} ${by + Math.sin(r) * L * 0.5 + ny * 0.8} ${ex} ${ey} Q ${bx + Math.cos(r) * L * 0.5 - nx * 0.8} ${by + Math.sin(r) * L * 0.5 - ny * 0.8} ${bx - nx} ${by - ny} Z`} fill={fill} />;
  };
  const horse = (ox: number, oy: number, dim: number, key: string) => {
    const bob = -Math.abs(Math.sin(ph)) * 4;
    return (
      <g key={key} transform={`translate(${ox} ${oy + bob}) scale(1.5)`} opacity={1 - dim * 0.25}>
        {hs.legs.map((l, i) => (
          <path key={i} d={leg(l, i)} stroke={i < 2 ? "#E0501A" : "#FF9A3A"} strokeWidth={hs.legW + 1} strokeLinecap="round" fill="none" />
        ))}
        {[0, 1, 2, 3, 4].map((i) => tongue(-34, -60 + i * 3, 46 + i * 6, 196 + i * 6, 6, i, i % 2 ? "#FF7A22" : "#FFB43C"))}
        <path d={hs.body} fill={`url(#${id})`} stroke="rgba(255,240,190,0.9)" strokeWidth={1.2} />
        <path d={hs.head} fill={`url(#${id})`} stroke="rgba(255,240,190,0.9)" strokeWidth={1.2} />
        {Array.from({ length: 7 }, (_, i) => {
          const t = i / 6;
          return tongue(lerp(26, 46, t), lerp(-64, -92, t), 22 + 8 * Math.sin(i), 200 + t * 30, 4, i + 10, i % 2 ? "#FF8A2A" : "#FFD27A");
        })}
        {[0, 1, 2, 3].map((i) => tongue(lerp(-28, 26, i / 3), -44, 16, 150 + i * 8, 3, i + 20, "#FF9A3A"))}
      </g>
    );
  };
  return (
    <SvgIfLoose>
      <g transform={`translate(${x} ${gy - lift * rise * k}) scale(${(flip ? -k : k) * sc} ${k * sc}) rotate(${-14 * Math.min(1, lift * 2)})`} opacity={a}>
        <defs>
          <linearGradient id={id} x1="0" y1="-100" x2="0" y2="-20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFF4C8" />
            <stop offset="0.45" stopColor="#FFB040" />
            <stop offset="1" stopColor="#E8501A" />
          </linearGradient>
        </defs>
        <GlowS x={50} y={-70} r={320} squash={0.6} color="255,150,60" opacity={0.8 * a} />
        <GlowS x={60} y={-80} r={150} squash={0.7} color="255,230,170" opacity={0.6 * a} />
        {lift > 0
          ? Array.from({ length: 14 }, (_, i) => {
              const t = i / 13;
              const tx = -90 - t * 420;
              const ty = -30 + t * (lift * rise * 0.9 + 40);
              return <GlowS key={`tr${i}`} x={tx} y={ty} r={(70 - 40 * t) * (0.85 + 0.15 * Math.sin(f * 0.6 + i))} squash={0.6} color={i % 2 ? "255,170,70" : "255,120,40"} opacity={0.8 * (1 - t) * Math.min(1, lift * 4)} />;
            })
          : null}
        {horse(160, -10, 1, "h2")}
        <line x1={-36} y1={-34} x2={150} y2={-78} stroke="#FF9A3A" strokeWidth={4} />
        <circle cx={-62} cy={-28} r={28} fill="none" stroke="#FFB43C" strokeWidth={5} />
        {Array.from({ length: 8 }, (_, i) => {
          const an = (i / 8) * Math.PI * 2 + ph * 0.6;
          return <line key={`sp${i}`} x1={-62} y1={-28} x2={-62 + Math.cos(an) * 28} y2={-28 + Math.sin(an) * 28} stroke="#FFD27A" strokeWidth={2} />;
        })}
        <NoScale>
          <g transform="translate(-60 -4)">{rider}</g>
        </NoScale>
        <path d="M -98 -62 L -30 -62 L -24 -30 L -102 -30 Z" fill={`url(#${id})`} stroke="rgba(255,240,190,0.9)" strokeWidth={1.4} />
        {[0, 1, 2, 3, 4].map((i) => tongue(lerp(-96, -32, i / 4), -62, 34, -96 + (i - 2) * 6, 6, i + 30, i % 2 ? "#FF7A22" : "#FFC24A"))}
        {horse(100, 0, 0, "h1")}
        {Array.from({ length: 6 }, (_, i) => tongue(lerp(50, 150, i / 5), -2, 16, 200, 3, i + 40, "#FF8A2A"))}
      </g>
    </SvgIfLoose>
  );
};
