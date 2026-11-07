// Which GPU does the render browser's WebGL use? node scripts/gpuinfo.mjs
import { openBrowser } from "@remotion/renderer";

const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } });
const page = await browser.newPage(() => null, () => null);
const info = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return "no webgl2";
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  return { vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "?", renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "?", maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
});
console.log(JSON.stringify(info));
await browser.close({ silent: true });
