"""One short Flint request; prints the billing headers ElevenLabs returns."""
import json
import os
import sys
import urllib.request
from pathlib import Path

VOICE = os.environ["ELEVENLABS_VOICE_ID"]
text = sys.argv[1] if len(sys.argv) > 1 else "Cain and Abel."
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name("_probe.mp3")
body = {
    "text": text,
    "model_id": "eleven_v4",
    "language_code": "en",
    "seed": 4217,
    "voice_settings": {"stability": 1.0, "similarity_boost": 1.0, "style": 0.0, "use_speaker_boost": True, "speed": 1.0},
}
req = urllib.request.Request(
    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
    data=json.dumps(body).encode("utf-8"),
    headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json", "Accept": "audio/mpeg"},
)
with urllib.request.urlopen(req, timeout=120) as r:
    raw = r.read()
    for k, v in r.headers.items():
        if any(s in k.lower() for s in ("character", "cost", "credit", "request-id", "model")):
            print(k, "=", v)
out.write_bytes(raw)
print("chars", len(text), "bytes", len(raw))
