# Promo kit (src/promo): API reference

Original phone-app promos in the measured house style of the cloned reference (videoclone.md 10: beats, camera eases,
phone geometry, island and end-card choreography). Remotion 4 + three.js; everything is a pure function of the frame.
`import { ... } from "../promo"`. Working examples (in a separate demo project, not included here): `src/demo/KitDemo.tsx` (KitDemo
1920x1080 / KitDemoV 1080x1920, one code path: house shot, two phones, an orbit shot with side framing, labels behind
the phone, a plane that takes off from the screen, loops with a trail and lands back on it, confetti, the end card's
living hold) and `src/demo/Catalog.tsx` (KitCatalog0/1: every UI piece, island state, mascot shape, glyph, font).

## Quick start: a phone shot
```tsx
const Shot: React.FC = () => {
  const f = useCurrentFrame(), fmt = useFormat();
  const track = useMemo(() => houseTrack(fmt), [fmt]);    // rise 0-42, orbit 45-81 (9:16 preset in portrait), return, push
  const cam = track(f);
  const phone: PhoneSpec = {
    finish: "black",
    screen: (ctx, s) => homeScreen(ctx, { wallpaper: WALL, icons: ICONS, dock: DOCK, frame: s.frame }),
    island: islandTrack([{ f: 0, mode: "rest" }, { f: 96, mode: "expanded" }, { f: 120, mode: "compact" }],
      callContent({ status: "Listening…", name: "Pip", start: 96, mascot: { color: "#6d4dff" } })),
    buttons: f >= 81 ? { action: { color: "#6d4dff", eyes: true, glow: 0.4 } } : undefined,
  };
  return (<><Background color="#ffffff" grain={0.05} /><PhoneStage camera={cam} phones={[phone]} /></>);
};
```

## Units and spaces
- **Screen points**: (0,0) top-left of the screen, y down, 402.5 x 874 (`SCREEN_W`, `SCREEN_H`). Screen and island
  callbacks and every `ui` function draw in these. World units are points too.
- **Phone-local**: origin at the screen centre, x right, y up, z out of the glass (screen at z = 0, back at -52.1).
  `screenToLocal(sx, sy, z)`, `buttonLocal(name)`, `localToWorld(pose, p)`; `Pose` = position, rotation (deg, XYZ), scale.
- **Image px**: composition pixels; overlays (`Mascot`, `Headline`, marks, trails, particles) live here.
  `projector(cam, W, H)`: `.point(world)`, `.local(pose, p)`, `.screen(pose, sx, sy, z)`, `.button(pose, "action")` ->
  `{ x, y, s, depth, front }`, `s` = px per world unit there (x pose.scale = px per pt). Build it from this frame's Cam.
- **Format**: `useFormat()` -> `{ W, H, portrait, landscape, u, safe, title, action }`. `u` = px per unit at 1080 on the
  short side (author at 1080p, multiply by u). `safe` = title-safe in 16:9; in 9:16 also clear of the platform UI (top
  8 %, bottom 18 %, right 12 %, left 6 %), so it is OFF-CENTRE: text centred in `fmt.safe` sits about 32 px left of a
  centred phone. `centerSafe(fmt)` = the largest symmetric box of it (use it for text that must line up with a centred
  phone or lockup). `sub(rect, fx0, fy0, fx1, fy1)` cuts bands.
- **Frames**: screen callbacks, `Headline` and `EndCard` read the enclosing Sequence's frame. Pick one convention per
  project: one Sequence per shot with shot-local frames (the demo), or global frames without Sequences (pass
  `frame` to PhoneStage); the EndCard always gets its own Sequence (card-local frames).

## PhoneStage (PhoneStage.tsx, phone3d.ts, geometry.ts)
`<PhoneStage camera={cam} phones={[...]} halo shadow background ss={2} frame behind={...} />` — one WebGL renderer
per tab, 2x supersampled into the stage's 2D canvas, NoToneMapping, sRGB, transparent clear (put `<Background>` first).
`PhoneSpec` = Pose & `{ finish, screen, island, buttons, visible, ppu = 4, islandPpu = 6 }`.
- `screen(ctx, s)`: redrawn every frame, clipped to the screen's rounded corners (the screen mesh is rounded too);
  `s = { frame, fps, t, w, h, ppu, index }`. `island(ctx, s)`: a transparent layer over the top 230 pt
  (`ISLAND_AREA_H`), same coordinates, ABOVE the screen layer; default the resting pill, `false` = none. Anything that
  leaves the island downwards must be drawn by the screen callback underneath. `ppu` 6 only for extreme close-ups.
- `finish`: `FINISHES` black white natural desert blue pink midnight, or `{ frame, back, bezel, glass, button, lens, gloss }`.
- `buttons`: `{ action | volUp | volDown | side: { color, press 0..1, glow, eyes: true | { open, look: [x,y], color,
  axis } } }`; `color` lights it flat (the mascot became the button); `axis: "across"` = two tall eyes side by side
  (an upright mascot: flame, drop), default "along" (two wide eyes along the button: a lying stadium).
- `halo` (default on, `{ opacity 0.11, blur 24, y 14 }` pt), `shadow` = contact ellipse. `behind` = overlays under the
  phones (see Behind the phone). Geometry: `PHONE` (screen 402.5 x 874 r 49, outline 433.85 x 905.47 r 71.8, depth 51.5).

## Camera (camera.ts)
`Cam = { yaw, elev, roll, dist, aim: [x,y,z], fov, shift: [x,y] }`: orbit around `aim`; yaw < 0 swings to the phone's
left (Action Button side); elev < 0 = lower, looking up; fov = degrees across the SHORT side (house 23.3); shift = lens
shift in frame fractions (moves the picture, keeps the perspective; +x moves it right).
- `houseTrack(fmt, opts)` / `houseKeys(fmt, opts)`: the reference's whole move (start, fill, top, yaw, closeDist,
  button, tilt, push, pose). Chainable moves, each `{ keys, end }`: `HOUSE.rise(fmt, at)`, `HOUSE.orbit(from, at,
  { button, fmt })`, `HOUSE.back(from, at, HOUSE.settled(front))`, `HOUSE.push(from, at, dur, amount)`, `HOUSE.front(fmt)`.
- **9:16 orbit**: the 16:9 orbit (495 pt) shows only about 204 pt across a portrait frame (island and button lost).
  `HOUSE.orbit(..., { fmt })` and `houseKeys(fmt)` use `ORBIT.portrait` in 9:16 (760 pt, aim 40 pt inside the button,
  up at y 330: button, island and the phone's top corner in frame, room above for a line). A lens shift in `from` is
  keyed back to 0 by the orbit, and `HOUSE.back` keys it to its target's.
- **Side framing**: `sideFraming(fmt, "left" | "right", { fill, x, top, yaw, pose })` -> `{ cam, text, phone }`: 16:9
  = the whole phone at `fill` 0.84 of the height, centred at x 0.3 (left) / 0.7 (right) by lens shift, `text` = the
  headline region on the other side; 9:16 = phone low (front framing, top at `top` 0.2), `text` = the band above.
  `<Headline region={sf.text} align="left" />`. Move from it with camMove / extra keys.
- Your own: `camMove(from, at, dur, to, ease | { yaw: EASE.x, ... })`, raw keys `camTrack([{ f, yaw, dist, aim,
  ease, eases }])`. Framing: `frontFraming(fmt, fill, top)`, `fitDist(W, H, w, h, fill)`, `viewHeight(W, H, dist)`.
- Sizes from projected units: px per pt changes a lot between framings (about 1 in the house front, 2-5 in side
  views); size overlays from the target's `s` (e.g. `41.9 * btn.s / 2.1` = the button's mascot height), not from px.

## Screens (ui.ts, glyphs.ts, map.ts)
All in screen points; colours default to black ink; every call restores the context.
- Shapes: `squircle`, `capsule`, `fillOf` (colour | gradient | stops), `setShadow/noShadow`, `about(ctx, x, y,
  scale, fn, alpha)` (pop about a point), `frost(ctx, x, y, w, h, r, { blur, tint })` (iOS materials).
- Text: `text(ctx, str, x, y, { font, size, weight, color, align, baseline, tracking, lineHeight, maxWidth, maxLines,
  tabular })` -> `{ w, h, lines }`; `measure`, `wrap`. Body 17 pt, small 13-15, titles 22-34.
- Home: `homeScreen(ctx, { wallpaper, icons, dock, dots, time, labels, anim, frame })` (measured grid, `gridSlot(i)`),
  `appIcon`, `statusBar`, `homeIndicator`, `wallpaper`.
- Widgets: `card`, `notification(ctx, x, y, w, { icon, title, body, time, dark }, { appear, size })` (returns h;
  `size` scales text, icon and padding at the same width: 15 pt text reads as about 25 px at the house 9:16 framing,
  use 1.25-1.35 for a key line), `bubble(ctx, edgeX, y, str, { side, fill, appear })`, `typing`, `button`, `chip`,
  `toggle`, `ring`, `progressBar`, `bars`, `sparkline`, `avatar`, `header`, `listRow`, `tabBar`. Feed `appear` a spring.
- Glyphs: `GLYPHS` (40: chat bubbles bolt leaf wave spark note camera pin heart calendar clock mail play cloud sun moon
  star chart bag mic bell search home user plus check phone wallet book flame drop globe lock gear card pulse photo
  compass grid video smile plane rings cup); `glyph(ctx, name | fn, x, y, size, c, c2)`; your own = `(ctx, c, c2) => {}`.
- Map: `flatMap(ctx, x, y, w, h, { seed, theme, zoom, center, angle, route, progress, pins: [{ at, color, glyph, pop,
  label }], me, meColor, pulse, r })`; `mapRoute(spec, [[i, j], ...])` follows the streets (`mapNode`); `pinPop(f, at)`.
  Helpers (box = `{ x, y, w, h }`, the box you drew the map in): `mapToBox(spec, box, u, v)` -> [x, y];
  `routeAt(spec, box, progress)` -> `{ x, y, angle, length, total }` (the drawn route's head and heading: ride a marker
  or the mascot on it); `visibleNodes(spec, box, margin)` -> `[{ i, j, x, y }]` (pick route nodes that are on screen).

## Dynamic Island (island.ts)
`ISLAND.rest` 127.8 x 37.2 (top 11.4), `.compact` 222 x 39, `.expanded` 383 x 90, `.tall` 383 x 168, or any `{ w, h,
top, dx, r }`. `islandAt(frame, [{ f, mode }])` -> state `{ x0, y0, x1, y1, w, h, cx, cy, r, mode, since, open }`
(measured springs). `drawIsland(ctx, state, content)` clips content to the pill; `islandTrack(keys, content)` -> an
island callback. Content: `callContent({ status, name, nameAt, start, mascot | avatar })`, `compactContent({ left, right })`.

## Mascot (character.ts, Mascot.tsx)
`MascotPose = { x, y, size (body height), rot, squash, stretch, stretchAngle, flip, shape, color, color2, eye, eyes:
oval|dot|happy|none, mouth: none|smile|open, blink, look: [x,y], turn, wobble, shade, gloss, cheeks, opacity, core,
flicker, tail, talk, mouthColor }`. `<Mascot {...pose} />` = SVG overlay (image px); `drawMascot(ctx, pose)` = the same
character in a screen or island (pt); `mascotParts(pose)` = its paths (body, bodyColor, gradient, details, core, eyes,
talkMouth) for your own marks.
- Shapes: stadium, coin, drop, blob (`wobble` = phase), bubble (`tail` -1..1 wags its tail), flame (`wobble` = flicker
  phase, advance it every frame; `flicker` amplitude; `core` = inner-flame colour; `flamePath()`), plane (paper dart,
  nose right, two-tone). `flip` mirrors the body (a plane flying left stays upright).
- `color2`: on two-tone shapes (plane) the second tone (default a darker `color`); on the others a vertical gradient
  from `color` (bottom) to `color2` (top). `gloss` 0..1 = crisp white streak and dot ("glossy flat"; `glossParts`).
  `talk` 0..1 = open talking mouth (drive it from a voice envelope), `mouthColor` fills it.
- `flight(frame, { from: [x,y,size], to, at, dur, arc, ease, sizeEase, rotFrom, rotTo, spin, stretch })` (one arc;
  `to` may be this frame's projected target), `poseTrack(frame, keys)`, `hop(frame, at, { dur, height })` -> `{ dy,
  squash }`, `impact(frame, at, amount)`, `blink(frame, [frames])`, `backIn(s)` / `backOut(s)`.

## Paths and trails (path.ts, Trail.tsx)
Multi-point flights: `spline(points, { alpha })` (centripetal Catmull-Rom with an arc-length table: no cusps, loops
allowed), `pathFlight(frame, { path, at, dur, ease, size, level, stretch, from, to })` -> `{ x, y, size, rot, flip,
stretch, stretchAngle, u, done }` (rot = the tangent; `size` = number | [start, end] (geometric) | [[u, size], ...] |
fn; `level: true` mirrors instead of rolling over when flying left (one-way flights; loops want false, and a level
flight flips when its heading passes vertical: keep hand-offs away from that). `trail(frame, flightOpts, { spacing,
r, gap, hold, fade, pop })` -> dots laid at equal arc length as the body passes, popping in and fading with age;
draw with `<TrailDots dots color opacity />` (overlay) or `drawDots(ctx, dots, color)` (screen). Any 2D space works.

## Hand-offs: overlay <-> screen / island (handoff.ts)
An element that changes layers must match position, size AND heading on the switch frame (one ad shipped with 30-60
deg heading snaps found only in zoomed crops). Exact conversions for this frame's camera:
- `screenToImage(P, phonePose, { x, y, size, rot, flip }, z)` -> the overlay pose that looks exactly like that
  in-screen sprite (with `stretch`/`stretchAngle` = the screen's foreshortening, `flip` = seen from behind) plus
  `matrix`, the screen -> image map linearised there (draw any screen-space card/photo in an overlay with it).
- `imageToScreen(P, phonePose, overlayPose, z)` -> the in-screen pose (pt) that looks like an overlay pose;
  `imageToScreenPoint(P, phonePose, x, y)` -> `{ x, y, hit }`. Island layer: z = 0.08 (same coordinates).
- `handoff(frame, { P, phone, at, dir: "takeoff" | "land", screen, overlay, blend = 8 })` -> `{ layer, pose, k, off }`:
  write any overlay motion (`overlay: (f) => pathFlight(f, FL)` or a flight) that starts / ends near the screen
  pose; the helper pulls it onto the exact projected pose over `blend` frames (after a take-off, before a landing),
  so the switch at `at` cannot be seen. `screen` may be a function of the frame. Draw by layer:
```tsx
const P = projector(cam, fmt.W, fmt.H), fl = (fr: number) => pathFlight(fr, FL);
const up = handoff(f, { P, phone: pose, at: 16, dir: "takeoff", screen: ON_A, overlay: fl });
const down = handoff(f, { P, phone: pose, at: 80, dir: "land", screen: ON_B, overlay: fl });
const h = f < 48 ? up : down;     // screen: drawMascot(ctx, { ...M, ...h.pose }) when h.layer === "screen"
{h.layer === "overlay" ? <Mascot {...M} {...h.pose} /> : null}
```
  Rules: keep `flip` equal on both sides; switch into the island only when the sprite is inside the pill (the island
  clips); lay the path's ends along the parked pose's heading (the demo's ON_A / ON_B) so the pull only fixes the
  camera's drift. Check every hand-off with a zoomed vc_frames crop of `at - 3 .. at + 3`.

## Behind the phone (PhoneStage `behind`, handoff.ts)
Overlays are drawn in front of the 3D unless they go in the stage's `behind` slot (the stage canvas is transparent,
so the phone and its halo cover them). Split by view depth against the phone's middle:
```tsx
const items = labels.map((l, i) => ({ ...l, q: P.local(pose, ringPoint(i, f)) }));
const { back, front } = splitByDepth(items, (it) => it.q.depth, phoneDepth(P, pose));
<PhoneStage camera={cam} phones={[phone]} behind={<Labels items={back} />} />
<Labels items={front} />
```
`behindPhone(P, pose, worldPoint)` tests one point. An item changes layers at the moment it is beside the phone
(not over its silhouette), which a ring around the phone does naturally; tilt rings 10-30 deg towards the camera.

## Particles (particles.tsx)
`confetti(frame, { at, origin, count, seed, dir, spread, speed, gravity, drag, size, life, emit, colors, shapes,
spin, scale })` -> pieces (closed form: drag + gravity, seeded, frame-pure). 2D origin [x, y] = image px or screen pt
(y down; `dir` in degrees, -90 = up; `scale` multiplies the px defaults, ~0.4 on a screen); 3D origin [x, y, z] =
phone-local pt (y up; `dir` a vector): the burst rides the camera, map it with `projectParticles(parts, (p) =>
P.local(pose, p))`. Draw `<Particles parts={...} />` (overlay) or `drawParticles(ctx, parts)`; shapes strip rect dot
tri; `CONFETTI` = default colours. Pieces spin, tumble (a darker back) and fade at the end of `life`.

## Text and end card (Headline.tsx, EndCard.tsx, marks.tsx)
- `<Headline text={"..." | lines} at until region="top|center|bottom|left|right|full" | rect role weight size color
  accent={{ words, role, italic, weight, color, gradient: [from, to] }} align valign stagger={n | gaps} lineGap slide
  pop tempo exit />`: the end card's pop language (block slide 1.37 em, word pops, the last word lands in two
  segments). Size = px at 1080 x u, shrinks to fit the width. `lineGap={30}` = one new line per second (house rule).
  `layoutHeadline(props, fmt)` = word boxes; `headlineWord(props, fmt, frame, n)` = word n's box at a frame (after the
  slide and pop: attach a dot or an icon to a word).
- `<EndCard tagline taglineV accent brand mark markColor cta ctaSize ctaPill lockup bg ink sub role weight size
  brandRole brandWeight brandSize hold tempo stagger live />`, frame 0 = card start; `bg="transparent"` lets a
  Background show. `taglineV` = explicit 9:16 lines (else the tagline re-wraps); the tagline is centred on
  `centerSafe` (where the lockup lands). `ctaSize` default 44 px at 1080 (36 before); `ctaPill={{ fill, color, size,
  weight, pulse }}` = a capsule button that pops; `lockup` scales mark, wordmark and CTA together (1.3 fills 9:16).
- **Living hold** (default `live`): once the lockup settles the card keeps moving, so the QA frozen check passes with
  no declared hold: a slow push (`push` 0.03 scale per second), CTA breathing (`breathe` 0.03) and a mark blink every
  `blink` 26 frames (`MarkProps.blink`: OrbMark's eyes close, TileMark's glyph closes, SvgMark squashes; your own mark
  should use `p.blink` or move by itself: the push alone is too slow for vc_qa). `live={false}` = the still reference.
- `endCardTiming(props, start?, duration?)` -> `{ built, switchAt, still, length, holds }` (card-local frames;
  `length` = Sequence duration; reference: tagline 0-33, hold 40, switch 73, lockup still 139). `holds` = the still
  ranges for qa.json in film frames (pass the card's first film frame and its Sequence length): the tagline hold, plus
  the lockup hold when `live={false}`. The tagline hold (default 40 f) is longer than vc_qa's 30: declare it.
- Marks: `mark={(p) => <OrbMark {...p} features={ORB_EYES} featureColor shine blinks />}`, `<TileMark {...p} fill
  glyph />`, `<SvgMark {...p}>{paths in -1..1}</SvgMark>`, or any render function of `MarkProps = { cx, cy, r, roll,
  turn, frame, color, blink }` (e.g. a Mascot from `mascotParts`).

## Look (Background.tsx, color.ts, fonts.ts)
- `<Background color | gradient={{ angle, stops }} washes={[{ x, y, r, color, opacity }]} drift grain={0.05}
  vignette />`; washes fall off smoothly (17 stops: no banding on white); grain is soft-light.
- Colour: `srgb(hex)` for EVERY three.js colour; `rgba`, `mix`, `shade`, `onColor`, `linear`, `radial`, `cssLinear`;
  `PALETTES` citrus ocean mint berry violet night.
- Fonts (bundled OFL, public/fonts): `FONT.ui` Inter, `display` Outfit, `rounded` Nunito, `grotesk` Instrument Sans,
  `serif` Instrument Serif. `font(role, size, weight, italic)` (canvas), `family(role)` (CSS/SVG), `useFonts()`.
  Inter covers Latin, Cyrillic and Greek; CJK and Devanagari fall back to system fonts (platform-dependent).

## Timing (ease.ts)
`EASE` (camera: rise orbitYaw orbitDist returnYaw returnPitch; end card: blockSlide wordPop lastWordIn markGrow ...;
general: out outSoft inOut smooth in linear), `SPRING` (islandW islandH islandClose pop soft snappy wobble),
`spr(frame, at, spring)`, `springKeys`, `keyframes(frame, [{ f, v, ease }])`, `fields`, `prog(frame, a, b, ease)`,
`wobble`, `blink`, `rng(seed)`. Prefer `EASE.smooth` for short zooms: `EASE.out` starts so fast that a short zoom
can jump ~25 % in one frame (vc_qa reads it as a cut).

## Recipes
- **Dive into the button** (demo ShotPhone): `const b = projector(cam, W, H).button({}, "action")`; two `flight`s
  (in from off-frame big with `sizeEase: EASE.inOut`, then `ease: backIn(1.3)` into `[b.x, b.y, 41.9 * b.s / 2.1]`,
  rotTo -90), `impact` on arrival, then light the button (`buttons.action = { color, eyes, glow, press }`).
- **Mascot into the island**: `callContent({ mascot })` drops it in 10 f after the open key, or `drawMascot` in the
  island callback (clipped by the pill). Leaving the island: draw it in the screen callback (under the island layer)
  or hand it off to an overlay (`handoff`, z 0.08).
- **Take-off, loop, landing with a trail** (demo ShotOrbit): ON_A / ON_B in screen pt, loop points in screen pt
  projected at mid-flight -> `spline` -> `pathFlight` + `trail`; two `handoff`s; confetti from the landing point.
- **Two phones + headline** (demo ShotPair): phones at x 140 / 600 (z -150), rotation y -12 / -16, `shift: [0.19, 0]`,
  `<Headline region="left">`; 9:16: overlap them under `region="top"`. Start a shot already moving (keys from a
  negative frame) so no frame after a cut is empty.
- **Attach to the phone**: `P.local(pose, [x, PHONE.outline.h / 2, -PHONE.depth / 2])` is the top edge; size with `s`.

## Workflow: stills, renders, grids, QA
- **Storyboard stills**: `node scripts/celstills.mjs --out=out/sb --sheet=sb Comp:120 Comp:240 CompV:240` bundles
  once and renders every still in one Chrome (~15 s bundle, then ~1 s per still), `--sheet` tiles them. It keeps a
  workspace-wide lock (`_state/stills.lock`: one stills job at a time across agents) and reads `src/timing.json`
  (keep the file); `--v` and `@scene:frame` are for cel films. Do not use `remotion still` per frame.
- **Render** from the project folder: `node node_modules/@remotion/cli/remotion-cli.js render src/index.ts Comp
  out/comp-v1.mp4 --concurrency=6 --log=error`. Concurrency 6-8 on an idle machine, 3 when several agents render at
  once. The demo (442 frames) takes about 60 s at 1080p and 80 s at 1080x1920 with 6.
- **Partial renders** (`--frames=a-b`) start the file at frame 0. `vc_frames.py FILE OUT --frames ... --offset a`
  labels and picks film frames on a single partial render; it says nothing about frames past the end of the file
  (they are dropped), so keep the requested frames inside the render. With `--pair` the offset applies to the clone.
- **QA**: `vc_qa.py FILE --spec qa.json` (holds from `endCardTiming(...).holds`; `"audio": false` for silent tests).
  Look at hand-offs with `vc_frames --crop x,y,w,h --zoom 2`, frames `at-3..at+3`.
- **PowerShell**: bracketed folders need `-LiteralPath` everywhere (`Set-Location -LiteralPath`, `Get-ChildItem
  -LiteralPath`); after `Push-Location -LiteralPath` into one, a RELATIVE `-LiteralPath` fails (the location comes back
  escaped): use absolute paths. JSON on the command line loses its quotes when PowerShell passes it to node: write
  props to a file and pass `--props=props.json`. Run an edit and the command that consumes it sequentially, never in
  the same parallel batch.

## Gotchas
- The cel engine (imported by every Root.tsx) turns `THREE.ColorManagement` off: `new THREE.Color(hex)` renders too
  light. Use `srgb(hex)`. Kit materials already do.
- Callbacks must be pure functions of `frame`: tabs render frames out of order. No state between frames.
- Hard cuts between shots and a hard switch tagline -> mark (house rule); no cross-fades or motion blur.
- White phones on white need `halo={{ opacity: 0.18 }}` or a tinted background.
- 9:16: keep text and logos in `fmt.safe` (or `centerSafe` when centred); the phone itself may run under the bottom UI.
- `ui.text` without `color` is black; on dark screens pass `color`.
- A `PhoneStage` builds its meshes on mount (~50 ms); keep one stage per shot, not per element.
- Overlays that should look in front of the glass but hide behind the bezel need clipping by hand (CSS `clipPath`
  with projected points); the island and screen callbacks clip for free.
