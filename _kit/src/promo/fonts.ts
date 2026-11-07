/**
 * Bundled OFL fonts (public/fonts/<family>/, each with its OFL.txt), loaded with FontFace from staticFile, so no
 * network is needed at render time. Importing the kit starts the load and holds the render (delayRender) until every
 * face is in; a missing file cancels the render with its name.
 *   DOM / SVG:  style={{ fontFamily: family("ui"), fontWeight: 600 }}
 *   canvas:     ctx.font = font("ui", 17, 600)
 * Components that measure or draw text call useFonts() and wait for `true`.
 */
import { useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

export const FONT = {
  /** UI sans, the closest free match to the phone's system font (variable wght 100-900, opsz) */
  ui: "Inter",
  /** geometric display sans (wght 100-900) */
  display: "Outfit",
  /** friendly rounded sans (wght 200-1000) */
  rounded: "Nunito",
  /** neutral grotesk for taglines and end cards (wght 400-700, wdth 75-100) */
  grotesk: "Instrument Sans",
  /** display serif, regular and italic only (wght 400) */
  serif: "Instrument Serif",
} as const;
export type FontRole = keyof typeof FONT;

type Face = { family: string; file: string; weight: string; style?: "normal" | "italic"; stretch?: string };
const FACES: Face[] = [
  { family: FONT.ui, file: "inter/Inter-Var.ttf", weight: "100 900" },
  { family: FONT.ui, file: "inter/Inter-Italic-Var.ttf", weight: "100 900", style: "italic" },
  { family: FONT.display, file: "outfit/Outfit-Var.ttf", weight: "100 900" },
  { family: FONT.rounded, file: "nunito/Nunito-Var.ttf", weight: "200 1000" },
  { family: FONT.rounded, file: "nunito/Nunito-Italic-Var.ttf", weight: "200 1000", style: "italic" },
  { family: FONT.grotesk, file: "instrumentsans/InstrumentSans-Var.ttf", weight: "400 700", stretch: "75% 100%" },
  { family: FONT.grotesk, file: "instrumentsans/InstrumentSans-Italic-Var.ttf", weight: "400 700", style: "italic", stretch: "75% 100%" },
  { family: FONT.serif, file: "instrumentserif/InstrumentSerif-Regular.ttf", weight: "400" },
  { family: FONT.serif, file: "instrumentserif/InstrumentSerif-Italic.ttf", weight: "400", style: "italic" },
];

let ready = false;
let loading: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  if (loading) return loading;
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    ready = true;
    return (loading = Promise.resolve());
  }
  const handle = delayRender("promo kit fonts", { timeoutInMilliseconds: 60000 });
  loading = Promise.all(
    FACES.map(async (f) => {
      const url = staticFile(`fonts/${f.file}`);
      const face = new FontFace(f.family, `url("${url}") format("truetype")`, {
        weight: f.weight,
        style: f.style ?? "normal",
        stretch: f.stretch ?? "100%",
      });
      try {
        await face.load();
      } catch {
        throw new Error(`promo kit: font file public/fonts/${f.file} did not load (copy _kit/public/fonts into the project)`);
      }
      (document.fonts as unknown as { add(f: FontFace): void }).add(face);
    }),
  ).then(
    () => {
      ready = true;
      continueRender(handle);
    },
    (e) => cancelRender(e),
  );
  return loading;
}
loadFonts();

export const fontsLoaded = () => ready;

/** true once every kit font is loaded; until then the frame is held, and released only after the re-render. */
export function useFonts(): boolean {
  const [ok, setOk] = useState(ready);
  const [handle] = useState(() => (ready ? null : delayRender("promo kit fonts (component)")));
  const released = useRef(handle === null);
  const release = () => {
    if (!released.current && handle !== null) {
      released.current = true;
      continueRender(handle);
    }
  };
  useEffect(() => {
    if (!ok) loadFonts().then(() => setOk(true));
  }, [ok]);
  useEffect(() => {
    if (ok) release();
  });
  useEffect(() => release, []);
  return ok;
}

const nameOf = (role: FontRole | string) => (FONT as Record<string, string>)[role] ?? role;

/** CSS font-family list for a role (or any family name), with the UI sans and system fallbacks. */
export const family = (role: FontRole | string) => `"${nameOf(role)}", "Inter", system-ui, sans-serif`;

/** Canvas / CSS `font` shorthand. Sizes are in the context's current units (screen points inside a phone). */
export const font = (role: FontRole | string, size: number, weight: number | string = 400, italic = false) =>
  `${italic ? "italic " : ""}${weight} ${size}px ${family(role)}`;
