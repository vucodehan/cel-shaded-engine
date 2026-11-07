# <Brand>: "<Tagline>" (<N> s, <16:9 | 9:16 | both>, <W>x<H>, 30 fps, <frames> frames)

Composition `<Comp>` (src/<slug>/<Comp>.tsx), slug `<slug>`. Invented brand, app, mascot, logo, UI and sound (no real
brands, logos, people or music). Kit API: src/promo/KIT.md (read its Workflow and Hand-offs sections first). Method:
videoclone.md (docs/videoclone.md in the video-clone-toolkit repo), sections 10 (house style) and 14 (process).

## Lessons from the last run (keep up front; replace each run)
- Storyboard with `node scripts/celstills.mjs --sheet=sb Comp:f ...` (one bundle), not `remotion still` per frame.
- Author every number on the beat sheet in one frame convention (shot-local Sequences or global frames).
- Every hand-off (overlay <-> screen / island) goes through `handoff()`; check each with a zoomed crop at-3..at+3.
- Declare the tagline hold from `endCardTiming(card, start, duration).holds` in qa.json; the lockup hold is live.
- Keep every cue's peak 6 dB or more over the music; edits and the commands that read them run one after the other.

## Message and audience
- **Message** (one sentence the viewer keeps): ...
- **Tagline** (end card, 2-6 words): "..."  **CTA**: "..." (pill or text)
- **Audience** (who, where they watch, what they already use): ...
- **Signature moment** (the one shot people remember; how it uses the phone, the island or the button): ...

## Format and exact frames
| Item | Value |
|---|---|
| Formats | 16:9 1920x1080 and/or 9:16 1080x1920 (one code path; check both) |
| Length | <frames> frames at 30 fps; music <bpm> bpm = <frames per beat> f per beat, a bar every <n> f |
| Deliverables | out/<slug>-v1.mp4 (H.264 + AAC 48 kHz), poster PNG, SRT if there is speech |
| Safe area | key text and logos in `fmt.safe` (9:16: clear of the platform UI); headline cap height >= 4 % of H |

## Beat sheet (frames; cuts on beats; at most one new line of text per second)
| Frames | Beat | Camera | Picture | Text on screen | Sound |
|---|---|---|---|---|---|
| 0-42 | Hook | HOUSE.rise (already moving on frame 0) | ... | - | whoosh (peak 7) |
| ... | ... | HOUSE.orbit (9:16: ORBIT.portrait) / sideFraming | ... | "..." (region) | ... |
| E-end | End card | - | tagline, hard switch to the mark, lockup, CTA, living hold | "<Tagline>" | drop, button chord on the CTA |

## Palette
| Role | Hex |
|---|---|
| Accent (mascot, buttons) | # |
| Accent 2 / gradient end | # |
| Ink (type) / sub ink | # / # |
| Background / soft wash | # / # |

## Fonts (bundled OFL; KIT.md Look)
- Headlines and end card: <display | grotesk | rounded | serif>, weight ...; accent words: role / italic / colour or
  gradient.
- Inside the phone: Inter (ui), 13-34 pt; numbers tabular. Non-Latin text: check the fallback on a still.

## Mascot
Shape (stadium coin drop blob bubble flame plane, or your own drawer), colours (`color`, `color2`, `core`), eyes and
mouth, gloss, how it moves (squash on landings, stretch on flights, blink, look where it goes, flicker / wag / talk),
where it lives in each beat (overlay, screen, island, the lit button: `eyes.axis` "across" for an upright mascot),
and the end-card mark (OrbMark features, TileMark glyph, or a render function from `mascotParts` using `p.blink`).

## Screens per beat (screen points, 402.5 x 874)
| Beat | Screen (ui pieces, data shown) | Island state | Overlays (behind / in front) | Hand-offs (frame, dir) |
|---|---|---|---|---|
| Hook | home screen: wallpaper, icons, the app's icon at slot n | rest | - | - |
| ... | ... | expanded at f (callContent) | labels ring (behind) | land at f: overlay -> screen |

## Sound cue sheet (sound.json is the truth; this is the outline)
Music: preset ..., bpm ..., key ..., progression ..., sections (intro / groove / lift / drop) with bars and energy,
`button` on the CTA frame, fade out ... f. Music bus 2-3 dB under the preset default.
| Frame | Cue (kind) | Picture event |
|---|---|---|
| 7 | whoosh (peak) | phone rises |
| ... | pop / tap / swoosh / success / babble ... | ... |
| CTA | music button (hit) | CTA pops |
Master: -14 LUFS integrated, true peak <= -1 dBTP (vc_sound.py renders and checks it).

## QA spec (qa.json; vc_qa.py out/<slug>-vN.mp4 --spec qa.json --sound sound.json)
```json
{ "width": 1920, "height": 1080, "fps": 30, "frames": 0, "lufs": -14, "lufs_tol": 1.0, "true_peak": -1.0,
  "holds": [], "black_ok": [], "flicker_ok": [], "freeze_max": 30, "black_max": 2, "blank_max": 2, "min_shot": 3,
  "head_silence_max": 15, "tail_silence_max": 30, "dropout_max": 15, "silence_db": -60, "sync_tol": 2, "audio": true }
```
- `holds` = `endCardTiming(card, cardStart, cardDuration).holds` (plus any intended still beat).
- Also by eye on the grids: no empty frame after a cut, text inside the safe area and readable at phone size, every
  hand-off continuous in position, size and heading (zoomed crops), no black screen corners, end-card lockup centred.
- Done when vc_qa passes, the grids are clean in every format, and the log lists minutes per phase and render times.
