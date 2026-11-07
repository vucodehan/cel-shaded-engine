// Cel review stills: node scripts/celstills.mjs [--v] [--out=dir] [--sheet=name] Comp:frame | @scene:frame ...
// "@son:120" = frame 120 of scene "son" in Film (or FilmVertical with --v). Bundles once, renders each still,
// optionally tiles them into one contact sheet. A workspace-wide lock (_state/stills.lock) keeps parallel
// reviewers from running two Chrome renders at once.
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const vertical = args.includes("--v");
const outDir = path.join(root, args.find((a) => a.startsWith("--out="))?.slice(6) ?? "out/lab");
const sheet = args.find((a) => a.startsWith("--sheet="))?.slice(8);
const timing = JSON.parse(fs.readFileSync(path.join(root, "src/timing.json"), "utf8"));
const starts = {};
let t = 0;
for (const s of timing.scenes) {
  starts[s.id] = t;
  t += s.duration - timing.overlap;
}
const jobs = args.filter((a) => !a.startsWith("--")).map((a) => {
  if (a.startsWith("@")) {
    const [id, fr] = a.slice(1).split(":");
    if (!(id in starts)) throw new Error(`unknown scene ${id}`);
    return [vertical ? "FilmVertical" : "Film", starts[id] + Number(fr ?? 0), `${vertical ? "v-" : ""}${id}-${fr}`];
  }
  const [id, fr] = a.split(":");
  return [id, Number(fr ?? 0), `${id}-${fr}`];
});
fs.mkdirSync(outDir, { recursive: true });

const lock = path.resolve(root, "..", "_state", "stills.lock");
fs.mkdirSync(path.dirname(lock), { recursive: true });
const t0 = Date.now();
for (;;) {
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
    break;
  } catch (err) {
    if (err?.code !== "EEXIST") throw err;
    let alive = true;
    try {
      const pid = Number(fs.readFileSync(lock, "utf8"));
      if (pid) process.kill(pid, 0);
    } catch (e) {
      alive = e?.code === "EPERM";
    }
    const age = (() => { try { return Date.now() - fs.statSync(lock).mtimeMs; } catch { return 0; } })();
    if (!alive || age > 15 * 60 * 1000) { try { fs.unlinkSync(lock); } catch {} continue; }
    if (Date.now() - t0 > 30 * 60 * 1000) throw new Error("stills lock busy for 30 min");
    await new Promise((r) => setTimeout(r, 3000));
  }
}
const release = () => { try { if (fs.readFileSync(lock, "utf8") === String(process.pid)) fs.unlinkSync(lock); } catch {} };
process.on("exit", release);
try {
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
  // --qa: the engine's geometry check reports coplanar faces once per shot ([qa] lines under the still)
  const inputProps = { audio: false, qa: args.includes("--qa") };
  const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } });
  const comps = {};
  const outs = [];
  for (const [id, frame, name] of jobs) {
    comps[id] ??= await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });
    const output = path.join(outDir, `${name}.jpg`);
    const t1 = Date.now();
    const logs = new Set();
    // engine messages ([contact], [engine], [turn], ...) and browser errors are printed under the still
    const onBrowserLog = (l) => { if (/^\[(contact|engine|turn|qa)\]/.test(l.text) || l.type === "error") logs.add(l.text); };
    await renderStill({ composition: comps[id], serveUrl, output, frame, inputProps, imageFormat: "jpeg", jpegQuality: 90, puppeteerInstance: browser, overwrite: true, onBrowserLog });
    console.log(`${name} (frame ${frame}) ${Date.now() - t1}ms`);
    for (const l of logs) console.log(`    ${l}`);
    outs.push(output);
  }
  await browser.close({ silent: true });
  if (sheet) execFileSync("python", [path.join(root, "scripts", "sheet.py"), path.join(outDir, `${sheet}.jpg`), ...outs], { stdio: "inherit" });
} finally {
  release();
}
