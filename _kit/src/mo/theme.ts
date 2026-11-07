/**
 * House motion-design look (frozen from the earlier motion-design films): ink-navy grounds, gold leaf, Cinzel caps,
 * Cormorant Garamond serif.
 */
import { CSSProperties } from "react";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";

const cinzel = loadCinzel("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const cormorant = loadCormorant("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadCormorant("italic", { weights: ["400", "500"], subsets: ["latin"] });

export const fonts = { display: cinzel.fontFamily, serif: cormorant.fontFamily };

export const C = {
  ink: "#03040A",
  night: "#0A1022",
  ivory: "#F4EEE3",
  ivoryDim: "rgba(244,238,227,0.72)",
  gold: "#E3B860",
  goldLight: "#FFE6A6",
  goldDeep: "#9C7230",
  crimson: "#7D1418",
  blood: "#D2303A",
  marianLight: "#B4D0F6",
  peace: "#CFE2FF",
  flame: "#FF8E2B",
};

const GOLD = "linear-gradient(180deg, #FFF6D8 0%, #F3D27F 28%, #D9A54E 55%, #A8762F 78%, #EBC877 100%)";

/** Gold leaf fill for text; `sweep` (0..1) runs a specular highlight across it. */
export const goldText = (sweep?: number): CSSProperties => {
  const s = sweep === undefined ? -1 : sweep * 160 - 30;
  return {
    backgroundImage:
      sweep === undefined
        ? GOLD
        : `linear-gradient(105deg, rgba(255,255,255,0) ${s - 14}%, rgba(255,252,240,0.95) ${s}%, rgba(255,255,255,0) ${s + 14}%), ${GOLD}`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };
};

/** Small-caps rendering of the divine name LORD, as printed in English Bibles. */
export const lordStyle: CSSProperties = { fontFamily: cinzel.fontFamily, fontSize: "0.74em", fontWeight: 600, letterSpacing: "0.06em" };
