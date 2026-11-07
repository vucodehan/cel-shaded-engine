import React, { useMemo } from "react";
import * as THREE from "three";
import { Cuts } from "../cel/Shot";
import { SceneProps } from "../CelFilm";
import { CAST, crowdLook } from "../cel/cast";
import { Human, blinkAt } from "../cel/human";
import { V3, lerp } from "../cel/geo";
import { ease, keys, seg, stepped } from "../cel/cam";
import { grass } from "../cel/world";
import { galilee, shot, timeline, walkTo } from "./common";

const lane = (x: number) => 2 - x * 0.35;
const A: [number, number] = [-14, lane(-14)], B: [number, number] = [14, lane(14)];

/** Title: EWS of the Galilean hills above the sea at dawn; a lone figure on the path, backlit. */
export const TitleShot = shot("dawn", (k) => {
  const set = galilee(k, { seed: 3, sea: true, seaZ: -70, path: lane, grass: 2500 });
  const j = k.add(new Human(CAST.JESUS, { detail: "mid" }));
  return (f) => {
    walkTo(j, stepped(f), [-6, lane(-6)], [6, lane(6)], { h: set.h, speed: 0.9 });
    const t = f / 195;
    k.cam({ target: V3(0, 3, -12), size: lerp(70, 58, ease.sine(t)), pitch: lerp(9, 6, t), yaw: 0, lens: 30, sy: k.p(-0.05, -0.12) });
  };
});

const IntroA = shot("dawn", (k) => {
  const set = galilee(k, { seed: 3, sea: true, seaZ: -70, path: lane, grass: 3000 });
  const j = k.add(new Human(CAST.JESUS, { detail: "mid" }));
  return (f) => {
    walkTo(j, stepped(f), [-9, lane(-9)], B, { h: set.h });
    k.cam({ target: j.point("hips").add(V3(0, 0.6, 0)), size: lerp(26, 20, f / 230), yaw: -48, pitch: 7, lens: 32, facing: 110, sx: k.p(-0.28, 0), sy: k.p(-0.2, -0.3) });
  };
});

const IntroB = shot("dawn", (k) => {
  const set = galilee(k, { seed: 3, sea: true, seaZ: -70, path: lane, grass: 4000 });
  const j = k.add(new Human(CAST.JESUS));
  return (f) => {
    const fs = stepped(f);
    walkTo(j, fs, [-2, lane(-2)], B, { h: set.h });
    j.expr({ blink: blinkAt(fs, 1), light: -1, smile: 0.15 });
    k.cam({ target: j.point("chest").add(V3(0, 0.1, 0)), size: "MS", yaw: 32, pitch: 2, lens: 55, facing: 110, sx: k.p(0.3, 0), sy: k.p(0.15, 0.25) });
    k.key(42, 24);
  };
}, { post: () => ({ dof: 0.6, focus: 3, focusRange: 10 }) });

const IntroC = shot("dawn", (k) => {
  const set = galilee(k, { seed: 5, flat: [0, 0, 8], grass: 4000, trees: [[-7, -9, 1.2], [8, -12, 1.3]] });
  const kinds = ["man", "woman", "elder", "child", "man", "woman", "man"] as const;
  const people = kinds.map((kd, i) => k.add(new Human(crowdLook(40 + i, kd), { detail: "mid" })));
  const spots: [number, number, number][] = [[-2.6, -1.0, 40], [-1.4, -0.2, 25], [-0.2, -1.4, 15], [1.0, -0.4, 0], [2.2, -1.2, -15], [3.0, 0.2, -30], [0.4, 0.9, 10]];
  return (f) => {
    const fs = stepped(f);
    const look = V3(-6, 1.6, 7);
    people.forEach((p, i) => {
      const [x, z, yaw] = spots[i];
      p.place(x, z, yaw - 35, set.h(x, z));
      p.pose({ head: [-4, 0, 0], shL: [6, 0, 6], shR: [6, 0, 6], elL: [16, 0, 0], elR: [16, 0, 0] });
      p.lookAt(look, 1);
      p.expr({ blink: blinkAt(fs, i * 3), smile: 0.25, light: 1, lookX: -0.4 });
    });
    k.cam({ target: V3(0.3, 1.2 + set.h(0, 0), -0.3), size: "WS", yaw: lerp(-18, -10, f / 270), pitch: 2, lens: 40, sy: k.p(0.05, 0) });
  };
}, { post: () => ({ dof: 0.4, focus: 7, focusRange: 12 }) });

const IntroD = shot("dawn", (k) => {
  const set = galilee(k, { seed: 3, sea: true, seaZ: -70, path: lane, grass: 5000 });
  const j = k.add(new Human(CAST.JESUS));
  return (f) => {
    walkTo(j, stepped(f), [-3, lane(-3)], B, { h: set.h, speed: 0.95 });
    const ft = j.point("footL").lerp(j.point("footR"), 0.5);
    k.cam({ target: ft.add(V3(0, 0.12, 0)), size: 0.75, yaw: 92, pitch: 4, lens: 50, facing: 110, sy: 0.1 });
  };
}, { post: () => ({ dof: 0.9, focus: 1.6, focusRange: 1.8 }) });

const IntroE = shot("dawn", (k) => {
  const set = galilee(k, { seed: 3, sea: true, seaZ: -70, path: lane, grass: 2000 });
  k.add(grass({ n: 2600, area: [-6, -2, 10, 2.5], h: set.h, seed: 8, size: 2.6, color: "#c8b878", keep: (x, z) => z < lane(x) - 0.65 }));
  const j = k.add(new Human(CAST.JESUS));
  return (f) => {
    const fs = stepped(f);
    walkTo(j, fs, [-3, lane(-3)], B, { h: set.h, speed: 0.8, base: { shL: [8, 0, 26], elL: [24, 0, 0], wrL: [0, 0, -18], handL: "open" } });
    k.cam({ target: j.point("handL"), size: 0.55, yaw: -78, pitch: 6, lens: 60, facing: 110, sx: k.p(0.15, 0) });
  };
}, { post: () => ({ dof: 0.9, focus: 1.1, focusRange: 1.4 }) });

const IntroF = shot("dawn", (k) => {
  const set = galilee(k, { seed: 3, sea: true, seaZ: -70, path: lane, grass: 3000 });
  const j = k.add(new Human(CAST.JESUS));
  j.place(2, lane(2), 110, set.h(2, lane(2)));
  return (f) => {
    const fs = stepped(f);
    const turn = ease.inOut(seg(fs, 30, 70));
    j.pose({ chest: [1, lerp(0, -18, turn), 0], neck: [0, lerp(0, -20, turn), 0], head: [lerp(0, 3, turn), lerp(0, -38, turn), lerp(0, 4, turn)] });
    j.expr({ blink: fs > 26 && fs < 34 ? 0.9 : blinkAt(fs, 2), smile: lerp(0.1, 0.5, ease.out(seg(fs, 60, 110))), lookX: lerp(0.4, 0.05, turn), light: 1 });
    const push = ease.sine(seg(f, 0, 226));
    k.cam({ target: j.point("eyes"), size: lerp(0.42, 0.24, push), yaw: lerp(-14, -20, push), pitch: 1, lens: 85, facing: 110 - 38, sx: k.p(0.22, 0), sy: k.p(0.05, 0.12) });
    k.key(36, 20);
  };
}, { post: () => ({ dof: 0.85, focus: 1.6, focusRange: 5 }), shadow: { center: V3(2, 1.6, 1.3), size: 1.4 } });

export const Title: React.FC<SceneProps> = ({ dur }) => {
  const shots = useMemo(() => timeline(dur, [[0, TitleShot]]), [dur]);
  return <Cuts shots={shots} />;
};

export const Intro: React.FC<SceneProps> = ({ dur, g }) => {
  const shots = useMemo(() => timeline(dur, [[0, IntroA], [g[1] - 6, IntroB], [g[1] + 140, IntroC], [g[2] - 6, IntroD], [g[2] + 110, IntroE], [g[3] - 6, IntroF]]), [dur, g.join()]);
  return <Cuts shots={shots} />;
};

void keys;
void THREE;
