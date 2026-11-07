# Scene brief: "<FILM TITLE>" (cel-shaded film)

<!-- Template from _kit/BRIEF-template.md (film 101's brief). Replace the title, FILM path, film name in the commands
     and the shot lists at the end. -->
Workspace (WS): the `3D Cel Shaded Animation` folder (the folder holding `_kit`, `_tools`, `_state`).
Film folder (FILM): `<WS>/[NNN]<film-slug>`
(brackets in the path: in PowerShell ALWAYS start a command with `Set-Location -LiteralPath "<FILM>"`).

A programmatic cel-shaded anime film: Three.js inside Remotion, everything procedural. The look target is
modern cel-shaded anime / Arc System Works / Spider-Verse: clean toon bands, coloured outlines, designed
lighting, anime shot grammar (ECU…EWS), characters animated ON TWOS, camera on ones. The narration (Flint) is
done and timed; you write the pictures for your scenes.

## Your job
Write `src/scenes/<id>.tsx` for each scene you are given (they exist as placeholder stubs exporting the
component name used in `src/scenes/index.ts`, e.g. `export const Builder: React.FC<SceneProps>`). Keep that
export name. Study `src/scenes/intro.tsx` and `src/scenes/son.tsx` first: they are the reference for structure
and quality.

DO NOT edit anything else: not `src/cel/*` (the engine), not `src/scenes/common.ts`, `index.ts`, `CelFilm.tsx`,
`Root.tsx`, `script.json`, `timing.json`. Other agents work in parallel. If the kit lacks something, build it
locally inside your own scene file (helpers at the top of your file) and mention it in your report. If you find a
kit BUG that blocks you, work around it locally and report it precisely (file, function, symptom).
Keep your files compiling at all times (other agents' renders bundle the whole project): write whole files,
then run `npx tsc -p . --noEmit` and fix errors in YOUR files.

## Timing
`src/timing.json` has each scene's `duration` and `groups[i].at` (frame the caption appears; the voice starts
6 frames later). Your component gets `{ dur, g }` with `g[i] = groups[i].at`. Lay shots with
`timeline(dur, [[0, ShotA], [g[1] - 6, ShotB], ...])` (start frames; cut a few frames BEFORE a line starts).
Find a word's frame: from `WS/_tools`: `python words.py "[NNN]<film-slug>" touched`
(prints scene, group and frame offset). Key actions to words (the touch on "touched", the jar on "wine").
Shot length: 2.5-6 s typically; a scene of 20-30 s has 4-7 shots. Hard cuts only (no fades inside a scene).

## Shot recipe (see common.ts header)
```tsx
const ShotA = shot("golden", (k) => {          // preset: dawn day golden dusk night predawn interior lamplight desert storm
  const set = galilee(k, { seed: 3 });           // or shore(k), nazareth(k), workshop(k), or your own set
  const j = k.add(new Human(CAST.JESUS));        // hero detail by default; { detail: "mid" } for wide shots
  j.place(0, 0, 0, set.h(0, 0));                 // x, z, facing yaw deg (0 = +z), ground y
  return (f) => {                                // f = shot-local frame
    const fs = stepped(f);                        // characters on twos
    j.pose({ shR: [40, 0, 12], elR: [60, 0, 0], handR: "open", head: [5, 0, 0] });
    j.expr({ smile: 0.3, blink: blinkAt(fs, 1), light: 1 });
    k.cam({ target: j.point("eyes"), size: "CU", yaw: 25, pitch: 2, lens: 85, sx: k.p(0.25, 0), sy: k.p(0.08, 0.12) });
    k.key(40, 25);                                // key light 40 deg off camera-left, 25 up (after cam!)
  };
}, { post: () => ({ dof: 0.8, focus: 1.6, focusRange: 5 }), shadow: { center: V3(0, 1.2, 0), size: 1.6 } });
```
Shot defs MUST be stable: define them at module level, or build parametrised ones inside `useMemo` in the scene
component (a new function every render rebuilds the scene every frame).

## Kit API (read the source for details)
- **cam.ts** `k.cam(Frame)`: `{ target: Vector3, size: "EWS"|"WS"|"FS"|"MS"|"MCU"|"CU"|"ECU"|number(m of short side), yaw (deg around target, relative to facing; 0 = in front), pitch (+ looks down), lens (mm), facing (subject yaw), sx, sy (where target sits, in half-frames; +x right, +y up), roll }`. `lerpFrame(a, b, t)`, `ease.{inOut,out,in,sine,back}`, `seg(f, a, b)`, `keys(f, [[f0,v0],...])`, `stepped(f, 2)`. Shake: `k.cam(fr, 0.01, f)`.
- **Human** (`cel/human.ts`): `new Human(look, { detail: "hero"|"mid"|"crowd" })`; `.place(x, z, yaw, y)`; `.pose(Pose)` (degrees; see the header: sh=[raise fwd, twist, abduct], el=[bend], wr=[pitch, twist, flex], hip=[raise, twist, abduct], kn=[bend], an=[toe down], spine/chest/neck/head=[pitch fwd, yaw left, roll], `root: { p: [x, y, z] }` offsets the hips (kneel: y -0.43 with kn 90), handL/handR: `relax open flat fist point hold grip cup bless touch`); `.reach("L"|"R", worldTarget, pole?, weight)` two-bone IK (call AFTER pose); `.lookAt(worldPt, amount)` (after pose); `.expr({ blink, closedStyle: "calm"|"happy", lookX, lookY, brow, sad, smile, open, squint, wide, tears, light: ±1 side of key light, blind })`; `.point("head"|"eyes"|"eyeL"|"eyeR"|"nose"|"mouth"|"top"|"chest"|"hips"|"handL"|"handR"|"footL"|"footR")`; `.holdIn("R", obj, offset)`; `.skinTo(from, to, k)` (leper healed); `.glow(k)`; `walkPose(phase, amt, base)`, `blinkAt(fs, seed)`; `walkTo(j, f, [x,z], [x,z], { h, speed, f0, base })` (common.ts).
  Robes: "stand" looks have a long skirt (legs hidden); "legs" looks (`CAST.JESUS_KNEEL`, LEPER, BARTIMAEUS, WOMAN) cover each leg for kneeling/sitting.
- **CAST** (`cel/cast.ts`): JESUS, JESUS_WORK (no mantle, narrow sleeves), JESUS_PLAIN, JESUS_SERVE (towel-white sash, narrow sleeves), JESUS_KNEEL, JESUS_BOY, MARY, MARY_OLDER, JOSEPH, JOHN_B (Baptist), PETER, JOHN_A, LEPER, PARALYTIC, BARTIMAEUS, BOY, WOMAN, PHARISEE, RICH, BRIDE, GROOM, STEWARD. `crowdLook(i, "man"|"woman"|"child"|"elder")`, `villagers(n, seed)`, `splitCrowd(spots, views, { far, max })` + `crowdDetail(d)` (per shot: real Humans for everyone in view within ~15 m, max ~60), `crowdField({ n, place: (i, R) => [x, y, z, yawRad] | null, seated })` (instanced, background beyond 15 m only). JESUS_BOY has no red drape; the adult JESUS always has it.
  Palette rule: only Jesus wears cream + deep red; Mary blue.
- **Sets** (`scenes/common.ts`): `galilee(k, { seed, flat:[x,z,r], sea, seaZ, path: x=>z, trees: [[x,z,s]], grass, zero })`, `shore(k)`, `nazareth(k)`, `workshop(k)`; (`cel/sets.ts`): `house`, `village`, `room({ w, d, h, omit, beams, window, door, outside })` (walls face inward, omit the camera side), `waterPlane`, `palm`, `cypress`, `reeds`, `stars({ moon })`, `colonnade`, `paving`, `gardenTomb({ open })`, `golgotha({ x, z })`, `desertHeight(seed)`, `riverValley(base, course, width, depth)`; (`cel/world.ts`): `sky`, `terrain({ size, h, color })`, `hillRing`, `cloud`, `oliveTree`, `rockMesh`, `grass`.
- **Props** (`cel/props.ts`): `plank workbench hammer saw chisel shavings stoneJar({h}) -> {group, liquidM, top} cup oilLamp table({w,d,h,cloth}) loaf fish basket({full}) basin pitcher towel mat({ropeH}) stone coin moneyBag flowerGeo("lily"|"anemone") bird() -> {group, flap(ph)} torch crossSil graveClothes`. Basket, basin, stone jar and pitcher carry their walls (`userData.solid`) and footprint for the contact pass.
  Liquid to wine: `jar.liquidM.uniforms.uColor.value.lerpColors(water, wine, k)` (also uShade).
- **FX** (`cel/fx.ts`): `particles`, `miracleSparkles(center, {n, radius, height})` -> call `.update(t)` each frame; `motes(box)`; `beam(from, to, {r0, r1, color, opacity})`; `glow(pos, size, {color, opacity})` (push into `k.faces`); `flame(pos)` (add `.group` and `.glow.obj`, push into `k.faces`); `droplets(center)`.
- **Post** (per shot `post: (f) => ({...})`, see `defaultPost` in engine.ts): `dof focus focusRange` (depth of field), `bloom bloomT`, `rays raysCol sunDir`, `paraTop paraBot paraAmt` (gradient grade), `exposure contrast saturation`, `halftone`, `flash flashCol` (white flash 0..1), `impact` (posterised impact frame 0..1: use for 2-4 frames on a miracle beat), `vignette`, `lineW`.
- **Overlay** `FocusLines` from `../CelFilm` (radial anime speed lines): render it in your scene component above `<Cuts>` inside an `<AbsoluteFill>`, driven by `useCurrentFrame()` (scene-local), for 10-25 frames on a miracle beat.
- **Maps** (`src/mg`, the motion-design style kept for explaining geography): `<MapInsert spec={(f, c) => MapSpec} />` is a full-frame gold-line map (use it as a whole scene or as one cut: `<Sequence from={..}>`); `mapProp({ w, h, kind: "sheet"|"scroll"|"wall" })` puts the same map on a 3D prop (`.draw(spec)` per frame, `.pointOn(spec, "jerusalem")` for `reach`), wrap that scene in `<MapFontsGate>`. MapSpec: `view` (`{ lon, lat, span }`, span = degrees across the short side; animate with `mapCam([[f, view], ...], f)`), `draw` (coasts 0..1), `rivers`, `routes` (`{ via: ["antioch", [35.5, 32.1], ...] | JOURNEYS.paul1, p, smooth, arrow, faint }`), `pins` (`{ at, a, label, dx, dy, big, kind }`), `light` (`{ at, r }`), `head` (`{ at: routePoint(route, p), a }`). Places: `mg/places.ts` (ids like `jerusalem`, `galilee_sea`, region `judea`). Reference: `src/MapLab.tsx` (compositions MapLab0-2).

## Hands, objects, bodies (the standard: CelshadedSKILL.md section 8; reference `src/HandLab.tsx`)
- Build every hand direction from the figure's own `j.axes()` (`left`, `up`, `fwd`).
- `j.placeHand(sd, at, { palm, fingers, ref: "palm" | "tips" | "wrist" | "grip" })` puts a hand exactly on a point,
  oriented: a shoulder or back (palm down onto it), a table, eyes (tips), a tool's knob, a held object's grip.
- `j.holdBoth(center, { half })`: both hands on one object, palms in, left hand on the left. Never cross arms.
  By a vessel's sides: `half` = its outer radius at that height minus 3 mm, then `j.hand(sd, "support")`, fingers
  straight down along the wall; from beneath: palms up just under the base, `support`, fingers level. Keep it within
  reach (elbows a little bent).
- Never build a hand orientation yourself (no local palmTo / makeBasis helpers): `placeHand`, `aimHand`, `holdBoth`
  only. Prayer: each palm 9 mm past the middle, fingers up, `j.hand(sd, "pray")`.
- A hand that will take something starts at rest (knee, thigh, side) and rises on an arc under the object, the palm
  turning through facing the other hand. A passed object is always gripped by whoever holds it (grip / release each
  frame), handed over at a point both arms reach.
- `j.grip(sd, obj, { kind: "wrap" | "ball" | "palm" | "pinch", r, at, axis, roll })` / `j.release(sd)`: objects sit in
  the hand (handle r 0.014, cup r 0.043, stone ball r 0.045-0.06); the fingers stay closed round them. No `holdIn` guesses.
- Hammer: grip at the handle end with `roll: -Math.PI / 2`; raised by the shoulder; strike from the elbow with the head
  flat on the nail (`placeHand(..., { palm, thumb: axis, ref: "grip" })` at `nail + up * 0.065 - axis * 0.265`: give
  `thumb` for every held tool so its axis is exact); the other hand pinches the nail.
- Close hands: `sleevesUp(0.55)`, `receiveShadows(false)`; side close-ups of robed feet: `walkTo(..., { step: 0.55 })`.
- Cups upright in a wrap grip, thumb up; tilted toward the face only while sipping, head back; toasts above the shoulder.
- Reach is 0.54 m + 0.17 m of hand: stand people close and lean them in. Contacts never interpenetrate: render a CU of each.
- Healing shows the touch (1-2 s MCU/CU) before the miracle accent. Children: hand on shoulder or back, never on the head.
- Nobody walks through anybody: check stills along every path. Robes: feet and ankles only under full robes (engine).

## Look and direction rules
- Light every shot deliberately: `k.key(az, el)` after `k.cam`. Faces: az 30-50 (three-quarter key). Drama:
  backlight az 120-160 with rim. Night: moonlight from above-side, warm lamps as `glow`/`flame`.
- Composition: subject on thirds in 16:9 (`sx: k.p(±0.3, 0)`), centred in 9:16; foreground elements for depth;
  DOF on CU/ECU (`dof 0.7-0.9`, focus = camera-to-subject distance ≈ cover × lens/24).
- Shot sizes vary with purpose: open a scene wide (EWS/WS) to place us, go in for emotion (CU/ECU), cut on action.
  Use ECU for miracle details (eyes opening, hands touching, water becoming wine, bread breaking).
- Motion: characters on twos (`stepped(f)`), anticipation and settle (`ease.back`), blinks, small breathing.
  Camera on ones, slow and purposeful (push, drift, gentle orbit); no spinning or fast zooms.
- Chapter card: the FIRST shot of a chapter scene (one with `virtue` in timing.json) shows a red title slab in
  the lower-left (16:9) / lower-middle (9:16) for frames 0-84: keep faces out of that zone then (wide or
  high-placed subject).
- Captions are not drawn into the picture, but uploaded subtitles appear at the bottom (16:9 bottom 8-20 %; 9:16
  around 62-76 % of the height); keep key faces above.
  9:16 safe zone: keep key action out of the top 8 %, bottom 20 %, left 5 %, right 12 %.
- Restraint (house style): God only ever as light (rays, a beam from heaven, a dove for the Spirit); the tempter
  is a featureless dark shadow or not shown; violence is implied, never shown; the crucifixion appears only as
  three distant dark crosses under a darkening sky (`golgotha()`), with the faces of those watching; lepers with
  bandaged hands and hood, pale skin, nothing graphic.
- Interfaith audience: the film presents his life and example; no hostility toward anyone.
- Performance: hero Humans ≤ ~12 per shot (each is ~60 meshes); `detail: "mid"` beyond 4 m; crowd people within
  15 m are real Humans (`splitCrowd`, `crowdDetail`: "crowd" detail with a small face from 6 m, ≤ ~60 per shot);
  `crowdField` only for the background beyond 15 m; grass ≤ 6000.
- No egg heads near the camera, no bald scalps under veils or on elders, the boy Jesus without the red drape.
- Cameras aim at `h.aim()` or fixed points, never `point("eyes")` while the head turns; glances blend the look target.
- Hands and feet in basins, bowls and jars: `cel/contain.ts` (`keepIn` per frame, `fitVessel` at build). Tucked feet
  hide themselves (`autoFeet`); do not pose feet sticking out behind a robe.
- The engine's contact pass (`cel/contact.ts`) moves hands up to 3 cm out of baskets, basins, jars and pitchers and
  clears grass under resting props and seated people. Deeper contacts print `[contact] <look> hand L: N cm into a prop
  (fix the pose)` under the still: fix the pose until no warning is left. A new vessel-like prop needs
  `userData.solid = { outer, inner }` and `userData.footprint`.
- White robes under warm or night presets: a warm `robeShade`, a light `shadeK`, a front key in a pale sky tint for
  the hero CU (CelshadedSKILL.md section 8 rule 29).

## Review loop (required)
From FILM: `node scripts/celstills.mjs --out=out/review/<id> --sheet=<id> "@<id>:<frame>" ...` renders Film
frames by scene-local frame (add `--v` for 9:16; outputs `v-<id>-<frame>.jpg`). Keep every `"@<id>:<frame>"`
in quotes: unquoted, PowerShell reads `@name` as splatting and node gets no arguments (it renders nothing and exits 0).
A workspace-wide lock (`WS/_state/stills.lock`) queues renders; each still takes about 1 s. Render every shot at its key moment in BOTH orientations, open the sheet
images with the Read tool and look hard: faces readable and lit, no limbs through bodies or props, feet on the
ground, nothing important cut by the frame or hidden by captions/chapter card, portrait framing works, lighting
designed, background not blown out. Fix and re-render. Iterate until it is genuinely good; then render a final
sheet per scene in both orientations.

## Motion check (required: stills cannot show flicker; CelshadedSKILL.md section 8b)
- Turning: never lerp a facing. `turnOnSpot(from, to, t, base)` over `turnFrames(angleDelta(from, to))` frames, or
  `walkTo(..., { fromYaw, toYaw })`; `turnYaw` for anything else that changes facing.
- Never coplanar: a piece set into a wall sits 3-5 mm behind it, a layered trim or decal stands >= 2 mm proud, a box
  resting on a surface sinks 1 cm in or stands 1 cm proud. Check each new set with `celstills.mjs ... --qa`.
- Oscillations driven by a frame count stay under ~1.2 rad per frame (pen strokes, nibs, bobbing); no per-frame random.
- Characters on ones when the camera moves more than ~8 px a frame, when it tracks a walking character, or when a
  character passes within ~2 m of the lens; close-up pans over text or hands under ~8 px a frame.
- A camera never follows a point placed on twos (`j.root.position`, `j.aim()`, `j.point()`): follow the path at `f` or a
  point fixed at build.
- Moving close shots of curly hair: `rimAmt` ~0.6 (a strong rim boils on the curls as the viewpoint changes).
- Before reporting: from `WS/_tools`, `python lint_scenes.py "<film>"` (no errors) and
  `python preview.py "<film>" <your scene ids>` (and `--v` for 9:16). Every flickering second it prints comes with a heat
  map in `out/qa/flicker-<scene>-<frame>.jpg` (flickering pixels in red): fix the shot. If it is intended fast motion
  (a particle stream, travellers on a path), say so in your report with the frames; the architect signs it off in qa.json.

## Report (final message)
Per scene: shot list as built (start frame, size, what happens), the final sheet paths (16:9 and 9:16), any kit
bugs or missing kit pieces (with the local workaround), and anything you could not achieve.

---

# Shot lists

Frames are scene-local. g = caption start frames (from timing.json). Durations: see timing.json.

## builder (dur 555; g 22, 131, 335) — "A BUILDER", workshop, warm interior day
1. 0: ECU his hands working a plank with a plane or chisel; curls of shavings; dust motes in a sunbeam. (Card zone
   lower-left: frame the hands upper-right.)
2. ~g1-6: CU hammer strikes a peg (sound "hammer" is in the score): hand + hammer, on twos, a small impact
   flash of dust.
3. ~g1+70: MS Jesus (JESUS_WORK) at the bench, looking down at his work, sunbeam behind; a neighbour passes
   the bright doorway (silhouette) and greets him; he looks up and smiles.
4. g2-6: WS the workshop (workshop(k) set) from the door side, light shafts, him lifting a finished beam/plank
   onto his shoulder.
5. ~g2+110: CU face, focused, sawdust drifting in the light; slow push in. "patience, skill, and honest work".

## jordan (dur 782; g 22, 181, 377, 529) — "HUMBLE", Jordan river, bright day / divine light
Build a river: `riverValley(galileeHeight(...), x => course, 8, 1.6)` terrain + `waterPlane` at the water level +
`reeds` along both banks + palms/rocks. A line of ordinary people waiting at the bank (villagers).
1. 0: EWS the Jordan valley, river winding, small crowd on the bank, John in the water; Jesus walking down the
   path among them (card zone free).
2. ~g0+100: WS people waiting in line; Jesus takes his place in the line, behind an old man.
3. g1-6: MS John (JOHN_B) waist-deep, hands raised in protest, wild hair; CU John's face, surprised.
4. g2-6: WS low angle near the water surface: Jesus (JESUS_PLAIN, no mantle) stepping down into the water;
   droplets/ripples (`droplets`).
5. g3-6: heavens open: shot from below looking up past Jesus to the sky, a broad warm `beam` from the clouds,
   a white dove (`bird()`) descending in the light, `rays` up, `flash` tiny; then CU Jesus, eyes closed, face up
   into the light, water running; serene.

## desert (dur 666; g 22, 167, 431) — "PURE", wilderness, harsh sun then sunset
Terrain from `desertHeight`, sand/ochre colours, rock outcrops (`rockMesh` flat-shaded), heat sky.
1. 0: EWS a tiny figure crossing the dunes under a huge sky (card zone free).
2. ~g0+80: MS Jesus (JESUS_PLAIN) sitting on a rock, thin, tired, wind moving the mantle-less robe.
3. g1-6: ECU stones on the ground that look like loaves; his hand rests near them and does NOT take one;
   a dark featureless shadow (a flat dark figure silhouette, no face) falls across the stones.
4. ~g1+120: WS on a high cliff edge at sunset looking over kingdoms (distant city silhouettes/hills, warm
   haze); he turns away from the view.
5. g2-6: CU low-angle hero shot, face resolute, wind in the hair, sunset rim light; push in.

## prayer (dur 665; g 22, 221, 428) — "PRAYERFUL", night to dawn on a mountainside
1. 0: EWS mountainside at predawn (stars, deep blue, a thin warm horizon), a tiny kneeling figure on a rock
   (card zone free).
2. ~g0+100: WS Jesus kneeling (JESUS_KNEEL, kneel pose: `root:{p:[0,-0.43,0]}, kn 90, an 40`), hands together,
   head bowed, olive tree silhouette, stars.
3. g1-6: CU face in prayer, eyes closed (blink 1, calm), moonlight rim; then EWS the starry sky turning (slow
   tilt) with the figure tiny under it.
4. g2-6: dawn breaks: the first sun ray reaches his face (warm key from the horizon, `rays` 0.3); he opens his
   eyes, peaceful, slight smile; CU → ECU eyes.

## cana (dur 806; g 22, 161, 322, 516) — "GENEROUS", wedding courtyard, warm evening with lamps
Courtyard: `paving`, house walls around (house() or room walls), a tree, strings of lamps (`glow`/`flame`),
a table with cups, six stone jars (`stoneJar`), guests (villagers), BRIDE and GROOM, STEWARD, servants.
1. 0: WS the celebration: dancing guests (simple stepped sway), lamps, music feeling (card zone free).
2. ~g0+70: CU a servant tips an empty jar/cup: nothing left; worried faces; the young couple's anxious look.
3. g1-6: MS Mary (MARY) speaks to Jesus, then turns and gestures to the servants ("Do whatever He tells you").
4. g2-6: WS six stone jars; servants pour water from pitchers into them; Jesus gestures.
5. ~g2+90: ECU the water surface in a jar turns deep red-purple wine with sparkles (`liquidM` colour lerp,
   `miracleSparkles`, 2-frame `impact` or `flash`, `FocusLines`) — keyed to the word "wine".
6. g3-6: MS the steward tastes, eyes wide (wide 1), delighted; then WS the feast going on, couple laughing,
   Jesus smiling in the background.

## leper (dur 630; g 22, 110, 388) — "A HEALER", dusty road outside a village, golden light
1. 0: WS a road with townspeople; a hooded figure approaches; people step back, cover their faces
   (card zone free).
2. g1-6: MS the leper (LEPER, kneeling pose) in the dust before Jesus; bandaged hands raised; CU his pale face,
   hopeful, afraid.
3. ~g1+130: CU Jesus, compassion (sad 0.4, soft eyes) — keyed to "touched": ECU Jesus's hand reaching and
   resting on the man's shoulder/cheek (use `reach`).
4. g2-6: CU the leper's face as light washes over him: `skinTo(pale, healthy)`, sparkles, `glow`; he looks at
   his hands (bandages falling away optional), tears of joy, smile.

## roof (dur 662; g 22, 187, 382) — Capernaum house, day
1. 0: WS the house exterior (house()), crowd packed at the door; four friends carrying a man on a mat
   (`mat()`), unable to get in.
2. g1-6: WS on the flat roof: friends digging an opening; then from INSIDE (room() with a roof opening — build
   the ceiling locally) looking up: light pours down through the hole (`beam`), the mat descends on ropes
   (`mat({ ropeH })`) over the crowd's heads; Jesus looks up.
3. g2-6: MS Jesus speaks to the man on the mat ("Get up"); CU the man's face, disbelief → joy.
4. ~g2+120: WS the man stands, rolls up his mat, walks out through the parting crowd; amazed faces.

## blind (dur 937; g 22, 316, 447, 626) — road outside Jericho (palms, city wall), bright day
1. 0: WS the road with a crowd following Jesus; Bartimaeus (BARTIMAEUS, sitting, `expr({ blind: 1 })`) at the
   roadside on his cloak, calling out; people hush him (pointing, scowling).
2. ~g0+120: CU Bartimaeus shouting louder, blind eyes; dust.
3. g1-6: MS Jesus stops, the crowd stops; he turns toward the voice. CU Jesus: "What do you want Me to do for you?"
4. g2-6: ECU Bartimaeus's eyes: clouded (blind 1) → opening clear (blind 0) with a white light bloom,
   `impact` 2-3 frames, `FocusLines`, sparkles: the showcase shot of the film. Then his POV: Jesus's face
   coming into focus (dof from 1 to 0).
5. g3-6: MS Bartimaeus on his feet, laughing, looking at everything; WS he follows along the road with the
   crowd; then a short montage feel: CU faces of the healed? (keep simple).

## feeding (dur 942; g 22, 200, 383, 640) — "A PROVIDER", hillside by the Sea of Galilee, golden → dusk
1. 0: EWS the green hillside above the sea, thousands seated (`crowdField` 1500+), golden light (card zone free).
2. ~g0+100: WS the crowd, evening shadows; tired families.
3. g1-6: MS the disciples (PETER, JOHN_A, villagers) worried, talking to Jesus; CU Jesus: "You give them
   something to eat."
4. g2-6: CU a BOY offering a small basket with five loaves and two fish (`basket`, `loaf`, `fish`); Jesus kneels
   to him, smiles; ECU Jesus's hands breaking a loaf (two halves in his hands, light, sparkles), looking up
   (thanks).
5. ~g2+150: MS bread passed hand to hand along the rows (loaves keep appearing in baskets).
6. g3-6: WS families eating, children laughing; WS twelve full baskets (`basket({ full: true })`) lined up at
   dusk; EWS the crowd at sunset over the sea.

## teacher (dur 724; g 22, 174, 342, 504) — "A TEACHER", hillside (Sermon on the Mount), day
1. 0: WS Jesus seated on a rock (sitting pose: root y ≈ -0.45, hips raise 90, knees 90) on the hillside, people
   seated around and below, the sea far below (card zone free).
2. g1-6: CU Jesus speaking (mouth `open` 0.2-0.4 on twos), gentle gestures; reverse: CU listeners' faces
   (varied crowdLook), surprised, moved.
3. g2-6: MS from behind the listeners toward him; then CU two former rivals in the crowd glance at each other
   and one offers the other bread/water (do to others).
4. g3-6: WS children run up; a disciple steps in to stop them; Jesus raises a hand, welcomes them; MS children
   around him, one on his knee, laughing.

## money (dur 759; g 22, 130, 336, 580) — "FREE", market street then lily field
1. 0: CU coins pouring onto a table/scale in a market, hands counting (card zone: frame coins upper right).
2. g1-6: MS the RICH man in fine robes clutching a money bag, conflicted; Jesus facing him; the rich man turns
   and walks away sad. "You cannot serve both God and money."
3. g2-6: WS a hillside field of wild flowers (instanced `flowerGeo` lily + anemone, thousands), birds flying
   (`bird()` several, flapping on twos); Jesus walking through, his hand brushing the flowers; CU a lily.
4. g3-6: MS Jesus walking free in the wind, simple robe, smiling, birds overhead; ends wide.

## forgive (dur 893; g 22, 248, 540, 676) — "MERCIFUL", temple court in Jerusalem, morning
`paving` + `colonnade` + walls. Accusers (PHARISEE + villagers) with stones (`stone()` held via `holdIn`).
1. 0: WS the temple court; a crowd drags a woman (WOMAN) and leaves her kneeling on the pavement before Jesus
   (card zone free).
2. ~g0+110: CU the woman's face, afraid, eyes down; CU hands gripping stones.
3. g1-6: MS Jesus bends down and writes in the dust with his finger (ECU finger tracing lines on the paving);
   then he straightens and speaks: "Let him who is without sin…" — CU accusers' faces, uncomfortable.
4. g2-6: ECU a stone dropping from a hand to the pavement (repeat 2-3 times, different hands, on twos); WS
   the accusers walking away one by one, the oldest first.
5. g3-6: MS Jesus offers his hand to the woman; CU her face: tears, relief; she stands.

## servant (dur 652; g 22, 231, 428) — "A SERVANT", upper room at night, lamplight
`room` with `outside: "#16203a"` window, low table (`table({ h: 0.42 })`), oil lamps (`flame`), disciples
reclining/sitting (villagers + PETER, JOHN_A).
1. 0: MS Jesus (JESUS_SERVE) ties a towel around his waist, lamp glow (card zone free).
2. ~g0+90: CU water poured from a pitcher into a basin (stream as a thin glowing tube or droplets).
3. g1-6: MS Jesus kneeling (JESUS_KNEEL look but use JESUS_SERVE colours if you can; else JESUS_KNEEL) before
   PETER, washing his feet in the basin; CU Peter's face, astonished and humbled; ECU hands and water.
4. g2-6: CU Jesus looks up at them: "I have set you an example"; WS the room, lamplight, all of them still.

## passion (dur 934; g 22, 258, 470, 764) — "STRONG", Gethsemane night → distant Golgotha
1. 0: WS olive grove at night (oliveTree, moonlight, stars), Jesus kneeling at a rock, alone (card zone free).
2. ~g0+80: CU face in anguish (sad 0.8, tears 0.5, eyes closed), moonlight; "Not My will, but Yours".
3. g1-6: WS torches approaching through the trees (flames + glows on poles, dark figure silhouettes), Jesus
   stands, calm; MS his hands bound in front (rope sweep), he does not resist; no violence shown.
4. g2-6: EWS the three distant crosses on the hill (`golgotha`) under a darkening storm sky (preset "storm"),
   rumble; then CU Mary (MARY_OLDER) and John (JOHN_A) watching, tears; the quote sits on this.
5. g3-6: CU Mary and John side by side; John puts his arm around her (she will be cared for); dark sky, a thin
   break of light.

## finale (dur 1166; g 22, 287, 537, 811, 980) — dawn: empty tomb, then recap and invitation
1. 0: WS the garden tomb at sunrise (`gardenTomb({ open: 1 })`), light pouring out of the doorway (`glow`,
   `beam`), the grave clothes (`graveClothes`) inside; birds.
2. ~g0+130: EWS the road at dawn with the sea: the story spreading — small groups walking out in different
   directions.
3. g1-6 and g2-6: a recap montage of quick shots (40-60 frames each) echoing earlier chapters (rebuild similar
   shots: boy with Mary, workshop hands, prayer at dawn, the healing touch, bread breaking, teaching, washing
   feet, offering the hand to the woman), cut on the listed virtues in the narration (use words.py).
4. g3-6: WS Jesus on a hill road at sunrise, he turns back toward the camera and looks at us; push in.
5. g4-6: CU his face, warm smile, "Go and do likewise"; he turns and walks into the light; ends WS with the sun.

## end (dur 190; no narration) — end card sits on top
A calm, beautiful closing image behind the end card text (centre of frame is covered by text): e.g. EWS the
Sea of Galilee at sunrise from the hills, slow drift, sparkles on the water. Keep the centre uncluttered.
