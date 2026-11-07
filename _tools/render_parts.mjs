// Picture-only part renders for one film, several at once: node render_parts.mjs <jobs.json>
// jobs.json: { root, render: {parallel, tabs, image_format, jpeg_quality, encoder, video_bitrate, x264_crf, gl, stall_s},
//              jobs: [{ id, comp, frameRange: [first, last], out }] }   (written by pipeline.py)
// Bundles once, then runs `parallel` renders, each its own Chrome with `tabs` tabs. Prints one JSON object per line
// (start / progress / warn / retry / done / failed). A render that adds no frames for stall_s is cancelled and
// retried once; an NVENC failure retries that part on x264. Output goes to <out>.partial.mp4 and is renamed when
// complete, so a part file on disk is always whole.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const require = createRequire(path.join(spec.root, "package.json"));
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition, makeCancelSignal } = require("@remotion/renderer");

const R = spec.render;
const say = (o) => console.log(JSON.stringify({ t: new Date().toISOString().slice(11, 19), ...o }));
const inputProps = { audio: false };
const chromiumOptions = { gl: R.gl };

const bundleDir = path.join(os.tmpdir(), `celbundle-${process.pid}`);
let t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.join(spec.root, "src", "index.ts"), outDir: bundleDir });
say({ event: "bundled", sec: (Date.now() - t0) / 1000 });
const comps = {};
for (const id of new Set(spec.jobs.map((j) => j.comp))) {
  comps[id] = await selectComposition({ serveUrl, id, inputProps, chromiumOptions });
}

// NVENC without B-frames: they pulse thin bright lines sharp-soft-sharp, which reads as flicker (flicker_qa.py)
const noBframes = ({ args }) => {
  const i = args.indexOf("h264_nvenc");
  return i < 0 || args.includes("-bf") ? args : [...args.slice(0, i + 1), "-bf", "0", ...args.slice(i + 1)];
};
const encoderOptions = (enc) => (enc === "nvenc" ? { hardwareAcceleration: "required", videoBitrate: R.video_bitrate, ffmpegOverride: noBframes } : { crf: R.x264_crf });

async function renderOnce(job, enc) {
  const { cancelSignal, cancel } = makeCancelSignal();
  const tmp = job.out.replace(/\.mp4$/i, ".partial.mp4");
  const start = Date.now();
  let lastFrames = -1;
  let lastMove = Date.now();
  let lastLog = 0;
  let stalled = false;
  const watch = setInterval(() => {
    if (Date.now() - lastMove > R.stall_s * 1000) {
      stalled = true;
      cancel();
    }
  }, 5000);
  try {
    await renderMedia({
      composition: comps[job.comp],
      serveUrl,
      codec: "h264",
      outputLocation: tmp,
      frameRange: job.frameRange,
      inputProps,
      muted: true,
      imageFormat: R.image_format,
      jpegQuality: R.image_format === "jpeg" ? R.jpeg_quality : undefined,
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      concurrency: R.tabs,
      chromiumOptions,
      overwrite: true,
      cancelSignal,
      logLevel: "error",
      ...encoderOptions(enc),
      onProgress: ({ renderedFrames, progress }) => {
        if (renderedFrames !== lastFrames) {
          lastFrames = renderedFrames;
          lastMove = Date.now();
        }
        if (Date.now() - lastLog > 15000) {
          lastLog = Date.now();
          const sec = (Date.now() - start) / 1000;
          say({ event: "progress", job: job.id, progress: +progress.toFixed(3), frames: renderedFrames, fps: +(renderedFrames / Math.max(sec, 1)).toFixed(1) });
        }
      },
    });
    fs.renameSync(tmp, job.out);
    return { ok: true, sec: +((Date.now() - start) / 1000).toFixed(1) };
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    return { ok: false, stalled, error: String(e?.message ?? e).split("\n")[0].slice(0, 400) };
  } finally {
    clearInterval(watch);
  }
}

async function renderJob(job) {
  let enc = R.encoder;
  say({ event: "start", job: job.id, frames: job.frameRange[1] - job.frameRange[0] + 1, encoder: enc });
  let r = await renderOnce(job, enc);
  if (!r.ok && enc === "nvenc" && !r.stalled && /nvenc|nvcuda|cuda|hardware|encoder/i.test(r.error)) {
    say({ event: "warn", job: job.id, msg: `NVENC failed, rendering this part on x264: ${r.error}` });
    enc = "x264";
    r = await renderOnce(job, enc);
  }
  if (!r.ok) {
    say({ event: "retry", job: job.id, stalled: r.stalled, error: r.error });
    r = await renderOnce(job, enc);
  }
  say({ event: r.ok ? "done" : "failed", job: job.id, encoder: enc, ...r });
  return { id: job.id, encoder: enc, ...r };
}

const queue = [...spec.jobs];
const results = [];
const worker = async () => {
  while (queue.length) results.push(await renderJob(queue.shift()));
};
t0 = Date.now();
await Promise.all(Array.from({ length: Math.max(1, Math.min(R.parallel, spec.jobs.length)) }, worker));
fs.rmSync(bundleDir, { recursive: true, force: true });
say({ event: "finished", sec: +((Date.now() - t0) / 1000).toFixed(1), ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
process.exit(results.every((r) => r.ok) ? 0 : 1);
