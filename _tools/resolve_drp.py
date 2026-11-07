"""DaVinci Resolve project for one film: python resolve_drp.py <folder>   (or: template | a4 <folder> [<folder> ...])

template  -> _tools/resolve/vo-template-a4.drt (from _tools/resolve/template-timeline.drt, a timeline you export
             from your own Resolve project; not included) with every clip removed.
             It keeps the three audio tracks, with the Fairlight Reverb + Delay inserts and the +10 dB fader on the
             mono voice track (A3), and adds A4 "Voice": mono, no inserts, fader +10 dB.
<folder>  -> a project "<Book N - Title>" with two timelines built on that template:
               "<name> 16x9": master video (V1) + its score (A1), each Flint take on A4 (dry) at its frame,
                              subtitles from the master's .en_US.srt (the script's own words)
               "<name> 9x16": the vertical master, the same takes, its 15-character .en_US.srt
             (the SRTs are <film>-master-narrated / -vertical-master-narrated.en_US.srt; the masters must exist:
             run pipeline.py --keep-masters or out/rebuildvideo.bat first, cleanup.py after)
             exported to <folder>/<name>.drp and checked for the Reverb/Delay plug-ins and the A4 fader.
a4        -> moves the takes of an existing project from A3 to A4 (same positions and trims, re-trimmed media),
             leaves A3 empty with its Reverb + Delay, sets the A4 fader to +10 dB, re-exports <folder>/<name>.drp.
Resolve must be running (Studio scripting).
"""
import json
import os
import re
import struct
import sys
import time
import zipfile
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runlog  # noqa: E402
from films import RESOLVE_DIR, STATE, WS, film_dir, srt_for, take  # noqa: E402

sys.path.append(os.path.join(os.environ["RESOLVE_SCRIPT_API"], "Modules"))
import DaVinciResolveScript as dvr  # noqa: E402

LIGHT_DRT = RESOLVE_DIR / "template-timeline.drt"
TEMPLATE = RESOLVE_DIR / "vo-template-a4.drt"
FX_VOICE, VOICE, VOICE_DB = 3, 4, 10.0
FL_KEY = "FLStudioModelBA".encode("utf-16-be")


def connect():
    for _ in range(40):
        r = dvr.scriptapp("Resolve")
        if r:
            return r
        time.sleep(3)
    raise SystemExit("Resolve is not reachable")


def srt_cue_frames(srt: Path, fps: int):
    out = []
    for h, m, s, ms in re.findall(r"^(\d\d):(\d\d):(\d\d),(\d\d\d) -->", srt.read_text(encoding="utf-8"), re.M):
        out.append(round((int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000) * fps))
    return sorted(out)


def all_items(tl):
    out = []
    for kind in ("video", "audio", "subtitle"):
        for i in range(1, (tl.GetTrackCount(kind) or 0) + 1):
            out += tl.GetItemListInTrack(kind, i) or []
    return out


def fresh_project(pm, name):
    cur = pm.GetCurrentProject()
    # Saving the unnamed "Untitled Project" opens a modal name prompt that blocks every scripting call.
    if cur and cur.GetName() != "Untitled Project":
        pm.SaveProject()
        if cur.GetName() == name:
            pm.CloseProject(cur)
    # Project names are case-insensitive on disk: an older "Fire On Carmel" blocks creating "Fire on Carmel".
    for old in pm.GetProjectListInCurrentFolder() or []:
        if old.lower() == name.lower():
            pm.DeleteProject(old)
    proj = pm.CreateProject(name)
    if not proj:
        raise SystemExit(f"could not create project {name}")
    for k, v in (("timelineFrameRate", "30"), ("timelineResolutionWidth", "1920"), ("timelineResolutionHeight", "1080")):
        proj.SetSetting(k, v)
    return proj


def fl_check(drp: Path):
    found = []
    with zipfile.ZipFile(drp) as z:
        for m in z.namelist():
            for _, blob, j in fl_entries(z.read(m)):
                data = fl_model(blob, j)
                found.append((b"bmd:Reverb" in data, b"bmd:Delay" in data))
    return found


def fl_entries(xml: bytes):
    """(hex span, FieldsBlob bytes, offset of the mixer model's length field) for each timeline's Fairlight mixer.

    FieldsBlob entry: u32BE key length, UTF-16BE key, u32BE type (12 = blob), u8 pad, u32BE length, value;
    the FLStudioModelBA value is u32BE decompressed size + zlib.
    """
    for hb in re.finditer(rb"<FieldsBlob>([0-9a-fA-F]+)</FieldsBlob>", xml):
        blob = bytes.fromhex(hb.group(1).decode())
        k = blob.find(FL_KEY)
        if k >= 0:
            yield hb.span(1), blob, k + len(FL_KEY) + 5


def fl_model(blob: bytes, j: int) -> bytes:
    n = struct.unpack_from(">I", blob, j)[0]
    return zlib.decompress(blob[j + 8 : j + 4 + n])


def level_record(model: bytes):
    """Offset and values of the mixer's per-channel level array (0.1 dB steps; A3's +10 dB fader reads 100).

    Found by its shape: the channel-strip table opens with records [1][id][n] n*i32 for ids 1, 2, 2, 3, 4, 4, 5, 5,
    6, 6, 7, all n long (record 4 is pan). One entry per channel in track order, so a stereo track takes two.
    The bus strips follow in a second table of the same shape, so the first match is the tracks'.
    """
    hits = []
    for m in re.finditer(re.escape(struct.pack("<II", 1, 1)), model):
        i = m.start()
        n = struct.unpack_from("<I", model, i + 8)[0]
        if not 0 < n <= 64:
            continue
        pos, chain = i, True
        for rid in (1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7):
            if pos + 12 + 4 * n > len(model) or struct.unpack_from("<III", model, pos) != (1, rid, n):
                chain = False
                break
            pos += 12 + 4 * n
        if chain:
            hits.append((i + 12, list(struct.unpack_from(f"<{n}i", model, i + 12))))
    if not hits:
        raise SystemExit("no Fairlight channel-strip table found")
    return hits[0]


def fader_levels(drp: Path):
    """Per timeline, every mixer channel's level in dB."""
    out = []
    with zipfile.ZipFile(drp) as z:
        for m in z.namelist():
            for _, blob, j in fl_entries(z.read(m)):
                out.append([v / 10 for v in level_record(fl_model(blob, j))[1]])
    return out


def set_fader(drp: Path, channel: int, db: float) -> int:
    """Set one mixer channel's level in every timeline of a .drp/.drt; the scripting API cannot move faders."""
    with zipfile.ZipFile(drp) as z:
        members = [(info, z.read(info.filename)) for info in z.infolist()]
    patched, out = 0, []
    for info, data in members:
        pieces, last = [], 0
        for (s, e), blob, j in list(fl_entries(data)):
            model = bytearray(fl_model(blob, j))
            off, levels = level_record(bytes(model))
            if channel >= len(levels):
                raise SystemExit(f"{drp.name}: mixer has {len(levels)} channels, no channel {channel}")
            struct.pack_into("<i", model, off + 4 * channel, round(db * 10))
            value = struct.pack(">I", len(model)) + zlib.compress(bytes(model), 9)
            n = struct.unpack_from(">I", blob, j)[0]
            blob = blob[:j] + struct.pack(">I", len(value)) + value + blob[j + 4 + n :]
            pieces += [data[last:s], blob.hex().encode()]
            last, patched = e, patched + 1
        out.append((info, b"".join(pieces) + data[last:]))
    tmp = drp.with_name(drp.name + ".tmp")
    with zipfile.ZipFile(tmp, "w") as z:
        for info, data in out:
            z.writestr(info, data)
    tmp.replace(drp)
    return patched


def channel_of(tl, track: int) -> int:
    """Index of a track's first mixer channel: the channel counts of the audio tracks before it."""
    width = {"mono": 1, "stereo": 2, "5.1": 6, "7.1": 8}
    return sum(width.get(tl.GetTrackSubType("audio", i), 1) for i in range(1, track))


def make_template():
    resolve = connect()
    pm = resolve.GetProjectManager()
    proj = fresh_project(pm, "_vo_template_build")
    mp = proj.GetMediaPool()
    tl = mp.ImportTimelineFromFile(str(LIGHT_DRT), {})
    if not tl:
        raise SystemExit("template import failed")
    proj.SetCurrentTimeline(tl)
    items = all_items(tl)
    print("removing", len(items), "template clips:", tl.DeleteClips(items, False))
    clips = [c for c in (mp.GetRootFolder().GetClipList() or []) if (c.GetClipProperty("Type") or "") != "Timeline"]
    print("removing", len(clips), "pool clips:", mp.DeleteClips(clips) if clips else True)
    print("adding A4:", tl.AddTrack("audio", "mono"))
    tl.SetName("vo-template")
    TEMPLATE.parent.mkdir(parents=True, exist_ok=True)
    ok = tl.Export(str(TEMPLATE), resolve.EXPORT_DRT, resolve.EXPORT_NONE)
    print("exported", TEMPLATE, ok, TEMPLATE.stat().st_size if TEMPLATE.exists() else 0)
    print("A4 fader patched in", set_fader(TEMPLATE, channel_of(tl, VOICE), VOICE_DB), "timeline(s); levels", fader_levels(TEMPLATE))
    for k in ("audio",):
        for i in range(1, tl.GetTrackCount(k) + 1):
            print(k, i, tl.GetTrackName(k, i), tl.GetTrackSubType(k, i), tl.GetIsTrackEnabled(k, i))
    pm.SaveProject()
    pm.CloseProject(proj)
    pm.DeleteProject("_vo_template_build")


def project_name(timing):
    """'GENESIS 37, 39–41' -> 'Genesis 37, 39-41 - <Title>'; numbered books keep their number: '1 SAMUEL 1–3' -> '1 Samuel 1-3'.
    A script "project" field, when set, is used as it is."""
    if timing.get("project"):
        return re.sub(r'[<>"/\\|?*:]', "", timing["project"])
    book, num = re.match(r"(\d?\s?[A-Z]+)\s+(.*)", timing["label"]).groups()
    # A second book in the label ("…; 2 KINGS 1–2") is title-cased too; ":" (MARK 1:1–13) cannot be in a file name.
    num = re.sub(r"[A-Z]{2,}", lambda m: m.group(0).title(), num.strip().replace("–", "-")).replace(":", ".")
    words = " " + timing["title"].replace("\n", " ").title() + " "
    for w in ("And", "The", "In", "Of", "At", "On", "To", "A", "For", "With"):
        words = words.replace(f" {w} ", f" {w.lower()} ")
    words = words.strip().replace("’S", "’s").replace("'S", "'s")
    words = words[0].upper() + words[1:]
    return re.sub(r'[<>"/\\|?*]', "", f"{book.title()} {num} - {words}")


def build(folder: str):
    root = film_dir(folder)
    timing = json.loads((root / "src" / "timing.json").read_text(encoding="utf-8"))
    cues = json.loads((root / "narration" / "cues.json").read_text(encoding="utf-8"))
    name = project_name(timing)
    master = root / "out" / f"{folder}-master.mp4"
    vmaster = root / "out" / f"{folder}-vertical-master.mp4"
    for p in (master, vmaster, TEMPLATE):
        if not p.exists():
            raise SystemExit(f"missing {p}" + ("" if p == TEMPLATE else ": the clean-up deleted the masters; run out/rebuildvideo.bat (without clean) first"))
    phase = "drp-rebuild" if runlog.load().get(folder, {}).get("drp", {}).get("end") else "drp"
    runlog.mark(folder, phase, "start")
    resolve = connect()
    pm = resolve.GetProjectManager()
    proj = fresh_project(pm, name)
    mp = proj.GetMediaPool()
    files = [str(master), str(vmaster)] + [str(take(root, c)) for c in cues["clips"]]
    imported = mp.ImportMedia(files) or []
    by = {}
    for it in imported:
        by[os.path.normcase(os.path.abspath(it.GetClipProperty("File Path")))] = it
    get = lambda p: by[os.path.normcase(os.path.abspath(p))]  # noqa: E731
    print(f"{name}: imported {len(imported)} / {len(files)} media")

    def place(label, video, vertical):
        tl = mp.ImportTimelineFromFile(str(TEMPLATE), {})
        if not tl:
            raise SystemExit("timeline import failed")
        tl.SetName(f"{name} {label}")
        proj.SetCurrentTimeline(tl)
        if vertical:
            ok = tl.SetSetting("useCustomSettings", "1")
            for k, v in (("timelineResolutionWidth", "1080"), ("timelineResolutionHeight", "1920"), ("timelineOutputResolutionWidth", "1080"), ("timelineOutputResolutionHeight", "1920")):
                ok = tl.SetSetting(k, v) and ok
            print("  vertical settings", ok, tl.GetSetting("timelineResolutionWidth"), tl.GetSetting("timelineResolutionHeight"))
        start = tl.GetStartFrame()
        # The subtitle clip must go on while the timeline is empty: AppendToTimeline ignores recordFrame for it and
        # lands it after the last item on any track.
        # the delivery standard keeps two SRTs: <film>-master-narrated / <film>-vertical-master-narrated
        srt = Path(video).with_name(Path(video).stem + "-narrated.en_US.srt")
        sub = (mp.ImportMedia([str(srt)]) or [None])[0]
        if not sub:
            raise SystemExit(f"{srt} would not import")
        if not tl.GetTrackCount("subtitle"):
            tl.AddTrack("subtitle")
        subs_placed = mp.AppendToTimeline([{"mediaPoolItem": sub, "trackIndex": 1, "recordFrame": start}]) or []
        vid = get(video)
        placed = mp.AppendToTimeline([
            {"mediaPoolItem": vid, "mediaType": 1, "trackIndex": 1, "recordFrame": start},
            {"mediaPoolItem": vid, "mediaType": 2, "trackIndex": 1, "recordFrame": start},
        ]) or []
        infos = [{"mediaPoolItem": get(str(take(root, c))), "mediaType": 2, "trackIndex": VOICE, "recordFrame": start + c["frame"]} for c in cues["clips"]]
        vo = mp.AppendToTimeline(infos) or []
        tl.SetTrackName("video", 1, "Picture")
        tl.SetTrackName("audio", 1, "Score")
        tl.SetTrackName("audio", FX_VOICE, "Voice (Reverb+Delay)")
        tl.SetTrackName("audio", VOICE, "Voice")
        a4 = tl.GetItemListInTrack("audio", VOICE) or []
        starts = sorted(int(i.GetStart()) - start for i in a4)
        want = sorted(c["frame"] for c in cues["clips"])
        subs = []
        for i in range(1, (tl.GetTrackCount("subtitle") or 0) + 1):
            subs += tl.GetItemListInTrack("subtitle", i) or []
        cue_at = srt_cue_frames(srt, timing["fps"])
        got = sorted(int(s.GetStart()) - start for s in subs)
        in_sync = len(got) == len(cue_at) and all(abs(a - b) <= 1 for a, b in zip(got, cue_at))
        widest = max((len(line) for s in subs for line in (s.GetName() or "").splitlines()), default=0)
        return tl, {"picture": len(placed), "voice": len(a4), "voice_track": VOICE, "positions_match": starts == want, "subtitles": len(subs),
                    "subs_ok": bool(subs_placed) and in_sync, "longest_line": widest, "srt": srt.name}

    report = {}
    tl, report["16x9"] = place("16x9", master, False)
    print(f"  16x9: {report['16x9']}")
    tl, report["9x16"] = place("9x16", vmaster, True)
    print(f"  9x16: {report['9x16']}")
    pm.SaveProject()
    out = root / f"{name}.drp"
    if out.exists():
        out.unlink()
    ok = pm.ExportProject(name, str(out), False)
    levels = ensure_voice_fader(pm, name, out, channel_of(tl, VOICE)) if out.exists() else []
    fl = fl_check(out) if out.exists() else []
    report["drp"] = {"path": str(out), "exported": bool(ok), "fairlight": fl, "levels_db": levels}
    (root / "narration" / "resolve.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    runlog.mark(folder, phase, "end")
    print("  exported", out, ok, "fairlight", fl, "levels", levels)


def ensure_voice_fader(pm, name, out: Path, channel: int):
    """Confirm the A4 fader in the exported project; if it is not +10 dB, patch the .drp and re-import it."""
    levels = fader_levels(out)
    if levels and all(lv[channel] == VOICE_DB for lv in levels):
        return levels
    set_fader(out, channel, VOICE_DB)
    cur = pm.GetCurrentProject()
    if cur and cur.GetName() == name:
        pm.CloseProject(cur)
    pm.DeleteProject(name)
    if not pm.ImportProject(str(out), name) or not pm.LoadProject(name):
        raise SystemExit(f"re-import of {out} failed")
    check = out.with_name(out.stem + ".check.drp")
    pm.ExportProject(name, str(check), False)
    levels = fader_levels(check)
    check.replace(out)
    if not all(lv[channel] == VOICE_DB for lv in levels):
        raise SystemExit(f"{name}: A4 fader did not survive the re-import: {levels}")
    return levels


def to_a4(folder: str):
    root = film_dir(folder)
    timing = json.loads((root / "src" / "timing.json").read_text(encoding="utf-8"))
    cues = json.loads((root / "narration" / "cues.json").read_text(encoding="utf-8"))
    name = project_name(timing)
    out = root / f"{name}.drp"
    resolve = connect()
    pm = resolve.GetProjectManager()
    cur = pm.GetCurrentProject()
    if cur and cur.GetName() not in ("Untitled Project", name):
        pm.SaveProject()
    if name not in (pm.GetProjectListInCurrentFolder() or []) and not pm.ImportProject(str(out), name):
        raise SystemExit(f"{name} is not in Resolve and {out} would not import")
    proj = cur if cur and cur.GetName() == name else pm.LoadProject(name)
    if not proj:
        raise SystemExit(f"could not open {name}")
    backup = STATE / "_backup_vo_fix" / folder / f"{name} (voice on A3).drp"
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        pm.ExportProject(name, str(backup), False)
    mp = proj.GetMediaPool()
    norm = lambda p: os.path.normcase(os.path.abspath(p)) if p else ""  # noqa: E731
    lines_dir = norm(root / "narration" / "lines")
    plan, old = [], {}
    # Everything on A3 moves; takes already on A4 (moved by hand) are re-placed too, so they pick up the new media.
    for k in range(1, proj.GetTimelineCount() + 1):
        tl = proj.GetTimelineByIndex(k)
        proj.SetCurrentTimeline(tl)
        if tl.GetTrackCount("audio") < VOICE:
            tl.AddTrack("audio", "mono")
        rows = []
        for track in (FX_VOICE, VOICE):
            for it in tl.GetItemListInTrack("audio", track) or []:
                mpi = it.GetMediaPoolItem()
                path = mpi.GetClipProperty("File Path") if mpi else ""
                if track == VOICE and os.path.dirname(norm(path)) != lines_dir:
                    continue
                rows.append({"item": it, "mpi": mpi, "path": path, "start": int(it.GetStart()), "left": int(it.GetLeftOffset()),
                             "dur": int(it.GetDuration()), "frames": int(mpi.GetClipProperty("Frames") or 0) if mpi else 0})
        if rows and not tl.DeleteClips([r["item"] for r in rows], False):
            raise SystemExit(f"{name}: could not lift the takes off {tl.GetName()}")
        old.update({norm(r["path"]): r for r in rows if r["mpi"]})
        plan.append((tl, rows))
    # vo_fix.py shortened some takes on disk; fresh pool items make Resolve read their new length.
    takes = [r for p, r in old.items() if os.path.dirname(p) == lines_dir]
    if takes and not mp.DeleteClips([r["mpi"] for r in takes]):
        raise SystemExit(f"{name}: could not refresh the voice takes in the media pool")
    fresh = {norm(i.GetClipProperty("File Path")): i for i in (mp.ImportMedia([r["path"] for r in takes]) or [])}
    if len(fresh) != len(takes):
        raise SystemExit(f"{name}: re-imported {len(fresh)} of {len(takes)} voice takes")
    report_path = root / "narration" / "resolve.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
    for tl, rows in plan:
        proj.SetCurrentTimeline(tl)
        infos, trimmed = [], 0
        for r in rows:
            mpi = fresh.get(norm(r["path"]), r["mpi"])
            info = {"mediaPoolItem": mpi, "mediaType": 2, "trackIndex": VOICE, "recordFrame": r["start"]}
            if r["left"] > 0 or (r["frames"] and r["dur"] < r["frames"] - 1):
                frames = int(mpi.GetClipProperty("Frames") or 0) or r["left"] + r["dur"]
                info.update({"startFrame": r["left"], "endFrame": min(r["left"] + r["dur"], frames) - 1})
                trimmed += 1
            infos.append(info)
        mp.AppendToTimeline(infos)
        tl.SetTrackName("audio", FX_VOICE, "Voice (Reverb+Delay)")
        tl.SetTrackName("audio", VOICE, "Voice")
        a4 = [i for i in tl.GetItemListInTrack("audio", VOICE) or [] if os.path.dirname(norm(i.GetMediaPoolItem().GetClipProperty("File Path"))) == lines_dir]
        a3 = tl.GetItemListInTrack("audio", FX_VOICE) or []
        start = tl.GetStartFrame()
        moved = sorted(int(i.GetStart()) for i in a4) == sorted(r["start"] for r in rows)
        label = "9x16" if tl.GetName().endswith("9x16") else "16x9"
        report.setdefault(label, {}).update({"voice": len(a4), "voice_track": VOICE,
                                             "positions_match": sorted(int(i.GetStart()) - start for i in a4) == sorted(c["frame"] for c in cues["clips"])})
        print(f"  {tl.GetName()}: {len(a4)}/{len(rows)} takes on A4 at their positions {moved} ({trimmed} hand-trimmed), A3 now {len(a3)}")
        if not moved or a3:
            raise SystemExit(f"{name}: move to A4 failed on {tl.GetName()}")
    pm.SaveProject()
    if out.exists():
        out.unlink()
    ok = pm.ExportProject(name, str(out), False)
    levels = ensure_voice_fader(pm, name, out, channel_of(plan[0][0], VOICE))
    fl = fl_check(out)
    report["drp"] = {"path": str(out), "exported": bool(ok), "fairlight": fl, "levels_db": levels}
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"  exported {out.name}: reverb+delay {fl}, levels {levels}")


if __name__ == "__main__":
    if sys.argv[1] == "template":
        make_template()
    elif sys.argv[1] == "a4":
        for f in sys.argv[2:]:
            to_a4(f)
    else:
        build(sys.argv[1])
