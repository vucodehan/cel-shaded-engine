import React from "react";
import { AbsoluteFill } from "remotion";
import { Shot } from "../cel/Shot";
import { SceneProps } from "../CelFilm";
import { CAST } from "../cel/cast";
import { Human, blinkAt } from "../cel/human";
import { V3 } from "../cel/geo";
import { stepped } from "../cel/cam";
import { galilee, shot } from "./common";

const PH = shot("day", (k) => {
  const set = galilee(k, { seed: 9 });
  const j = k.add(new Human(CAST.JESUS, { detail: "mid" }));
  j.place(0, 0, 0, set.h(0, 0));
  return (f) => {
    j.expr({ blink: blinkAt(stepped(f), 1) });
    k.cam({ target: V3(0, 1.2 + set.h(0, 0), 0), size: "WS", yaw: 20, pitch: 4, lens: 35 });
  };
});

export const Placeholder: React.FC<SceneProps & { id: string }> = ({ id }) => (
  <AbsoluteFill>
    <Shot def={PH} />
    <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", color: "#fff", fontSize: 60, fontFamily: "sans-serif", textShadow: "0 0 8px #000" }}>TODO: {id}</div>
  </AbsoluteFill>
);
