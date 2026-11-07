import React, { useMemo } from "react";
import { Cuts } from "../cel/Shot";
import { SceneProps } from "../CelFilm";
import { CAST } from "../cel/cast";
import { Human, blinkAt } from "../cel/human";
import { V3, lerp } from "../cel/geo";
import { ease, seg, stepped } from "../cel/cam";
import { stoneJar } from "../cel/props";
import { galilee, nazareth, shot, timeline, walkTo, workshop } from "./common";

const lane = (x: number) => x * 0.15;

const SonA = shot("golden", (k) => {
  const set = nazareth(k, { lane });
  const fam = [k.add(new Human(CAST.JOSEPH, { detail: "mid" })), k.add(new Human(CAST.MARY, { detail: "mid" })), k.add(new Human(CAST.JESUS_BOY, { detail: "mid" }))];
  return (f) => {
    const fs = stepped(f);
    fam.forEach((p, i) => walkTo(p, fs, [-8 - i * 1.1, lane(-8) + (i - 1) * 0.6], [10, lane(10) + (i - 1) * 0.6], { h: set.h, speed: 0.85 }));
    k.cam({ target: V3(-4 + f * 0.012, 2.5 + set.h(-4, 0), 0), size: 30, yaw: lerp(-28, -20, f / 190), pitch: 12, lens: 32, sx: k.p(-0.1, 0), sy: k.p(-0.15, -0.2) });
  };
});

/** Mary hands the boy a water jar; he takes it with both hands. */
const SonB = shot("golden", (k) => {
  const set = nazareth(k, { lane });
  const mary = k.add(new Human(CAST.MARY));
  const boy = k.add(new Human(CAST.JESUS_BOY));
  const jos = k.add(new Human(CAST.JOSEPH, { detail: "mid" }));
  const jar = stoneJar({ h: 0.42 });
  jar.group.scale.setScalar(0.62);
  k.add(jar.group);
  mary.place(-0.55, 0, 90, set.h(-0.55, 0));
  boy.place(0.5, 0, -90, set.h(0.5, 0));
  jos.place(-1.6, -1.6, 60, set.h(-1.6, -1.6));
  return (f) => {
    const fs = stepped(f);
    const give = ease.inOut(seg(fs, 10, 50));
    const take = ease.inOut(seg(fs, 46, 80));
    const jarPos = V3(lerp(-0.25, 0.05, give), set.h(0, 0) + lerp(0.92, 1.0, give) - take * 0.12, 0);
    jar.group.position.copy(jarPos).add(V3(0, -0.12, 0));
    mary.pose({ chest: [lerp(2, 8, give), 0, 0], head: [8, 0, 0], handL: "hold", handR: "hold" });
    mary.reach("L", jarPos.clone().add(V3(0, 0.08, 0.13)), V3(0, -1, 0), 1 - take * 0.85);
    mary.reach("R", jarPos.clone().add(V3(0, 0.08, -0.13)), V3(0, -1, 0), 1 - take * 0.85);
    mary.expr({ smile: 0.55, blink: blinkAt(fs, 4), lookY: -0.4, light: -1 });
    boy.pose({ head: [lerp(-10, -14, take), 0, 0], handL: "hold", handR: "hold" });
    boy.reach("L", jarPos.clone().add(V3(0.1, -0.02, -0.11)), V3(0, -1, 0), seg(fs, 40, 60));
    boy.reach("R", jarPos.clone().add(V3(0.1, -0.02, 0.11)), V3(0, -1, 0), seg(fs, 40, 60));
    boy.expr({ smile: lerp(0.3, 0.75, take), blink: blinkAt(fs, 9), lookY: 0.5, light: 1, squint: take * 0.3 });
    jos.pose({ head: [4, 0, 0], shL: [10, 0, 6], shR: [10, 0, 6] });
    jos.lookAt(boy.point("head"), 0.8);
    jos.expr({ smile: 0.35, blink: blinkAt(fs, 7) });
    k.cam({ target: V3(k.p(0, 0.15), set.h(0, 0) + k.p(1.2, 1.05), 0), size: k.portrait ? 1.35 : "MS", yaw: k.p(8, 52), pitch: 3, lens: 50, sy: k.p(0.05, 0.12) });
    k.key(30, 30);
  };
}, { post: () => ({ dof: 0.5, focus: 3, focusRange: 6 }), shadow: { center: V3(0, 1, 0), size: 2 } });

const SonC = shot("golden", (k) => {
  const set = nazareth(k, { lane });
  const boy = k.add(new Human(CAST.JESUS_BOY));
  boy.place(0.3, 0, -90, set.h(0.3, 0));
  const mary = k.add(new Human(CAST.MARY, { detail: "mid" }));
  mary.place(-0.6, 0.2, 90, set.h(-0.6, 0.2));
  return (f) => {
    const fs = stepped(f);
    boy.pose({ head: [-12, 0, 0], shL: [30, 0, 8], shR: [30, 0, 8], elL: [70, 0, 0], elR: [70, 0, 0], handL: "hold", handR: "hold" });
    boy.expr({ smile: 0.7, blink: blinkAt(fs, 11), lookY: 0.6, lookX: -0.2, light: 1 });
    mary.pose({ head: [10, 0, 0] });
    k.cam({ target: boy.point("eyes"), size: "CU", yaw: -30, pitch: 4, lens: 85, facing: -90, sx: k.p(0.2, 0), sy: k.p(0.05, 0.1) });
    k.key(40, 24);
  };
}, { post: () => ({ dof: 0.8, focus: 1.4, focusRange: 4 }), shadow: { center: V3(0.3, 1.1, 0), size: 1.2 } });

/** Match cut: the boy, then the man, in the same workshop doorway (light behind). */
const doorway = (grown: boolean) =>
  shot("golden", (k) => {
    galilee(k, { seed: 6, flat: [0, 0, 16], zero: true, grass: 0, trees: [[-14, -6, 1.2], [-18, 5, 1.3], [-24, -14, 1.1]] });
    workshop(k);
    const who = k.add(new Human(grown ? CAST.JESUS_WORK : CAST.JESUS_BOY));
    who.place(-3.2, -1.6, 90, 0);
    return (f) => {
      const fs = stepped(f);
      who.pose({ head: [4, 0, 0], shR: [6, 0, 8], shL: [6, 0, 8], handL: "relax", handR: "relax" });
      who.expr({ blink: blinkAt(fs, grown ? 3 : 5), smile: 0.3, light: 1 });
      const push = ease.sine(seg(f, 0, 140));
      k.cam({ target: V3(-3.2, grown ? 1.05 : 0.85, -1.6), size: lerp(3.0, 2.4, push), yaw: 0, pitch: 3, lens: 35, facing: 90, sy: k.p(0.0, 0.08) });
      k.env({ light: V3(-0.9, 0.38, 0.15), lightCol: "#ffe6bc", rimAmt: 1.1, rim: V3(-0.95, 0.25, 0.1), fogAmt: 0.4 });
    };
  }, { post: () => ({ bloom: 0.55, bloomT: 0.8, rays: 0 }) });
const SonD1 = doorway(false), SonD2 = doorway(true);

export const Son: React.FC<SceneProps> = ({ dur, g }) => {
  const shots = useMemo(() => timeline(dur, [[0, SonA], [g[1] - 6, SonB], [g[1] + 95, SonC], [g[2] - 6, SonD1], [g[2] + 95, SonD2]]), [dur, g.join()]);
  return <Cuts shots={shots} />;
};
