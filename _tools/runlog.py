"""Phase timing log for the workspace: python runlog.py <folder> <phase> start|end [note]

Writes _state/runlog.json: {folder: {phase: {"start": iso, "end": iso, "sec": n, "note": ...}}}
"""
import json
import sys
import time
from datetime import datetime
from pathlib import Path

LOG = Path(__file__).resolve().parents[1] / "_state" / "runlog.json"
LOG.parent.mkdir(exist_ok=True)


def load():
    return json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else {}


def mark(folder: str, phase: str, event: str, note: str = "", **extra):
    data = load()
    rec = data.setdefault(folder, {}).setdefault(phase, {})
    now = time.time()
    if event == "start":
        rec["start"] = datetime.fromtimestamp(now).isoformat(timespec="seconds")
        rec["t0"] = now
        rec.pop("end", None)
    else:
        rec["end"] = datetime.fromtimestamp(now).isoformat(timespec="seconds")
        if "t0" in rec:
            rec["sec"] = round(now - rec["t0"], 1)
    if note:
        rec["note"] = note
    rec.update(extra)
    LOG.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return rec


if __name__ == "__main__":
    print(mark(sys.argv[1], sys.argv[2], sys.argv[3], " ".join(sys.argv[4:])))
