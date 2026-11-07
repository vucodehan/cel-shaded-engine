import React, { CSSProperties } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Grain, Vignette } from "./Atmos";
import { EndCard, Group, TextShade, TitleCard, VerseRef, VerseText } from "./Text";
import { C } from "./theme";
import { useLayout } from "./layout";

export type SceneDef = {
  id: string;
  kind?: "title" | "end" | "verse";
  duration: number;
  ref?: string;
  /** Overrides the film's `book` in this scene's verse label (a film spanning two books). */
  book?: string;
  groups: Group[];
  gold?: string[];
  shade?: number;
  start: number;
};

export type Timing = {
  fps: number;
  width: number;
  height: number;
  overlap: number;
  label: string;
  title: string;
  titleV?: string;
  sub?: string;
  endTitle?: string;
  endTitleV?: string;
  next?: string;
  book?: string;
  scenes: Omit<SceneDef, "start">[];
};

/** Props every scene visual receives: its length and the start frame of each text group. */
export type SceneProps = { dur: number; g: number[] };

export const withStarts = (t: Timing): SceneDef[] =>
  t.scenes.reduce<SceneDef[]>((acc, s, i) => {
    const prev = acc[i - 1];
    acc.push({ ...s, start: prev ? prev.start + prev.duration - t.overlap : 0 });
    return acc;
  }, []);

export const totalFrames = (t: Timing) => {
  const s = withStarts(t);
  const last = s[s.length - 1];
  return last.start + last.duration;
};

const useFade = (s: SceneDef, first: boolean, last: boolean, ov: number) => {
  const f = useCurrentFrame();
  const a = first ? 1 : interpolate(f, [0, ov], [0, 1], { extrapolateRight: "clamp" });
  const b = last ? 1 : interpolate(f, [s.duration - ov, s.duration], [1, 0], { extrapolateLeft: "clamp" });
  return Math.min(a, b);
};

const VisualLayer: React.FC<{ s: SceneDef; first: boolean; last: boolean; ov: number; Visual: React.FC<SceneProps> }> = ({ s, first, last, ov, Visual }) => {
  const o = useFade(s, first, last, ov);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Visual dur={s.duration} g={s.groups.map((g) => g.at)} />
      {s.kind !== "title" && s.kind !== "end" && s.groups.some((g) => !g.hidden) ? <TextShade strength={s.shade ?? 1} /> : null}
    </AbsoluteFill>
  );
};

const TextLayer: React.FC<{ s: SceneDef; t: Timing; first: boolean; last: boolean; ov: number }> = ({ s, t, first, last, ov }) => {
  const o = useFade(s, first, last && s.kind !== "end", ov);
  const book = s.book ?? t.book ?? "GENESIS";
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {s.kind === "title" ? <TitleCard label={t.label} title={t.title} titleV={t.titleV} sub={t.sub} dur={s.duration} /> : null}
      {s.kind === "end" ? <EndCard label={t.label} title={t.endTitle ?? t.title} titleV={t.endTitleV ?? t.titleV} next={t.next} dur={s.duration} /> : null}
      {s.kind !== "title" && s.kind !== "end" && s.ref ? <VerseRef text={`${book} ${s.ref}`} /> : null}
      {s.kind !== "title" && s.kind !== "end" ? <VerseText groups={s.groups} gold={s.gold} /> : null}
    </AbsoluteFill>
  );
};

/** The whole film: scene visuals with crossfades, then vignette and grain, then text ABOVE them (never dimmed). */
export const Film: React.FC<{ audio: boolean; timing: Timing; visuals: Record<string, React.FC<SceneProps>> }> = ({ audio, timing, visuals }) => {
  const scenes = withStarts(timing);
  const ov = timing.overlap;
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, overflow: "hidden" }}>
      {scenes.map((s, i) => {
        const Visual = visuals[s.id];
        if (!Visual) throw new Error(`No visual for scene "${s.id}"`);
        return (
          <Sequence key={`v${s.id}`} name={s.id} from={s.start} durationInFrames={s.duration}>
            <VisualLayer s={s} first={i === 0} last={i === scenes.length - 1} ov={ov} Visual={Visual} />
          </Sequence>
        );
      })}
      <Vignette strength={0.5} />
      <Grain opacity={0.04} />
      {scenes.map((s, i) => (
        <Sequence key={`t${s.id}`} name={`${s.id} text`} from={s.start} durationInFrames={s.duration}>
          <TextLayer s={s} t={timing} first={i === 0} last={i === scenes.length - 1} ov={ov} />
        </Sequence>
      ))}
      {audio ? <Audio src={staticFile("score.wav")} /> : null}
    </AbsoluteFill>
  );
};

/** Full-frame SVG layer sized to the composition (for overlays outside the depth bands). */
export const Svg: React.FC<{ style?: CSSProperties; children?: React.ReactNode }> = ({ style, children }) => {
  const { W, H } = useLayout();
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", ...style }}>
      {children}
    </svg>
  );
};
