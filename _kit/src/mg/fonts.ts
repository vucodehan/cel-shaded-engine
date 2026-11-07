import { useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";

const cinzel = loadCinzel("normal", { weights: ["600", "700"], subsets: ["latin"] });
const cormorantI = loadCormorant("italic", { weights: ["600"], subsets: ["latin"] });

export const MAP_FONT = { display: cinzel.fontFamily, serif: cormorantI.fontFamily };

let loaded = false;
export const mapFontsReady: Promise<void> = Promise.all([cinzel.waitUntilDone(), cormorantI.waitUntilDone()]).then(() => {
  loaded = true;
});

/**
 * Canvas text does not wait for web fonts: the first frame a browser tab renders could draw Cinzel in a fallback
 * font. Returns [ready, release]: draw only when ready, then call release() after drawing; the frame is held
 * (delayRender) until then.
 */
export function useMapFonts(): [boolean, () => void] {
  const [handle] = useState(() => (loaded ? null : delayRender("map fonts")));
  const [ready, setReady] = useState(loaded);
  const released = useRef(handle === null);
  useLayoutEffect(() => {
    if (!ready) mapFontsReady.then(() => setReady(true));
  }, [ready]);
  const release = () => {
    if (!released.current && handle !== null) {
      released.current = true;
      continueRender(handle);
    }
  };
  return [ready, release];
}
