/**
 * <Headline>: kinetic on-screen text in the end card's language (videoclone.md 10.5): the block slides to rest
 * (EASE.blockSlide, 1.37 em over 23 frames) while each word appears at once a few px right of its place and settles
 * (EASE.wordPop, 5 frames); the last word lands in two segments. No fades or blur on the way in.
 * Placed inside the format's safe area (in 9:16 clear of the platform UI). Words are SVG text on exact baselines.
 */
import React from "react";
import { useCurrentFrame } from "remotion";
import { clamp, EASE, Ease } from "./ease";
import { family, font, FontRole, useFonts } from "./fonts";
import { Format, Rect, sub, useFormat } from "./format";

/** gradient: the accent words share one horizontal gradient across their extent (overrides color) */
export type Accent = { words: (number | string)[]; color?: string; role?: FontRole; italic?: boolean; weight?: number; gradient?: [string, string] };
export type HeadlineProps = {
  /** a string (wrapped to the region) or explicit lines */
  text: string | string[];
  /** first frame (words start popping) and, optionally, the frame it leaves */
  at?: number; until?: number;
  role?: FontRole; weight?: number; italic?: boolean; color?: string;
  /** font size in px at 1080 on the short side (scaled by the format; shrinks to fit) */
  size?: number;
  /** words (indices or text) in a different colour / font, e.g. a serif italic accent */
  accent?: Accent;
  align?: "left" | "center" | "right";
  /** where: a band of the safe area or any rect (px) */
  region?: "top" | "center" | "bottom" | "left" | "right" | "full" | Rect;
  /** vertical placement inside the region (default by region: top -> start, bottom -> end, else middle) */
  valign?: "start" | "middle" | "end";
  maxWidth?: number;
  /** frames between word pops: one number, or a list of gaps (the last repeats) */
  stagger?: number | number[];
  /** at least this many frames between the first words of consecutive lines (30 = one new line per second) */
  lineGap?: number;
  /** block slide distance in em (default 1.37; 0 = none) and direction (deg: 0 = from the right, 90 = from below) */
  slide?: number; slideAngle?: number;
  /** per-word entrance offset in em (default 0.085) */
  pop?: number;
  /** the last word lands in two segments (default true when there are 3+ words) */
  land?: boolean;
  lineHeight?: number; tracking?: number;
  exit?: "cut" | "fade";
  /** speed of all its timings (1 = the reference; 1.3 = 30 % faster) */
  tempo?: number;
  style?: React.CSSProperties;
};

type Word = { text: string; role: FontRole | string; weight: number; italic: boolean; color: string; w: number; n: number; grad?: boolean };
export type HeadlineLayout = { size: number; lh: number; box: Rect; lines: { y: number; words: { word: Word; x: number }[] }[]; words: number };

let mctx: CanvasRenderingContext2D | null = null;
const measurer = () => (mctx ??= document.createElement("canvas").getContext("2d")!);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const regionRect = (fmt: Format, r: HeadlineProps["region"] = "center"): Rect => {
  if (typeof r === "object") return r;
  const s = fmt.safe;
  switch (r) {
    case "top": return sub(s, 0, 0, 1, 0.34);
    case "bottom": return sub(s, 0, 0.64, 1, 1);
    case "left": return sub(s, 0, 0, 0.47, 1);
    case "right": return sub(s, 0.53, 0, 1, 1);
    case "full": return s;
    default: return sub(s, 0, 0.3, 1, 0.7);
  }
};

/** Word layout of a headline (px, composition space): useful to place things next to it. */
export function layoutHeadline(p: HeadlineProps, fmt: Format): HeadlineLayout {
  const box = regionRect(fmt, p.region);
  const maxW = p.maxWidth ?? box.w;
  const role = p.role ?? "display", weight = p.weight ?? 600, tracking = p.tracking ?? -0.02;
  const raw = Array.isArray(p.text) ? p.text.map((l) => l.split(/\s+/).filter(Boolean)) : [p.text.split(/\s+/).filter(Boolean)];
  let n = 0;
  const isAccent = (t: string, i: number) => !!p.accent?.words.some((w) => (typeof w === "number" ? w === i : norm(w) === norm(t)));
  const words = raw.map((line) =>
    line.map((t) => {
      const i = n++, acc = isAccent(t, i);
      return { text: t, role: acc ? p.accent?.role ?? role : role, weight: acc ? p.accent?.weight ?? weight : weight, italic: acc ? p.accent?.italic ?? !!p.italic : !!p.italic, color: acc ? p.accent?.color ?? p.color ?? "#0b0b0c" : p.color ?? "#0b0b0c", w: 0, n: i, grad: acc && !!p.accent?.gradient };
    }),
  );
  const ctx = measurer();
  const measureAll = (size: number) => {
    for (const line of words)
      for (const w of line) {
        ctx.font = font(w.role, size, w.weight, w.italic);
        ctx.letterSpacing = `${tracking * size}px`;
        w.w = ctx.measureText(w.text).width;
      }
    ctx.font = font(role, size, weight);
    return ctx.measureText(" ").width;
  };
  let size = (p.size ?? 96) * fmt.u;
  let space = measureAll(size);
  const flat = words.flat();
  // explicit lines keep their breaks; a string wraps to maxW
  const breakLines = () => {
    if (Array.isArray(p.text)) return words;
    const out: Word[][] = [[]];
    let lw = 0;
    for (const w of flat) {
      const cur = out[out.length - 1];
      const add = (cur.length ? space : 0) + w.w;
      if (cur.length && lw + add > maxW) {
        out.push([w]);
        lw = w.w;
      } else {
        cur.push(w);
        lw += add;
      }
    }
    return out;
  };
  const widthOf = (l: Word[]) => l.reduce((s, w, i) => s + w.w + (i ? space : 0), 0);
  let lines = breakLines();
  for (let pass = 0; pass < 3; pass++) {
    const widest = Math.max(...lines.map(widthOf));
    const tooBig = Math.max(...flat.map((w) => w.w)) > maxW || (Array.isArray(p.text) && widest > maxW);
    if (!tooBig) break;
    size *= (maxW / Math.max(widest, ...flat.map((w) => w.w))) * 0.98;
    space = measureAll(size);
    lines = breakLines();
  }
  const lh = (p.lineHeight ?? 1.1) * size;
  const blockH = lines.length * lh;
  const va = p.valign ?? (p.region === "top" ? "start" : p.region === "bottom" ? "end" : "middle");
  const y0 = va === "start" ? box.y : va === "end" ? box.y + box.h - blockH : box.y + (box.h - blockH) / 2;
  const align = p.align ?? (p.region === "left" || p.region === "right" ? "left" : "center");
  ctx.font = font(role, size, weight);
  const asc = ctx.measureText("H").actualBoundingBoxAscent;
  return {
    size, lh, box, words: n,
    lines: lines.map((l, i) => {
      const lw = widthOf(l);
      let x = align === "left" ? box.x : align === "right" ? box.x + box.w - lw : box.x + (box.w - lw) / 2;
      const placed = l.map((w) => {
        const at = x;
        x += w.w + space;
        return { word: w, x: at };
      });
      // baseline: the caps sit centred in the line's box
      return { y: y0 + i * lh + lh / 2 + asc / 2, words: placed };
    }),
  };
}

/** Frame offsets of each word's pop from the stagger (number or gap list). */
export const popTimes = (n: number, stagger: number | number[] = 3) => {
  const out = [0];
  for (let i = 1; i < n; i++) out.push(out[i - 1] + (typeof stagger === "number" ? stagger : stagger[Math.min(i - 1, stagger.length - 1)]));
  return out;
};

const seg = (f: number, a: number, b: number, v0: number, v1: number, e: Ease) => v0 + (v1 - v0) * e(clamp((f - a) / (b - a)));

/** x offset (em) of a popping word t frames after it appears; `last` = the two-segment landing. */
export const wordOffset = (t: number, pop = 0.085, last = false) => {
  if (!last) return pop * (1 - EASE.wordPop(clamp(t / 5)));
  // measured on the last word: 30 px -> 5.8 px over [-1.6, 4.3], then -> 0 by 15 (100 px type)
  return t < 4.3 ? seg(t, -1.6, 4.3, 0.298, 0.058, EASE.lastWordIn) : seg(t, 4.3, 15, 0.058, 0, EASE.lastWordSettle);
};

/** Pop frame of each word (headline frames from `at`): the stagger, with `lineGap` holding each line's first word at
 * least that many frames after the previous line's first word. */
export function headlineTimes(L: HeadlineLayout, p: Pick<HeadlineProps, "stagger" | "lineGap">) {
  const t = popTimes(L.words, p.stagger ?? 3);
  for (let i = 1; p.lineGap && i < L.lines.length; i++) {
    const a = L.lines[i - 1].words[0]?.word.n, b = L.lines[i].words[0]?.word.n;
    const need = a === undefined || b === undefined ? 0 : t[a] + p.lineGap - t[b];
    if (need > 0) for (let j = b!; j < t.length; j++) t[j] += need;
  }
  return t;
}

/** Everything a headline frame needs (shared by <Headline> and headlineWord). */
function headlineState(p: HeadlineProps, fmt: Format, real: number) {
  const at = p.at ?? 0;
  const fadeOut = p.until !== undefined && real >= p.until ? (p.exit === "fade" ? clamp((real - p.until) / 6) : 1) : 0;
  const frame = at + (real - at) * (p.tempo ?? 1);
  const L = layoutHeadline(p, fmt);
  const times = headlineTimes(L, p);
  const land = p.land ?? L.words >= 3;
  const slideEm = p.slide ?? 1.37, ang = ((p.slideAngle ?? 0) * Math.PI) / 180;
  const slide = slideEm * L.size * (1 - EASE.blockSlide(clamp((frame - at - 0.95) / 22.94)));
  const bx = slide * Math.cos(ang), by = slide * Math.sin(ang) - fadeOut * 0.15 * L.size;
  const dxOf = (n: number) => wordOffset(frame - at - times[n], p.pop ?? 0.085, land && n === L.words - 1) * L.size;
  return { at, fadeOut, frame, L, times, bx, by, dxOf, visible: (n: number) => real >= at && fadeOut < 1 && frame - at - times[n] >= 0 };
}

/** Word n of a headline at a (real) frame, px: its left x and baseline y after the block slide and the word pop, its
 * width, the font size and whether it shows; attach things to a word (a dot after the last word). */
export function headlineWord(p: HeadlineProps, fmt: Format, real: number, n: number) {
  const s = headlineState(p, fmt, real);
  for (const line of s.L.lines) for (const { word, x } of line.words) if (word.n === n) return { x: x + s.dxOf(n) + s.bx, y: line.y + s.by, w: word.w, size: s.L.size, visible: s.visible(n) };
  return null;
}

export const Headline: React.FC<HeadlineProps> = (p) => {
  const real = useCurrentFrame();
  const fmt = useFormat();
  const ok = useFonts();
  const gid = `hg${React.useId().replace(/:/g, "")}`;
  if (!ok) return null;
  const at = p.at ?? 0;
  if (real < at) return null;
  const { fadeOut, frame, L, times, bx, by, dxOf } = headlineState(p, fmt, real);
  if (fadeOut >= 1) return null;
  const role = p.role ?? "display", tracking = p.tracking ?? -0.02;
  let gx0 = Infinity, gx1 = -Infinity;
  for (const line of L.lines) for (const { word, x } of line.words) if (word.grad) [gx0, gx1] = [Math.min(gx0, x), Math.max(gx1, x + word.w)];
  const grad = p.accent?.gradient && gx1 > gx0 ? p.accent.gradient : null;
  return (
    <svg width={fmt.W} height={fmt.H} viewBox={`0 0 ${fmt.W} ${fmt.H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", opacity: 1 - fadeOut, ...p.style }}>
      {grad ? (
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={gx0} y1={0} x2={gx1} y2={0}>
            <stop offset="0" stopColor={grad[0]} />
            <stop offset="1" stopColor={grad[1]} />
          </linearGradient>
        </defs>
      ) : null}
      <g transform={`translate(${bx} ${by})`}>
        {L.lines.flatMap((line) =>
          line.words.map(({ word, x }) => {
            if (frame - at - times[word.n] < 0) return null;
            const dx = dxOf(word.n);
            return (
              <text key={word.n} x={x + dx} y={line.y} fill={word.grad && grad ? `url(#${gid})` : word.color} style={{ fontFamily: family(word.role ?? role), fontWeight: word.weight, fontStyle: word.italic ? "italic" : "normal", fontSize: L.size, letterSpacing: `${tracking * L.size}px`, whiteSpace: "pre" }}>
                {word.text}
              </text>
            );
          }),
        )}
      </g>
    </svg>
  );
};
