/**
 * Film shell for cel films. Same timing.json contract as the series kit (plan.py), so pipeline.py, srt.py,
 * shorts.py and resolve_drp.py work unchanged. Differences from the kit Film: hard cuts at the middle of each
 * scene overlap (anime editing) instead of crossfades; chapter cards (scene.virtue); reference label; title and end
 * cards drawn as motion typography. Captions (quoted words in gold) are drawn only when the script sets
 * burnCaptions: the delivered films carry no text of the narration in the picture, so subtitles in any language
 * (the SRTs, translations) can sit over them.
 */
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";

const cinzel = loadCinzel("normal", { weights: ["600", "700", "900"], subsets: ["latin"] });
const cormorant = loadCormorant("normal", { weights: ["600", "700"], subsets: ["latin"] });
const cormorantI = loadCormorant("italic", { weights: ["600"], subsets: ["latin"] });
const oswald = loadOswald("normal", { weights: ["500", "600"], subsets: ["latin"] });
export const F = { display: cinzel.fontFamily, serif: cormorant.fontFamily, serifI: cormorantI.fontFamily, label: oswald.fontFamily };

export type Group = { t: string; at: number; vo: number; vf: number; hidden?: boolean };
export type SceneT = { id: string; kind?: string; duration: number; ref?: string; groups: Group[]; virtue?: string; vsub?: string; chapter?: number; mood?: string };
/**
 * series: label on chapter and end cards ("THE ROLE MODEL"); endQuote / endRef: the end card's closing line and its
 * reference; titleOf: a serif line under the title letters ("of Nazareth"), before the rule and the sub;
 * burnCaptions: draw the narration captions into the picture (off by default, user Oct 13 2026: multi-language).
 * titleSize / titleSizeV: title letter size in px (default 150) for long titles ("CAN REASON ALONE\nPROVE GOD?").
 */
export type Timing = {
  fps: number; width: number; height: number; overlap: number; title: string; titleV?: string; titleOf?: string; titleSize?: number; titleSizeV?: number; sub?: string; endTitle?: string; endTitleV?: string;
  series?: string; endQuote?: string; endRef?: string; burnCaptions?: boolean; scenes: SceneT[];
};
export type SceneProps = { dur: number; g: number[] };

export const starts = (t: Timing) => {
  let s = 0;
  return t.scenes.map((sc) => {
    const a = s;
    s += sc.duration - t.overlap;
    return a;
  });
};
export const totalFrames = (t: Timing) => {
  const st = starts(t);
  return st[st.length - 1] + t.scenes[t.scenes.length - 1].duration;
};

const usePortrait = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/** Scene visual shown between its cut-in and cut-out frames (middle of the overlaps). */
const Visual: React.FC<{ s: SceneT; first: boolean; last: boolean; ov: number; V: React.FC<SceneProps> }> = ({ s, first, last, ov, V }) => {
  const f = useCurrentFrame();
  const cin = first ? 0 : Math.floor(ov / 2);
  const cout = last ? s.duration : s.duration - Math.ceil(ov / 2);
  if (f < cin || f >= cout) return null;
  return <V dur={s.duration} g={s.groups.map((g) => g.at)} />;
};

// ---- typography -----------------------------------------------------------------------------------------

const QUOTE = /(“[^”]*”?|“[^”]*$)/g;
/** Caption with “quoted words” in warm gold (Jesus's words and scripture quotations). */
const CaptionText: React.FC<{ t: string }> = ({ t }) => {
  // quotes may span lines; track open/close across the string
  const out: React.ReactNode[] = [];
  let inQ = false;
  let buf = "";
  const flush = (k: number) => {
    if (!buf) return;
    out.push(<span key={k} style={inQ ? { color: "#ffd98c", fontFamily: F.serif, fontStyle: "italic" } : undefined}>{buf}</span>);
    buf = "";
  };
  [...t].forEach((ch, i) => {
    if (ch === "“") { flush(i); inQ = true; buf += ch; return; }
    if (ch === "”") { buf += ch; flush(i); inQ = false; return; }
    buf += ch;
  });
  flush(t.length);
  void QUOTE;
  return <>{out}</>;
};

const Captions: React.FC<{ s: SceneT; ov: number }> = ({ s, ov }) => {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const { width, height } = useVideoConfig();
  const gs = s.groups.filter((g) => !g.hidden);
  const cur = gs.filter((g) => f >= g.at).pop();
  if (!cur || s.kind === "title" || s.kind === "end") return null;
  const i = gs.indexOf(cur);
  const next = gs[i + 1];
  const end = next ? next.at : s.duration - Math.ceil(ov / 2);
  const o = Math.min(interpolate(f, [cur.at, cur.at + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), interpolate(f, [end - 7, end - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const y = interpolate(f, [cur.at, cur.at + 6], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = portrait ? 50 : 44;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: portrait ? height * 0.235 : height * 0.075, display: "flex", justifyContent: "center", opacity: o, transform: `translateY(${y}px)` }}>
      <div style={{
        maxWidth: portrait ? 820 : width * 0.72, textAlign: "center", fontFamily: F.serif, fontWeight: 700, fontSize: size, lineHeight: 1.18, color: "#fbf6ec",
        textShadow: "0 0 3px rgba(10,6,12,0.95), 0 0 10px rgba(10,6,12,0.75), 0 2px 18px rgba(10,6,12,0.6)", letterSpacing: 0.2,
      }}>
        <CaptionText t={cur.t.replace(/\n/g, " ")} />
      </div>
    </div>
  );
};

const RefLabel: React.FC<{ s: SceneT }> = ({ s }) => {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const { height } = useVideoConfig();
  if (!s.ref || s.kind === "title" || s.kind === "end") return null;
  const o = interpolate(f, [s.virtue ? 70 : 14, s.virtue ? 84 : 28], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: portrait ? height * 0.085 : 44, left: portrait ? 0 : 64, right: portrait ? 0 : undefined, textAlign: portrait ? "center" : "left", opacity: o,
      fontFamily: F.label, fontWeight: 500, fontSize: portrait ? 30 : 26, letterSpacing: 6, color: "#f6ecd8", textShadow: "0 0 8px rgba(0,0,0,0.8)" }}>
      {s.ref}
    </div>
  );
};

const fontOf = (weight: number, size: number, family: string, italic = false) => `${italic ? "italic " : ""}${weight} ${size}px "${family}"`;

/**
 * Chapter card: a skewed colour slab wipes in, number and virtue pop on twos, then wipe out (frames 0-84).
 * Drawn on its own full-frame canvas, not as DOM: in full part renders the DOM card's painted tiles froze in some
 * Chrome tabs (GPU busy with the scene), so its last exit frame flashed back every 7th frame for up to 8 s, even when
 * the card stayed mounted and was only hidden by opacity. A canvas updates as a texture with the frame, like the
 * WebGL scene, which never froze.
 */
const ChapterCard: React.FC<{ t: Timing; s: SceneT }> = ({ t, s }) => {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const fs = Math.floor(f / 2) * 2;
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !s.virtue) return;
    const g = c.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, width, height);
    const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
    const inK = interpolate(fs, [4, 12], [0, 1], cl);
    const outK = interpolate(fs, [74, 84], [0, 1], cl);
    if (fs < 4 || outK >= 1) return;
    const pop = interpolate(fs, [8, 12, 16], [0.6, 1.08, 1], cl);
    const textO = interpolate(fs, [8, 10], [0, 1], cl) * (1 - outK);
    const subO = interpolate(fs, [16, 22], [0, 1], cl) * (1 - outK);
    const slabW = portrait ? width * 0.92 : width * 0.5;
    const left = portrait ? (width - slabW) / 2 : width * 0.055;
    const top = portrait ? height * 0.56 : height * 0.6;
    // Long chapter names shrink to fit (portrait: inside the slab; landscape: up to 80 % of the frame).
    const ls0 = g as CanvasRenderingContext2D & { letterSpacing: string };
    g.font = fontOf(900, 100, F.display);
    ls0.letterSpacing = "4px";
    const fitW = portrait ? slabW - 40 : width * 0.8;
    const vSize = Math.min(portrait ? 118 : 112, (100 * fitW) / Math.max(1, g.measureText(s.virtue).width));
    const tan = Math.tan((-14 * Math.PI) / 180);
    // slab: skewX(-14deg) scaleX(k) about its left (wiping in) or right (wiping out) middle
    const sx = left - 30, sy = top - 18, sw = slabW + 60, sh = vSize * 1.95;
    const k = inK * (1 - outK);
    if (k > 0.001) {
      const ox = outK > 0 ? sx + sw : sx, oy = sy + sh / 2;
      g.setTransform(k, 0, tan, 1, ox - k * ox - tan * oy, 0);
      const grad = g.createLinearGradient(sx, sy, sx + sw, sy + sh * 0.18);
      grad.addColorStop(0, "rgba(122,26,32,0.94)");
      grad.addColorStop(0.6, "rgba(150,34,38,0.9)");
      grad.addColorStop(1, "rgba(122,26,32,0)");
      g.fillStyle = grad;
      g.fillRect(sx, sy, sw, sh);
      g.strokeStyle = "rgba(255,236,200,0.5)";
      g.lineWidth = 3;
      g.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);
      // gold rule along the bottom, skewed about its own middle
      const rw = sw * k, ry = top + vSize * 1.95 - 12;
      g.setTransform(1, 0, tan, 1, -tan * (ry + 3), 0);
      g.fillStyle = "#f1d48a";
      g.fillRect(sx, ry, rw, 6);
    }
    // text block: scale(pop) about its left middle (16:9) or centre (9:16)
    if (textO > 0.001) {
      const lab = portrait ? 30 : 26, sub = portrait ? 40 : 36;
      const blockH = lab * 1.45 + vSize + 6 + sub * 1.25;
      const ox = portrait ? left + slabW / 2 : left, oy = top + blockH / 2;
      g.setTransform(pop, 0, 0, pop, ox - pop * ox, oy - pop * oy);
      const x = portrait ? left + slabW / 2 : left + 18;
      g.textAlign = portrait ? "center" : "left";
      g.textBaseline = "top";
      const ls = g as CanvasRenderingContext2D & { letterSpacing: string };
      g.globalAlpha = textO;
      g.font = fontOf(600, lab, F.label);
      ls.letterSpacing = "9px";
      g.fillStyle = "#f6dfa6";
      g.fillText(`${String(s.chapter ?? 0).padStart(2, "0")}${t.series ? ` · ${t.series}` : ""}`, x, top + lab * 0.12);
      g.font = fontOf(900, vSize, F.display);
      ls.letterSpacing = "4px";
      const wy = top + lab * 1.45;
      g.fillStyle = "rgba(40,8,12,0.65)";
      g.fillText(s.virtue, x + 4, wy + 4);
      g.fillStyle = "#fff8ec";
      g.fillText(s.virtue, x, wy);
      if (s.vsub && subO > 0.001) {
        g.globalAlpha = subO;
        g.font = fontOf(600, sub, F.serifI, true);
        ls.letterSpacing = "0px";
        g.fillStyle = "#fbe9c8";
        g.fillText(s.vsub, x, wy + vSize + 6);
      }
      g.globalAlpha = 1;
    }
  }, [fs, width, height, portrait, s, t]);
  if (!s.virtue) return null;
  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", left: 0, top: 0, width, height }} />;
};

const TitleCard: React.FC<{ t: Timing; s: SceneT }> = ({ t, s }) => {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const { height } = useVideoConfig();
  const fs = Math.floor(f / 2) * 2;
  const title = (portrait ? t.titleV ?? t.title : t.title).split("\n");
  const size = (portrait ? t.titleSizeV : t.titleSize) ?? 150;
  const o = interpolate(f, [s.duration - 30, s.duration - 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rule = interpolate(fs, [10, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sweep = interpolate(f, [30, 90], [-30, 130], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o, paddingBottom: portrait ? height * 0.12 : 0 }}>
      <div style={{ textAlign: "center" }}>
        {title.map((line, li) => (
          <div key={li} style={{ display: "flex", justifyContent: "center" }}>
            {[...line].map((ch, i) => {
              const k = interpolate(fs, [6 + (li * line.length + i) * 2, 14 + (li * line.length + i) * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              // Motion and shadow on an outer span that stays composited (will-change); the gradient-clipped glyph
              // on an inner span. On one element, Chrome's video render painted settled letters as solid gold boxes.
              return (
                <span key={i} style={{
                  display: "inline-block", opacity: Math.min(k, 0.999), transform: `translate3d(0, ${(1 - k) * 30}px, 0)`, willChange: "transform, opacity",
                  filter: "drop-shadow(0 4px 10px rgba(20,8,6,0.65))",
                }}>
                  <span style={{
                    fontFamily: F.display, fontWeight: 900, fontSize: size, letterSpacing: ((portrait ? 10 : 14) * size) / 150, lineHeight: 1.04, display: "inline-block", whiteSpace: "pre",
                    backgroundImage: `linear-gradient(100deg, #f7e2a8 0%, #fff8e4 ${sweep - 8}%, #ffffff ${sweep}%, #f0cf7c ${sweep + 10}%, #d9a84a 100%)`,
                    WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent",
                  }}>{ch}</span>
                </span>
              );
            })}
          </div>
        ))}
        {t.titleOf ? (
          <div style={{ fontFamily: F.serifI, fontStyle: "italic", fontWeight: 600, fontSize: portrait ? 84 : 78, lineHeight: 1.1, color: "#f6dfa6", marginTop: 4, letterSpacing: 1,
            opacity: interpolate(fs, [28, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), textShadow: "0 3px 14px rgba(20,8,6,0.7)" }}>{t.titleOf}</div>
        ) : null}
        <div style={{ height: 4, margin: "18px auto", width: `${rule * (portrait ? 70 : 46)}%`, background: "linear-gradient(90deg, transparent, #f1d48a, transparent)" }} />
        <div style={{ fontFamily: F.serifI, fontStyle: "italic", fontWeight: 600, fontSize: portrait ? 64 : 60, color: "#fff4dc", opacity: interpolate(fs, t.titleOf ? [42, 56] : [36, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), textShadow: "0 2px 14px rgba(0,0,0,0.7)" }}>{t.sub}</div>
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ t: Timing; s: SceneT }> = ({ t, s }) => {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const o = interpolate(f, [10, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const title = (portrait ? t.endTitleV ?? t.title : t.endTitle ?? t.title).split("\n");
  void s;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ textAlign: "center" }}>
        {t.series ? <div style={{ fontFamily: F.label, fontWeight: 500, letterSpacing: 10, fontSize: portrait ? 34 : 30, color: "#f1d48a" }}>{t.series}</div> : null}
        {title.map((l, i) => (
          <div key={i} style={{ fontFamily: F.display, fontWeight: 900, fontSize: portrait ? 130 : 120, color: "#fff6e2", letterSpacing: 10, lineHeight: 1.05, textShadow: "0 4px 16px rgba(0,0,0,0.6)" }}>{l}</div>
        ))}
        {t.endQuote ? <div style={{ fontFamily: F.serifI, fontStyle: "italic", fontWeight: 600, fontSize: portrait ? 58 : 54, color: "#ffd98c", marginTop: 18 }}>{t.endQuote}</div> : null}
        {t.endRef ? <div style={{ fontFamily: F.label, letterSpacing: 6, fontSize: portrait ? 26 : 22, color: "#e9dcc4", marginTop: 26, opacity: 0.85 }}>{t.endRef}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Overlay: radial focus lines (anime "shuchusen") for miracle beats; amount 0..1, on twos. */
export const FocusLines: React.FC<{ amount: number; color?: string; cx?: number; cy?: number; seed?: number }> = ({ amount, color = "#fff6dc", cx = 0.5, cy = 0.45, seed = 1 }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (amount <= 0.01) return null;
  const k = Math.floor(f / 2) + seed * 17;
  const n = 90;
  const R = Math.hypot(width, height);
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const r1 = Math.abs(Math.sin(i * 12.9898 + k * 78.233)) % 1;
    const a = (i / n) * Math.PI * 2 + r1 * 0.05;
    const inner = R * (0.22 + 0.14 * r1) * (1.2 - amount * 0.4);
    const w = 2 + r1 * 7;
    const x0 = cx * width + Math.cos(a) * inner, y0 = cy * height + Math.sin(a) * inner;
    const x1 = cx * width + Math.cos(a) * R, y1 = cy * height + Math.sin(a) * R;
    const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
    lines.push(<polygon key={i} points={`${x0},${y0} ${x1 + nx},${y1 + ny} ${x1 - nx},${y1 - ny}`} fill={color} opacity={0.55 * amount} />);
  }
  return <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>{lines}</svg>;
};

export const CelFilm: React.FC<{ audio: boolean; timing: Timing; visuals: Record<string, React.FC<SceneProps>> }> = ({ audio, timing, visuals }) => {
  const st = starts(timing);
  const ov = timing.overlap;
  const n = timing.scenes.length;
  return (
    <AbsoluteFill style={{ backgroundColor: "#07060a", overflow: "hidden" }}>
      {timing.scenes.map((s, i) => {
        const V = visuals[s.id];
        if (!V) throw new Error(`No visual for scene "${s.id}"`);
        return (
          <Sequence key={`v${s.id}`} name={s.id} from={st[i]} durationInFrames={s.duration}>
            <Visual s={s} first={i === 0} last={i === n - 1} ov={ov} V={V} />
          </Sequence>
        );
      })}
      {timing.scenes.map((s, i) => (
        <Sequence key={`t${s.id}`} name={`${s.id} text`} from={st[i] + (i ? Math.floor(ov / 2) : 0)} durationInFrames={s.duration - (i ? Math.floor(ov / 2) : 0)}>
          <Sequence from={-(i ? Math.floor(ov / 2) : 0)} layout="none">
            {s.kind === "title" ? <TitleCard t={timing} s={s} /> : null}
            {s.kind === "end" ? <EndCard t={timing} s={s} /> : null}
            <RefLabel s={s} />
            <ChapterCard t={timing} s={s} />
            {timing.burnCaptions ? <Captions s={s} ov={ov} /> : null}
          </Sequence>
        </Sequence>
      ))}
      {audio ? <Audio src={staticFile("score.wav")} /> : null}
    </AbsoluteFill>
  );
};
