import React from "react";
import { Composition } from "remotion";
import timing from "./timing.json";
import { CelFilm, Timing, totalFrames } from "./CelFilm";
import { VISUALS } from "./scenes";
import { Lab } from "./Lab";
import { KitLab } from "./KitLab";
import { MapLab } from "./MapLab";
import { HandLab } from "./HandLab";
import { MoLab } from "./MoLab";

const T = timing as unknown as Timing;
const Main: React.FC<{ audio: boolean }> = ({ audio }) => <CelFilm audio={audio} timing={T} visuals={VISUALS} />;

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Main} durationInFrames={totalFrames(T)} fps={T.fps} width={T.width} height={T.height} defaultProps={{ audio: true }} />
    <Composition id="FilmVertical" component={Main} durationInFrames={totalFrames(T)} fps={T.fps} width={T.height} height={T.width} defaultProps={{ audio: true }} />
    {[0, 1, 2, 3, 4, 5].map((v) => (
      <React.Fragment key={`k${v}`}>
        <Composition id={`Kit${v}`} component={KitLab} durationInFrames={120} fps={30} width={1920} height={1080} defaultProps={{ v }} />
        <Composition id={`KitV${v}`} component={KitLab} durationInFrames={120} fps={30} width={1080} height={1920} defaultProps={{ v }} />
      </React.Fragment>
    ))}
    {[0, 1, 2, 3].map((v) => (
      <React.Fragment key={`h${v}`}>
        <Composition id={`HandLab${v}`} component={HandLab} durationInFrames={160} fps={30} width={1920} height={1080} defaultProps={{ v }} />
        <Composition id={`HandLabV${v}`} component={HandLab} durationInFrames={160} fps={30} width={1080} height={1920} defaultProps={{ v }} />
      </React.Fragment>
    ))}
    {[0, 1].map((v) => (
      <React.Fragment key={`mo${v}`}>
        <Composition id={`MoLab${v}`} component={MoLab} durationInFrames={180} fps={30} width={1920} height={1080} defaultProps={{ v }} />
        <Composition id={`MoLabV${v}`} component={MoLab} durationInFrames={180} fps={30} width={1080} height={1920} defaultProps={{ v }} />
      </React.Fragment>
    ))}
    {[0, 1, 2].map((v) => (
      <React.Fragment key={`m${v}`}>
        <Composition id={`MapLab${v}`} component={MapLab} durationInFrames={180} fps={30} width={1920} height={1080} defaultProps={{ v }} />
        <Composition id={`MapLabV${v}`} component={MapLab} durationInFrames={180} fps={30} width={1080} height={1920} defaultProps={{ v }} />
      </React.Fragment>
    ))}
    {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
      <React.Fragment key={v}>
        <Composition id={`Lab${v}`} component={Lab} durationInFrames={120} fps={30} width={1920} height={1080} defaultProps={{ v }} />
        <Composition id={`LabV${v}`} component={Lab} durationInFrames={120} fps={30} width={1080} height={1920} defaultProps={{ v }} />
      </React.Fragment>
    ))}
  </>
);
