import { Config } from "@remotion/cli/config";

// Same settings as config.json "render", which _tools/pipeline.py uses for the part renders. JPEG frames + NVENC
// measured 2.5x faster than PNG + x264 on the cel engine. No setCrf: Remotion turns NVENC off whenever a CRF is set.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setHardwareAcceleration("if-possible");
Config.setVideoBitrate("40M");
Config.setPixelFormat("yuv420p");
Config.setChromiumOpenGlRenderer("angle");
