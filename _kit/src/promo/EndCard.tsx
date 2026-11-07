/**
 * <EndCard>: the reference's end card (videoclone.md 10.5), parametric. Frame 0 = the card's first frame (put it in
 * a Sequence). The tagline builds word by word while its block slides home, holds, then a HARD switch to the brand
 * mark, which grows (EASE.markGrow), rolls to -19 deg and back, shrinks to 54 % (EASE.markShrink) and slides left
 * with the wordmark (two segments) while the wordmark's words pop in 4 frames apart and the mark's features turn
 * once around it; an optional CTA line (or pill button) pops under the lockup. Sizes are the reference's at 1080
 * (x format unit); the tagline re-wraps and the lockup shrinks to fit 9:16. Once the lockup settles the card stays
 * alive by default (slow push, mark blinks, CTA breathing) so no frame freezes; `live={false}` = the still reference.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { blink, clamp, EASE, Ease, spr, SPRING } from "./ease";
import { family, font, FontRole, useFonts } from "./fonts";
import { centerSafe, useFormat } from "./format";
import { Accent, Headline, popTimes, wordOffset } from "./Headline";
import { MarkProps, OrbMark } from "./marks";

export type EndLive = { /** scale gained per second by the slow push (default 0.03) */ push?: number; /** CTA breathing amplitude (default 0.03) */ breathe?: number; /** frames between mark blinks (default 26; 0 = none) */ blink?: number };
export type EndCardProps = {
  tagline: string | string[];
  /** explicit tagline lines for 9:16 (default: the tagline re-wrapped to the frame) */
  taglineV?: string[];
  /** tagline words in another colour / gradient / font (as Headline's accent) */
  accent?: Accent;
  /** wordmark text; each word pops on its own */
  brand: string;
  /** the brand mark (default: an OrbMark in markColor) */
  mark?: (p: MarkProps) => React.ReactNode;
  markColor?: string;
  cta?: string;
  /** CTA font size in px at 1080 (default 44) */
  ctaSize?: number;
  /** draw the CTA as a filled capsule button that pops (scale spring) instead of grey text */
  ctaPill?: { fill: string; color?: string; size?: number; weight?: number; /** breathing scale amplitude once settled (0.02 = 2 %; default the live breathe) */ pulse?: number };
  bg?: string; ink?: string; sub?: string;
  role?: FontRole; weight?: number; size?: number;
  brandRole?: FontRole; brandWeight?: number; brandSize?: number;
  /** scale of the whole lockup (mark, wordmark, CTA); e.g. 1.3 to fill a 9:16 card (default 1, the reference) */
  lockup?: number;
  /** frames the finished tagline holds before the switch (reference: 40) */
  hold?: number;
  /** speed (1 = the reference; 1.3 = 30 % faster) */
  tempo?: number;
  /** gaps between word pops (reference rhythm by default: 2 2 2 ... 4 8) */
  stagger?: number[];
  /** the final hold stays alive (default true); false = a still lockup like the reference */
  live?: boolean | EndLive;
  style?: React.CSSProperties;
};

/** The reference's pop rhythm for n words: 2-frame gaps, then 4 and 8 onto the last word. */
export const taglineGaps = (n: number) => Array.from({ length: Math.max(0, n - 1) }, (_, i) => (i === n - 2 ? 8 : i === n - 3 ? 4 : 2));
const countWords = (t: string | string[]) => (Array.isArray(t) ? t.join(" ") : t).split(/\s+/).filter(Boolean).length;
const LIVE: Required<EndLive> = { push: 0.03, breathe: 0.03, blink: 26 };
const liveOf = (l: EndCardProps["live"]): Required<EndLive> | null => (l === false ? null : { ...LIVE, ...(typeof l === "object" ? l : {}) });

/**
 * Key frames of a card (card-local, real frames): built = tagline finished, switchAt = switch to the mark, still =
 * lockup settled, length = suggested Sequence length. holds = the still ranges to declare in qa.json, in film frames
 * when you pass the card's first film frame (`start`) and its real Sequence length (`duration`): the tagline hold,
 * plus the lockup hold when live={false} (a live hold is not frozen).
 */
export function endCardTiming(p: Pick<EndCardProps, "tagline" | "hold" | "tempo" | "stagger" | "live">, start = 0, duration?: number) {
  const k = p.tempo ?? 1, n = countWords(p.tagline);
  const pops = popTimes(n, p.stagger ?? taglineGaps(n));
  const built = Math.max(pops[pops.length - 1] + 15, 24);
  const switchAt = Math.round((built + (p.hold ?? 40)) / k);
  const still = switchAt + Math.ceil(66 / k);
  const length = still + 12, end = duration ?? length, builtAt = Math.min(switchAt, Math.ceil(built / k));
  const holds: [number, number][] = [];
  if (switchAt > builtAt) holds.push([start + builtAt, start + switchAt - 1]);
  if (p.live === false && end > still) holds.push([start + still, start + end - 1]);
  return { built: builtAt, switchAt, still, length, holds };
}

type S = { t: [number, number]; v: [number, number]; e: Ease };
const chainS = (f: number, segs: S[]) => {
  for (const s of segs) if (f < s.t[1]) return f <= s.t[0] ? s.v[0] : s.v[0] + (s.v[1] - s.v[0]) * s.e(clamp((f - s.t[0]) / (s.t[1] - s.t[0])));
  return segs[segs.length - 1].v[1];
};
// measured curves, in reference frames after the switch
const MARK_R: S[] = [{ t: [-0.256, 12.247], v: [0, 1], e: EASE.markGrow }, { t: [14.158, 32.776], v: [1, 0.54], e: EASE.markShrink }];
const SLIDE: S[] = [{ t: [14.054, 31.953], v: [1, 0.6828], e: EASE.lockupSlideIn }, { t: [31.953, 54.165], v: [0.6828, 0], e: EASE.lockupSlideOut }];
const ROLL: S[] = [{ t: [0.222, 17.016], v: [0, -19.008], e: EASE.rollOut }, { t: [17.016, 32.062], v: [-19.008, 0], e: EASE.rollBack }];
const TURN: S[] = [{ t: [20.563, 32.2], v: [0, 132.3], e: EASE.turnIn }, { t: [32.2, 65.581], v: [132.3, 360], e: EASE.turnOut }];

let mctx: CanvasRenderingContext2D | null = null;

export const EndCard: React.FC<EndCardProps> = (p) => {
  const frame = useCurrentFrame();
  const fmt = useFormat();
  const ok = useFonts();
  const k = p.tempo ?? 1;
  const { switchAt, still } = endCardTiming(p);
  const ink = p.ink ?? "#000000", bg = p.bg ?? "#ffffff";
  const n = countWords(p.tagline);
  const lines = fmt.portrait && p.taglineV ? p.taglineV : Array.isArray(p.tagline) && !fmt.portrait ? p.tagline : Array.isArray(p.tagline) ? p.tagline.join(" ") : p.tagline;
  if (!ok) return <AbsoluteFill style={{ backgroundColor: bg }} />;
  const u = fmt.u;
  let content: React.ReactNode = null;
  if (frame < switchAt) {
    // centred on the frame (where the lockup lands): in 9:16 the safe area itself is off-centre
    const box = centerSafe(fmt);
    content = (
      <Headline
        text={lines} at={0} until={switchAt} role={p.role ?? "grotesk"} weight={p.weight ?? 400} size={p.size ?? 100}
        color={ink} align="center" region={box} maxWidth={fmt.portrait ? Math.min(fmt.W * 0.84, box.w) : undefined}
        stagger={p.stagger ?? taglineGaps(n)} tracking={-0.01} lineHeight={1.2} tempo={k} accent={p.accent}
      />
    );
  } else {
    const m = (frame - switchAt) * k;
    const live = liveOf(p.live);
    const lk = p.lockup ?? 1;
    const R0 = 106.7 * u * lk;
    // lockup layout at the final size, shrunk to fit the frame
    const brandRole = p.brandRole ?? p.role ?? "grotesk", bw = p.brandWeight ?? 500;
    let bs = (p.brandSize ?? 120.65) * u * lk;
    const ctx = (mctx ??= document.createElement("canvas").getContext("2d")!);
    const words = p.brand.split(/\s+/).filter(Boolean);
    const measureAll = () => {
      ctx.font = font(brandRole, bs, bw);
      ctx.letterSpacing = `${-0.01 * bs}px`;
      const ws = words.map((w) => ctx.measureText(w).width);
      return { ws, space: ctx.measureText(" ").width, cap: ctx.measureText("H").actualBoundingBoxAscent };
    };
    let rf = R0 * 0.54, gap = rf * 0.54, M = measureAll();
    const total = () => 2 * rf + gap + M.ws.reduce((a, b) => a + b, 0) + M.space * (words.length - 1);
    const maxW = fmt.W * (fmt.portrait ? 0.84 : 0.8);
    let scale = 1;
    if (total() > maxW) {
      scale = maxW / total();
      bs *= scale;
      rf *= scale;
      gap *= scale;
      M = measureAll();
    }
    // living hold: a push about the frame centre whose speed ramps in over 24 frames from the end of the slide
    const t0 = frame - (switchAt + Math.round(50 / k)), ramp = 24;
    const rate = live ? live.push / 30 : 0;
    const Z = 1 + rate * (t0 <= 0 ? 0 : t0 < ramp ? (t0 * t0) / (2 * ramp) : t0 - ramp / 2);
    const zx = (x: number) => fmt.W / 2 + (x - fmt.W / 2) * Z, zy = (y: number) => fmt.H / 2 + (y - fmt.H / 2) * Z;
    const tb = frame - (still + 4);
    const blinkV = live && live.blink > 0 && tb >= 0 ? blink(tb % live.blink, [0]) : 0;
    const left = (fmt.W - total()) / 2, cy = fmt.H / 2, markX = left + rf;
    const D = fmt.W / 2 - markX;
    const slide = chainS(m, SLIDE) * D;
    const r = chainS(m, MARK_R) * R0 * scale;
    const markProps: MarkProps = { cx: zx(markX + slide), cy: zy(cy), r: r * Z, roll: chainS(m, ROLL), turn: chainS(m, TURN), frame: m, color: p.markColor ?? ink, blink: blinkV };
    let x = markX + rf + gap + slide;
    const wm = words.map((w, i) => {
      const at = 33 + 4 * i, wx = x;
      x += M.ws[i] + M.space;
      return m >= at ? (
        <text key={i} x={wx} y={cy + M.cap / 2} fill={ink} style={{ fontFamily: family(brandRole), fontWeight: bw, fontSize: bs, letterSpacing: `${-0.01 * bs}px`, whiteSpace: "pre" }}>
          {w}
        </text>
      ) : null;
    });
    const ctaAt = 33 + 4 * words.length + 8;
    const ctaSize = (p.ctaSize ?? 44) * u * lk * Math.max(scale, 0.8);
    const breath = (amp: number) => amp * Math.sin(((m - ctaAt - 14) / 46) * Math.PI * 2) * clamp((m - ctaAt - 14) / 12);
    let cta: React.ReactNode = null;
    if (p.cta && m >= ctaAt && p.ctaPill) {
      const cs = ctaSize * (p.ctaPill.size ?? 1), cw = p.ctaPill.weight ?? 600, role = p.role ?? "grotesk";
      ctx.font = font(role, cs, cw);
      ctx.letterSpacing = `${0.005 * cs}px`;
      const pw = ctx.measureText(p.cta).width + cs * 1.9, ph = cs * 2.05, py = cy + rf + 2.15 * ctaSize;
      const sc = (0.35 + 0.65 * spr(m, ctaAt, SPRING.pop)) * (1 + breath(p.ctaPill.pulse ?? live?.breathe ?? 0));
      cta = (
        <g transform={`translate(${fmt.W / 2} ${py}) scale(${sc})`}>
          <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} rx={ph / 2} fill={p.ctaPill.fill} />
          <text x={0} y={cs * 0.36} textAnchor="middle" fill={p.ctaPill.color ?? "#ffffff"} style={{ fontFamily: family(role), fontWeight: cw, fontSize: cs, letterSpacing: `${0.005 * cs}px` }}>
            {p.cta}
          </text>
        </g>
      );
    } else if (p.cta && m >= ctaAt) {
      const ty = cy + rf + 2.1 * ctaSize, sc = 1 + breath(live?.breathe ?? 0);
      cta = (
        <g transform={`translate(${fmt.W / 2} ${ty - 0.35 * ctaSize}) scale(${sc}) translate(${-fmt.W / 2} ${-(ty - 0.35 * ctaSize)})`}>
          <text x={fmt.W / 2 + wordOffset(m - ctaAt) * ctaSize} y={ty} textAnchor="middle" fill={p.sub ?? "#6e6e73"} style={{ fontFamily: family(p.role ?? "grotesk"), fontWeight: 500, fontSize: ctaSize, letterSpacing: `${0.005 * ctaSize}px` }}>
            {p.cta}
          </text>
        </g>
      );
    }
    content = (
      <>
        {(p.mark ?? ((q: MarkProps) => <OrbMark {...q} />))(markProps)}
        <svg width={fmt.W} height={fmt.H} viewBox={`0 0 ${fmt.W} ${fmt.H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <g transform={Z !== 1 ? `translate(${fmt.W / 2} ${fmt.H / 2}) scale(${Z}) translate(${-fmt.W / 2} ${-fmt.H / 2})` : undefined}>
            {wm}
            {cta}
          </g>
        </svg>
      </>
    );
  }
  return <AbsoluteFill style={{ backgroundColor: bg, ...p.style }}>{content}</AbsoluteFill>;
};
