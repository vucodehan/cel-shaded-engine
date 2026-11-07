/**
 * Motion typography. In the cel films the narration is never drawn into the picture (the SRTs are the subtitle
 * track, user Oct 13 2026): use these for titles, short key terms, labels, references and numbers, kept above the
 * bottom 20 % where uploaded subtitles sit.
 */
import React, { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { C, fonts, goldText } from "./theme";
import { ease, lerp, prog } from "./anim";
import { useLayout } from "./layout";

export type Motion = "rise" | "drop" | "focus";
export type WordStyler = (word: string, index: number, frame: number) => CSSProperties | undefined;

interface RevealProps {
  text: string;
  start: number;
  y: number;
  size: number;
  stagger?: number;
  duration?: number;
  font?: "serif" | "display";
  weight?: number;
  italic?: boolean;
  color?: string;
  motion?: Motion;
  distance?: number;
  blur?: number;
  by?: "word" | "char";
  styleWord?: WordStyler;
  shadow?: string;
  /** Wrap width; defaults to the frame's safe text column. */
  maxWidth?: number;
  /** Left-anchor the line at this x instead of centring it. */
  x?: number;
  opacity?: number;
  style?: CSSProperties;
}

/** Text revealed unit by unit (word or character). `y` is the block's vertical centre; "\n" breaks lines. */
export const Reveal: React.FC<RevealProps> = ({
  text, start, y, size, stagger = 5, duration = 28, font = "serif", weight = 500, italic = false, color = C.ivory, motion = "rise", distance = 26, blur = 10, by = "word",
  styleWord, shadow = "0 2px 30px rgba(0,0,0,0.55)", maxWidth, x, opacity = 1, style,
}) => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const width = maxWidth ?? (v ? 800 : 1640);
  const unit = (content: string, i: number) => {
    const p = prog(frame, start + i * stagger, duration, ease.out);
    const dy = motion === "rise" ? (1 - p) * distance : motion === "drop" ? -(1 - p) * distance : 0;
    const sc = motion === "focus" ? 1 + (1 - p) * 0.12 : 1;
    const b = (1 - p) * blur;
    return (
      <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${dy}px) scale(${sc})`, filter: b > 0.05 ? `blur(${b}px)` : undefined, ...styleWord?.(content, i, frame) }}>
        {content}
      </span>
    );
  };
  let k = 0;
  const body = text.split("\n").map((line, li, lines) => {
    const words = line.split(" ");
    const row = words.map((w, wi) => {
      const sep = wi < words.length - 1 ? " " : null;
      if (by === "word") return <React.Fragment key={wi}>{unit(w, k++)}{sep}</React.Fragment>;
      const chars = Array.from(w).map((ch) => unit(ch, k++));
      k++;
      return <React.Fragment key={wi}><span style={{ display: "inline-block", whiteSpace: "nowrap" }}>{chars}</span>{sep}</React.Fragment>;
    });
    return <React.Fragment key={li}>{row}{li < lines.length - 1 ? <br /> : null}</React.Fragment>;
  });
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute", left: x ?? 0, right: x === undefined ? 0 : undefined, top: y, transform: "translateY(-50%)", display: "flex",
        justifyContent: x === undefined ? "center" : "flex-start", fontFamily: font === "serif" ? fonts.serif : fonts.display, fontSize: size, fontWeight: weight,
        fontStyle: italic ? "italic" : "normal", color, lineHeight: 1.16, textShadow: shadow, opacity, ...style,
      }}
    >
      <div style={{ maxWidth: width, textAlign: x === undefined ? "center" : "left", whiteSpace: "normal", textWrap: "balance" } as CSSProperties}>{body}</div>
    </div>
  );
};

interface CapsProps {
  text: string;
  start: number;
  y: number;
  size: number;
  duration?: number;
  tracking?: [number, number];
  gold?: boolean;
  color?: string;
  weight?: number;
  sweep?: [number, number];
  glow?: string;
  blur?: number;
  /** centre x (default: frame centre) */
  x?: number;
  opacity?: number;
  style?: CSSProperties;
}

/** Display caps that settle from wide tracking; "\n" breaks lines. Optional gold leaf + specular sweep [start, dur]. */
export const Caps: React.FC<CapsProps> = ({ text, start, y, size, duration = 45, tracking = [0.6, 0.25], gold = false, color = C.ivory, weight = 600, sweep, glow, blur = 10, x, opacity = 1, style }) => {
  const frame = useCurrentFrame();
  const { W } = useLayout();
  const p = prog(frame, start, duration, ease.out);
  const ls = lerp(tracking[0], tracking[1], p);
  const sw = sweep ? prog(frame, sweep[0], sweep[1], ease.inOut) : undefined;
  const filters = [(1 - p) * blur > 0.05 ? `blur(${(1 - p) * blur}px)` : "", "drop-shadow(0 0 36px rgba(0,0,0,0.6))", glow ? `drop-shadow(0 0 22px rgba(${glow},0.45))` : ""].join(" ");
  if (p * opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute", left: x === undefined ? 0 : x - W, width: x === undefined ? "100%" : W * 2, top: y, transform: "translateY(-50%)", display: "flex", justifyContent: "center",
        opacity: p * opacity, filter: filters, ...style,
      }}
    >
      <div style={{ fontFamily: fonts.display, fontSize: size, fontWeight: weight, letterSpacing: `${ls}em`, paddingLeft: `${ls}em`, lineHeight: 1.05, whiteSpace: "pre", textAlign: "center", color, ...(gold ? goldText(sw) : {}) }}>
        {text}
      </div>
    </div>
  );
};

/** Kicker line flanked by drawn gold rules ("I BELIEVE" in the creed films). */
export const Header: React.FC<{ text: string; start: number; y: number; size?: number; rule?: number; opacity?: number }> = ({ text, start, y, size = 30, rule: ruleW = 150, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, start, 40, ease.out);
  const rule = prog(frame, start + 6, 46, ease.out);
  const ls = lerp(1.1, 0.55, p);
  const ruleStyle = (dir: "l" | "r"): CSSProperties => ({
    width: ruleW * rule, height: 1.5,
    background: dir === "l" ? "linear-gradient(90deg, rgba(227,184,96,0), rgba(227,184,96,0.9))" : "linear-gradient(90deg, rgba(227,184,96,0.9), rgba(227,184,96,0))",
  });
  if (p * opacity <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, transform: "translateY(-50%)", display: "flex", justifyContent: "center", alignItems: "center", gap: 26, opacity: p * opacity }}>
      <div style={ruleStyle("l")} />
      <div style={{ fontFamily: fonts.display, fontSize: size, fontWeight: 600, letterSpacing: `${ls}em`, paddingLeft: `${ls}em`, color: C.goldLight, textShadow: "0 0 18px rgba(255,200,120,0.45)", whiteSpace: "pre" }}>
        {text}
      </div>
      <div style={ruleStyle("r")} />
    </div>
  );
};

/** Section marker ("I · ONE GOD"): bottom in 16:9, top in 9:16 (clear of Shorts UI). */
export const SectionMark: React.FC<{ part: string; name: string; start: number }> = ({ part, name, start }) => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const p = prog(frame, start, 40, ease.out);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: v ? 300 : 1000, transform: `translateY(${(1 - p) * 10}px)`, display: "flex", justifyContent: "center", alignItems: "center", gap: 18, opacity: p * 0.7, fontFamily: fonts.display, fontSize: v ? 20 : 17, letterSpacing: "0.5em", color: C.ivory }}>
      <span style={{ color: C.gold }}>{part}</span>
      <span style={{ width: 40 * p, height: 1, background: "rgba(227,184,96,0.7)" }} />
      <span>{name}</span>
    </div>
  );
};

/** A small framed label (claim-strength tags, a term under an icon): pops in at `start`, centred on (x, y). */
export const Tag: React.FC<{ text: string; x: number; y: number; start: number; size?: number; color?: string; fill?: string; opacity?: number }> = ({
  text, x, y, start, size = 24, color = C.goldLight, fill = "rgba(12,14,26,0.72)", opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, start, 18, ease.outBack);
  const o = prog(frame, start, 10, ease.out) * opacity;
  if (o <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${lerp(0.7, 1, p)})`, opacity: o, padding: `${size * 0.32}px ${size * 0.8}px`, border: `1.5px solid ${color}`, borderRadius: size * 0.2, background: fill, fontFamily: fonts.display, fontWeight: 600, fontSize: size, letterSpacing: "0.32em", paddingRight: `${size * 0.8 - size * 0.32}px`, color, whiteSpace: "nowrap", boxShadow: "0 0 22px rgba(255,200,120,0.18)" }}>
      {text}
    </div>
  );
};
