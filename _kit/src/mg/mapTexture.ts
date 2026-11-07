/**
 * A map on a 3D prop: mapProp() builds a sheet (flat on a table, or on a wall) or a scroll with rollers, its map drawn
 * by drawMap into a canvas texture and laid on as a toon decal, so it takes the shot's key light and shadow bands
 * like every other surface. Default palette "ink" (brown ink on parchment); "gold" gives a dark sheet with gold
 * lines (a glowing vision or a war-table map). Redraw per frame with prop.draw(spec): only when the spec changes.
 *
 *   const m = mapProp({ w: 1.0, h: 0.66, kind: "sheet" });
 *   m.group.position.set(0, 0.76, -1);     // on a table top; sheets lie flat (+y up), wall maps stand (+z out)
 *   k.add(m.group);
 *   return (f) => { m.draw({ view: { lon: 35.4, lat: 32.2, span: 2.6 }, draw: 1, pins: [{ at: "jerusalem", a: 1 }] }); ... };
 *
 * Wrap the scene in <MapFontsGate> so Cinzel is loaded before the first texture is drawn.
 */
import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { mesh, toon } from "../cel/toon";
import { MapSpec, drawMap, projector } from "./map";
import { useMapFonts } from "./fonts";
import { LL, placeLL } from "./places";

export type MapProp = {
  group: THREE.Group;
  sheet: THREE.Mesh;
  texture: THREE.CanvasTexture;
  draw: (spec: MapSpec) => void;
  /** world position of a place on the drawn map (for reach / lookAt): pointOn(spec, "jerusalem") */
  pointOn: (spec: MapSpec, at: string | LL) => THREE.Vector3;
};

export function mapProp(o: { w?: number; h?: number; kind?: "sheet" | "wall" | "scroll"; px?: number; paper?: string; palette?: "ink" | "gold" } = {}): MapProp {
  const w = o.w ?? 1.0, h = o.h ?? 0.66;
  const kind = o.kind ?? "sheet";
  const palette = o.palette ?? "ink";
  const px = o.px ?? 2048;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = Math.round((px * h) / w);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  const paper = o.paper ?? (palette === "ink" ? "#e6d6b4" : "#141a22");
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  // The decal only lands where object-space z > 0.
  geo.translate(0, 0, 0.0006);
  const mat = toon({ color: paper, th: 0.42, decal: { tex: texture, rect: [0, 0, w, h], shade: 0.8 }, depthLines: true, side: THREE.DoubleSide });
  const sheet = mesh(geo, mat, { hull: false });
  const group = new THREE.Group();
  const holder = new THREE.Group();
  holder.add(sheet);
  if (kind === "sheet") holder.rotation.x = -Math.PI / 2;
  if (kind === "scroll") {
    holder.rotation.x = -Math.PI / 2;
    const wood = toon({ color: "#7a5434", th: 0.5 });
    for (const sx of [-1, 1]) {
      const roll = mesh(new THREE.CylinderGeometry(0.028, 0.028, h * 1.08, 14), toon({ color: paper, th: 0.45 }), { hull: { width: 2.2 } });
      roll.position.set((sx * w) / 2, 0.026, 0);
      roll.rotation.x = Math.PI / 2;
      group.add(roll);
      for (const sz of [-1, 1]) {
        const knob = mesh(new THREE.SphereGeometry(0.02, 10, 8), wood, { hull: { width: 2 } });
        knob.position.set((sx * w) / 2, 0.026, (sz * h * 1.08) / 2 + sz * 0.012);
        group.add(knob);
      }
    }
  }
  group.add(holder);
  const ctx = canvas.getContext("2d")!;
  let last = "";
  const draw = (spec: MapSpec) => {
    const key = JSON.stringify(spec);
    if (key === last) return;
    last = key;
    // Props are seen from a few metres: lines and names drawn about twice the size of a full-frame insert.
    drawMap(ctx, canvas.width, canvas.height, { palette, ground: palette === "gold", scale: (canvas.height / 1080) * 2.2, ...spec });
    texture.needsUpdate = true;
  };
  const pointOn = (spec: MapSpec, at: string | LL) => {
    const [x, y] = projector(spec, canvas.width, canvas.height).xy(placeLL(at));
    group.updateMatrixWorld(true);
    return sheet.localToWorld(new THREE.Vector3((x / canvas.width - 0.5) * w, (0.5 - y / canvas.height) * h, 0.001));
  };
  return { group, sheet, texture, draw, pointOn };
}

/** Renders its children once the map fonts are loaded, and holds the frame until they have drawn. */
export const MapFontsGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, release] = useMapFonts();
  useLayoutEffect(() => {
    if (ready) release();
  });
  return ready ? React.createElement(React.Fragment, null, children) : null;
};
