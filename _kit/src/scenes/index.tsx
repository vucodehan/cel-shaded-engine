import React from "react";
import { SceneProps } from "../CelFilm";
import { Placeholder } from "./placeholder";

// The kit's own sandbox film (src/timing.json) so Lab, KitLab and MapLab render from _kit with scripts/celstills.mjs.
// Films get their own index from scaffold.py.
export const VISUALS: Record<string, React.FC<SceneProps>> = {
  title: (p) => <Placeholder {...p} id="title" />,
  end: (p) => <Placeholder {...p} id="end" />,
};
