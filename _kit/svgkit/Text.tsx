import React, { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, fonts, godStyle, goldGlow, goldText, lordStyle } from "./theme";
import { ease, lerp, prog } from "./anim";
import { useLayout } from "./layout";

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
  distance?: number;
  blur?: number;
  styleWord?: WordStyler;
  shadow?: string;
  maxWidth?: number;
  style?: CSSProperties;
}

/** Text revealed word by word with a soft rise. `y` is the block's vertical centre; "\n" breaks lines. */
export const Reveal: React.FC<RevealProps> = ({
  text,
  start,
  y,
  size,
  stagger = 4,
  duration = 24,
  font = "serif",
  weight = 600,
  italic = false,
  color = C.ivory,
  distance = 18,
  blur = 8,
  styleWord,
  shadow = "0 2px 4px rgba(0,0,0,0.55), 0 2px 26px rgba(0,0,0,0.7)",
  maxWidth,
  style,
}) => {
  const frame = useCurrentFrame();
  const { v } = useLayout();
  const width = maxWidth ?? (v ? 860 : 1720);
  let k = 0;
  const lines = text.split("\n").map((line, li, all) => {
    const words = line.split(" ").filter(Boolean);
    return (
      <React.Fragment key={li}>
        {words.map((w, wi) => {
          const i = k++;
          const p = prog(frame, start + i * stagger, duration, ease.out);
          const b = (1 - p) * blur;
          // Words joined by an em dash ("LORD—a") are styled part by part so each part matches on its own.
          const parts = w.split(/(?<=—)/);
          return (
            <React.Fragment key={wi}>
              {parts.map((part, pi) => (
                <span
                  key={pi}
                  style={{
                    display: "inline-block",
                    opacity: p,
                    transform: `translateY(${(1 - p) * distance}px)`,
                    filter: b > 0.05 ? `blur(${b}px)` : undefined,
                    ...styleWord?.(part, i, frame),
                  }}
                >
                  {part}
                </span>
              ))}
              {wi < words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
        {li < all.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: "center",
        fontFamily: font === "serif" ? fonts.serif : fonts.display,
        fontSize: size,
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        color,
        lineHeight: 1.18,
        textShadow: shadow,
        ...style,
      }}
    >
      <div style={{ maxWidth: width, textAlign: "center", whiteSpace: "normal", textWrap: "balance" } as CSSProperties}>{lines}</div>
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
  blur?: number;
  style?: CSSProperties;
}

/** Display caps that settle from wide tracking; "\n" breaks lines. Gold leaf with a warm glow and a specular sweep. */
export const Caps: React.FC<CapsProps> = ({ text, start, y, size, duration = 45, tracking = [0.6, 0.22], gold = false, color = C.ivory, weight = 600, sweep, blur = 10, style }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, start, duration, ease.out);
  const ls = lerp(tracking[0], tracking[1], p);
  const sw = sweep ? prog(frame, sweep[0], sweep[1], ease.inOut) : undefined;
  const b = (1 - p) * blur;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: "center",
        opacity: p,
        filter: `${b > 0.05 ? `blur(${b}px) ` : ""}${gold ? goldGlow : "drop-shadow(0 2px 10px rgba(0,0,0,0.7))"}`,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: size,
          fontWeight: weight,
          letterSpacing: `${ls}em`,
          paddingLeft: `${ls}em`,
          lineHeight: 1.08,
          whiteSpace: "pre",
          textAlign: "center",
          color,
          ...(gold ? goldText(sw) : {}),
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Top-of-frame darkening so verse text reads over any sky. */
export const TextShade: React.FC<{ strength?: number }> = ({ strength = 1 }) => {
  const { v } = useLayout();
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, rgba(2,3,8,${0.66 * strength}) 0%, rgba(2,3,8,${0.4 * strength}) ${v ? 30 : 30}%, rgba(2,3,8,0) ${v ? 44 : 50}%)`,
        pointerEvents: "none",
      }}
    />
  );
};

/** "GENESIS 4 : 8" — the verse reference at the top of the frame. */
export const VerseRef: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  const p = prog(f, 8, 30, ease.out);
  const ls = lerp(0.9, 0.5, p);
  const rule = (dir: "l" | "r"): CSSProperties => ({
    width: 60 * p,
    height: 1.5,
    background: dir === "l" ? "linear-gradient(90deg, rgba(244,201,120,0), rgba(244,201,120,0.95))" : "linear-gradient(90deg, rgba(244,201,120,0.95), rgba(244,201,120,0))",
  });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: v ? 262 : 62, transform: "translateY(-50%)", display: "flex", justifyContent: "center", alignItems: "center", gap: 20, opacity: p }}>
      <div style={rule("l")} />
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: v ? 25 : 20,
          fontWeight: 700,
          letterSpacing: `${ls}em`,
          paddingLeft: `${ls}em`,
          color: C.goldLight,
          textShadow: "0 0 14px rgba(255,200,120,0.45), 0 2px 12px rgba(0,0,0,0.85)",
          whiteSpace: "pre",
        }}
      >
        {text}
      </div>
      <div style={rule("r")} />
    </div>
  );
};

const bare = (w: string) => w.replace(/[,.;:!?“”"‘’'—()]/g, "").replace(/s$/, (m) => m);

/** Word styler: LORD in gold small caps, God in warm gold, listed words in gold leaf. */
export const scriptureStyler =
  (gold: string[] = []): WordStyler =>
  (w) => {
    const b = w.replace(/[,.;:!?“”"‘’—()]/g, "");
    const root = b.replace(/[’']s$/, "");
    if (root === "LORD") return lordStyle;
    if (root === "God") return godStyle;
    if (gold.includes(root) || gold.includes(bare(w))) return { ...goldText(), filter: "drop-shadow(0 0 10px rgba(255,200,120,0.45))" };
    return undefined;
  };

export type Group = { t: string; at: number; vo?: number; vf?: number; hidden?: boolean };

/** Verse text shown as successive phrase groups. */
export const VerseText: React.FC<{ groups: Group[]; gold?: string[]; y?: number; size?: number }> = ({ groups, gold = [], y, size }) => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  const yy = y ?? (v ? 570 : 236);
  const styler = scriptureStyler(gold);
  return (
    <>
      {groups.map((g, i) => {
        if (g.hidden) return null;
        const next = groups[i + 1];
        const a = next ? 1 - prog(f, next.at - 14, 12, ease.inOut) : 1;
        if (a <= 0 || f < g.at - 2) return null;
        const text = v ? g.t.replace(/\n/g, " ") : g.t;
        const len = text.length;
        const sz = size ?? (v ? (len > 150 ? 46 : len > 110 ? 50 : 54) : len > 140 ? 50 : 54);
        return (
          <AbsoluteFill key={i} style={{ opacity: a }}>
            <Reveal text={text} start={g.at} size={sz} y={yy} styleWord={styler} />
          </AbsoluteFill>
        );
      })}
    </>
  );
};

/** A word painted in display caps over the world (e.g. "BABEL", "ISRAEL"). */
export const WorldLabel: React.FC<{ text: string; x: number; y: number; at: number; size?: number; out?: number }> = ({ text, x, y, at, size = 44, out }) => {
  const f = useCurrentFrame();
  const p = prog(f, at, 30, ease.out) * (out !== undefined ? 1 - prog(f, out, 20, ease.inOut) : 1);
  const ls = lerp(0.9, 0.4, p);
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${1.15 - 0.15 * p})`,
        opacity: p,
        fontFamily: fonts.display,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: `${ls}em`,
        paddingLeft: `${ls}em`,
        whiteSpace: "nowrap",
        filter: goldGlow,
        ...goldText(),
      }}
    >
      {text}
    </div>
  );
};

const fit = (text: string, max: number, width: number, track: number) => {
  const longest = Math.max(...text.split("\n").map((l) => l.length));
  return Math.min(max, width / (longest * (0.82 + track)));
};

/** Multi-book labels ("MATTHEW 27; MARK 15; LUKE 23; JOHN 18–19") shrink to fit, and break at the "; " nearest the
 *  middle when one line would fall below 80% of the normal size. Short labels keep the normal size on one line. */
const fitLabel = (label: string, max: number, width: number, per: number) => {
  const one = Math.min(max, width / (label.length * per));
  const parts = label.split("; ");
  if (one >= max * 0.8 || parts.length < 2) return { text: label, size: one, lines: 1 };
  let best = 1;
  const side = (k: number) => Math.max(parts.slice(0, k).join("; ").length + 1, parts.slice(k).join("; ").length);
  for (let k = 2; k < parts.length; k++) if (side(k) < side(best)) best = k;
  const text = `${parts.slice(0, best).join("; ")};\n${parts.slice(best).join("; ")}`;
  return { text, size: Math.min(max, width / (side(best) * per)), lines: 2 };
};

/** Opening title: small "GENESIS 4" label between drawn rules, the story title in bright gold caps. */
export const TitleCard: React.FC<{ label: string; title: string; titleV?: string; sub?: string; dur: number }> = ({ label, title, titleV, sub }) => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  const t = v ? titleV ?? title : title;
  const size = fit(t, v ? 118 : 124, v ? 840 : 1680, 0.2);
  const lines = t.split("\n").length;
  const cy = v ? 820 : 470;
  const ty = cy + (lines > 1 ? size * 0.1 : 0);
  const p = prog(f, 6, 40, ease.out);
  const rule = prog(f, 14, 50, ease.out);
  const lab = fitLabel(label, v ? 30 : 26, v ? 760 : 1500, 1.32);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: cy - (lines * size * 1.08) / 2 - (v ? 70 : 64) - (lab.lines - 1) * lab.size * 0.65, transform: "translateY(-50%)", display: "flex", justifyContent: "center", alignItems: "center", gap: 24, opacity: p }}>
        <div style={{ width: 120 * rule, height: 1.5, background: "linear-gradient(90deg, rgba(244,201,120,0), rgba(244,201,120,0.95))" }} />
        <div style={{ fontFamily: fonts.display, fontSize: lab.size, fontWeight: 700, letterSpacing: "0.55em", paddingLeft: "0.55em", lineHeight: 1.3, whiteSpace: "pre", textAlign: "center", color: C.goldLight, textShadow: "0 0 16px rgba(255,200,120,0.5), 0 2px 12px rgba(0,0,0,0.85)" }}>
          {lab.text}
        </div>
        <div style={{ width: 120 * rule, height: 1.5, background: "linear-gradient(90deg, rgba(244,201,120,0.95), rgba(244,201,120,0))" }} />
      </div>
      <Caps text={t} start={18} duration={52} size={size} y={ty} tracking={[0.6, 0.18]} gold sweep={[72, 56]} weight={700} />
      {sub ? <Reveal text={sub} start={62} size={v ? 46 : 44} y={cy + (lines * size * 1.08) / 2 + (v ? 70 : 60)} italic weight={600} /> : null}
    </>
  );
};

/** Closing card: series label, the story title, a "next" line, then fade to black. */
export const EndCard: React.FC<{ label: string; title: string; titleV?: string; next?: string; dur: number }> = ({ label, title, titleV, next, dur }) => {
  const f = useCurrentFrame();
  const { v } = useLayout();
  const t = v ? titleV ?? title : title;
  const size = fit(t, v ? 96 : 100, v ? 820 : 1600, 0.2);
  const cy = v ? 840 : 450;
  const black = prog(f, dur - 46, 40, ease.inOut);
  const nextP = prog(f, 70, 40, ease.out);
  // Portrait stacks NEXT above the title; the title shrinks to fit 820 px (1600 px landscape) at 0.45em tracking.
  const nextSize = next ? Math.min(v ? 26 : 22, (v ? 820 : 1600 - 260) / (next.length * 1.25)) : 22;
  const lab = fitLabel(label, v ? 34 : 30, v ? 880 : 1700, 1.45);
  return (
    <>
      <Caps text={lab.text} start={6} duration={40} size={lab.size} y={cy - (v ? 170 : 120) - (lab.lines - 1) * lab.size * 0.6} tracking={[0.9, 0.55]} color={C.goldLight} weight={700} blur={4} />
      <Caps text={t} start={16} duration={50} size={size} y={cy} tracking={[0.6, 0.18]} gold sweep={[60, 56]} weight={700} />
      {next ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: cy + (v ? 240 : 160), transform: `translateY(-50%) translateY(${(1 - nextP) * 10}px)`, display: "flex", flexDirection: v ? "column" : "row", justifyContent: "center", alignItems: "center", gap: v ? 12 : 18, opacity: nextP * 0.95, fontFamily: fonts.display, fontSize: nextSize, fontWeight: 700, letterSpacing: "0.45em", color: C.ivory, textShadow: "0 2px 12px rgba(0,0,0,0.85)" }}>
          <span style={{ color: C.gold, fontSize: v ? 26 : 22, paddingLeft: "0.45em" }}>NEXT</span>
          <span style={{ width: 44 * nextP, height: 1.5, background: "rgba(244,201,120,0.85)" }} />
          <span style={{ whiteSpace: "nowrap", paddingLeft: "0.45em" }}>{next}</span>
        </div>
      ) : null}
      <AbsoluteFill style={{ background: "#000", opacity: black }} />
    </>
  );
};
