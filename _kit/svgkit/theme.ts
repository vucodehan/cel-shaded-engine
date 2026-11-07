import { CSSProperties } from "react";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";

const cinzel = loadCinzel("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const cormorant = loadCormorant("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
loadCormorant("italic", { weights: ["500", "600"], subsets: ["latin"] });

export const fonts = {
  display: cinzel.fontFamily,
  serif: cormorant.fontFamily,
};

export const C = {
  ink: "#03040A",
  night: "#0A1022",
  ivory: "#FCF8EE",
  gold: "#F4C978",
  goldLight: "#FFEBB8",
  goldDeep: "#B8862F",
  god: "#FFE3A0",
  blood: "#B0222A",
  flame: "#FF8E2B",
};

/**
 * Gold leaf for display caps. The line box of Cinzel caps is mostly empty above and below the glyphs,
 * so the bright tones sit where the letters actually are (about 20-80% of the box).
 */
const GOLD =
  "linear-gradient(180deg, #FFFDF4 0%, #FFF4D2 20%, #FFE6A8 38%, #F8D184 54%, #FFE4A6 70%, #FFF3D0 84%, #FFFBEE 100%)";

/** Gold leaf fill for text; `sweep` (0..1) runs a specular highlight across it. */
export const goldText = (sweep?: number): CSSProperties => {
  const s = sweep === undefined ? -1 : sweep * 160 - 30;
  return {
    backgroundImage:
      sweep === undefined
        ? GOLD
        : `linear-gradient(105deg, rgba(255,255,255,0) ${s - 14}%, rgba(255,255,255,0.95) ${s}%, rgba(255,255,255,0) ${s + 14}%), ${GOLD}`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };
};

/** Warm glow plus a tight dark edge, so gold reads on bright skies as well as on night. */
export const goldGlow = "drop-shadow(0 0 1px rgba(255,240,200,0.6)) drop-shadow(0 0 18px rgba(255,196,110,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.55))";

/** The divine name LORD in small caps, as printed in English Bibles. */
export const lordStyle: CSSProperties = {
  fontFamily: cinzel.fontFamily,
  fontSize: "0.76em",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "#FFE3A0",
  textShadow: "0 0 16px rgba(255,200,120,0.5), 0 2px 14px rgba(0,0,0,0.65)",
};

export const godStyle: CSSProperties = {
  color: "#FFE3A0",
  textShadow: "0 0 16px rgba(255,200,120,0.5), 0 2px 18px rgba(0,0,0,0.65)",
};
