# Creative direction — "edições criativas"

Read this BEFORE writing `edit-data.json` on any short-form job, and whenever the
user says **"edições criativas"** (his keyword for a fully directed edit). A clean
cut plus captions is NOT an edit; this file is what turns one into a reel.

Distilled 2026-11-13 from a survey of agent video-editing repos (herk-edit-kit
EDITING-PLAYBOOK, motionmaxxing motion studies, video-shotcraft shot cards and
aesthetic rules, OpenMontage creative docs, rea-video breakdown method). Ideas
are restated in our own words; the numbers are theirs, measured on pro edits.
The shot library itself is vendored at `references/shotcraft/` (see NOTICE.md).

---

## 0. The concept comes first — and it comes from the video

A list of devices is not direction. Before anything else, run the
**`video-director` agent** (`agents/video-director.md`). It reads the
transcript and frames, checks `creative-ledger.md` and returns a concept that
belongs to THIS video (a world/format metaphor, a treatment of the footage, or
typography as protagonist) plus a beat sheet with at least two NEW builds, one
of them acting on the footage itself (face-tracked, time, image treatment,
behind the subject). The test: if you could swap in another transcript and
keep the plan, the plan is wrong. Everything below serves the concept.

## 1. Direct before you build — the beat sheet

The director writes the beat sheet in `<edit>/direction.md`, one line per beat:

| beat | time | role | visual subject | device | sound |
|---|---|---|---|---|---|

- **role** — one of: hook, context, info, proof, turn, payoff, CTA. Every beat
  carries ONE idea; write it as a 5–8 word "point".
- **visual subject must change beat to beat.** Two consecutive beats with the
  same subject + same framing = a dead stretch. Vary at least two of: subject,
  scale (punch-in / wide / split / full graphic), motion register (still,
  drift, slam, whip).
- **trigger overlays from the speech type**: a number → counter; A vs B /
  "quem é quem" → versus card; a tool/app name → UI mock (terminal, app
  window); a process → steps/connect graphic; a person → name tag; a key
  claim → bigword slam. Overlays sit on pauses or on the payoff word.
- **one signature device, used 1–2 times.** If a beat works without it, cut it.
- Then present the plan in ONE line and build it — the user said not to ask
  permission to be creative; adjust after he sees it.

## 2. Pacing (measured on pro talking-head reels)

- Voice starts within 0.1 s. No logo, no "oi gente".
- **Something changes every 1–3 s** (cut, punch, graphic, caption colour); no
  static hold > ~3 s. Average shot 1.1–1.4 s on dense reels; never > ~2.8 s
  without a move.
- First visual change at 0.6–1.0 s, on the first charged word.
- Pauses: kill dead air; keep 0.2–0.4 s breaths after commas / list starters.
  Cut between phrases, never inside a word.
- Layout mix on a 30–60 s reel: speaker visible ~45% of the time, never gone
  > ~3.5 s; split/B-roll ~40–55%; punch-ins 5–15%.
- Every 7–8 s of density give one ~1 s rest beat (a held look, no new element).
- Story skeleton: hook naming the tool/person in 3 s → one credibility line →
  the items (each its own beat + visual) → payoff with a callback to the hook
  visual → CTA (show the thing, then punch in on the face for the ask).

## 3. Hook (first 3 s)

- Frame 1 already moves (push-in, slam, or a cut at 0.6 s).
- Headline on screen within 0.5 s, two lines, a question or a stake.
- Keep the hook window ≤ ~2.6 s when the speaker carries the line, so the
  first punch/cut can land before 3 s. (In our template the hook layer sits
  UNDER CustomGraphics, so punches/whips must stay out of the hook window.)

## 4. Motion grammar

- **Land decelerates, leave accelerates.** Entries ease-out (softLand ≈
  `bezier(0.22,1,0.36,1)`, median 10–12 frames at 30 fps); hero/CTA entries
  snap (`bezier(0.12,0.9,0.2,1)`); exits ease-in. Never linear, never
  constant speed. Use ≥3 different easings across a piece.
- **Nothing grows from zero.** Enter from an edge or from 1.5–2.5× oversize
  scaling DOWN, with a blur that clears; or a pop to ~1.08 that settles.
- **No dead frames.** Anything on screen > 3 frames drifts (1–3 px/frame or
  0.5–1% scale creep). Graphic bands drift their grid; held punches creep.
- **Cut on motion.** A accelerates over its last 3–8 frames, the cut falls at
  peak velocity, B's first frame is already moving. That is our `whips[]`.
- **Lead the audio.** On-screen text/graphic arrives 2–5 frames BEFORE the
  word; a punchline visual can lead by ~0.2 s.
- Max ~3 full-frame impacts (punch with shake, flash) per minute, spaced.

## 5. Devices in our template (all data, `CustomGraphics.tsx`)

| device | data | when |
|---|---|---|
| crash zoom / punch | `punches[] {at, hold, zoom 1.15–1.3, shake 0–14, rgb}` | payoff word, name, number; `shake:0` = clean push for "look at this", shake+rgb = "this is it" |
| whip cut | `whips[] {at (a real cut), dir up/left, dist 200–260}` | leaving a split/graphic back to the face, topic turns |
| flash | `transitions[] {at}` | into a split; at most 1–2 per reel |
| split + gfx band | `splitInserts[] {src:"gfx:<name>", gfx:{…}}` | the beat names something showable |
| name tag | `nameTags[] {start,end,kicker,name}` | a person is named |

**Footage-level vocabulary (prefer these over cards):**

| device | data | notes |
|---|---|---|
| official effects on the footage | `fx[] {start, end, effects:[{name, params, rampIn, rampOut}]}` | `@remotion/effects` 4.0.482 via `<Video>` of `@remotion/media`; render with `--gl=angle` (set in remotion.config.ts). Names wired: thermalVision, scanlines, pixelate, chromaticAberration, halftone, duotone, glow, tvSignalOff, zoomBlur, noiseDisplacement, vignette, pixelDissolve, wave, grayscale, tint, contrast, whiteNoise, zigzag, dotGrid, lightTrail. Use as a TREATMENT that means something, not decoration. |
| mirror family | `mirrorTurn`, `mirrorFold`, `syncDrift[]`, `prizeBadge`, `mirrorTunnel`, `endFreeze`, `clueTags[]`, `mirrorType[]` | built for a challenge reel ("O Espelho"); see the header comment in CustomGraphics.tsx. Reusable pieces (syncDrift = delayed copies, endFreeze = picture stops/voice goes on, mirrorType = 3D-flip headline) — but check the ledger: they are that video's signature. |
| freeze / time | `<Freeze>`, `<Sequence from={lag}>` + `DynamicVideo frameOffset` | delayed copies registered to the camera; never show a lagged frame from another shot (`segOf`). |

Upgrading the template to Remotion ≥4.0.523 unlocks `@remotion/video-matting` (text behind the subject without RVM), and ≥4.0.539–542 adds `magnify` (face-locked loupe), `shatter`, `tear`, `filmBurn`, `irisWipe`, `lightning`. Test the upgrade on a copy first.

`gfx:` catalogue (support only) — `terminal` (app/terminal typing a command + steps + done),
`versus` (A = B / A vs B cards, scan line, % counter), `connect` (two nodes, a
pulsing line, badge pops on the payoff word), `counter` (number rolls to value,
lands in accent), `bigword` (words slam in with blur-clear). Add a new one
inside CustomGraphics as another data-driven `gfx:` entry — never hard-code
timings in the component.

Need a move we don't have? Grep `references/shotcraft/shots/` (crash zoom,
speed-ramp freeze, bottom-push stack wipe, type-rhythm sync, slam entrances…),
read one card, re-implement its "motion core" numbers as a new data-driven
device. Remocn (MIT, remocn.dev) is the other quarry: whip-pan, zoom-blur,
impact-shake, marker-highlight, rolling-number, light-leak — copy single
`registry/remocn/<name>/index.tsx` files and strip their docs/customizer
imports; never run its MCP or `npx shadcn add`.

## 6. Captions

- 1–3 words per chunk, appearing ~2 frames early; never over the mouth/chin.
- Colour on 25–45% of chunks, with meaning (accent = payoff/keyword). Never
  two accent serif/colour chunks in a row.
- During a split, park captions on the seam (`captions.windows`).
- On-screen text is not the transcript: graphics say the idea in fewer words.

## 7. Sound

- Mix: voice master at −14 LUFS / ≤ −1 dBTP measured on the ENCODED file;
  music bed ~11 dB under the voice (−9 to −14), faded in/out.
- SFX only on visible events: whoosh for whips/card entries (starts 10–20 ms
  BEFORE the visual, peak on the biggest change), soft impact/pop on punches
  and badges, dry click on flash cuts. No whoosh on every cut, vary the files.
- Check every SFX file's peak (`volumedetect`) and transient position before
  trusting it.
- SFX are mixed in ffmpeg at delivery (adelay in SAMPLES, +1 frame VIDEO_LAG);
  Remotion's own audio is discarded.

## 8. Quality gates (before delivery)

1. Contact sheet: one frame per beat + the frames either side of every device.
2. Read the first 2.5 s frame by frame (hook legible, movement in frame 1).
3. No flat stretch > 3 s; no element static > 3 frames.
4. Faces never covered by graphics/captions at the mouth; band content clear
   of the seam dissolve.
5. Loudness and true peak on the final file; colour tags bt709/tv.
6. Ask: could this reel be any other reel? If yes, the beats lack a specific
   visual idea — fix the beat sheet, not the polish.

## 9. Learning from a reference video

When the user sends a reel he likes ("faz igual a esse"):
1. ffprobe + `scdet=threshold=8`, `silencedetect=n=-40dB:d=0.5`, `ebur128` → cuts/min,
   average shot length, loudness.
2. `watch_video.py` contact sheets; denser frames only around cuts.
3. Per shot: role, point, framing (punch-in vs jump cut vs graphic), overlays,
   motion, sound. Write the hook ("how the first 3 s grab") and 2–4
   highlights as technique + second + why it works — no adjectives without a
   measurement.
4. Re-map those techniques onto OUR transcript (re-time to our sentences,
   never reuse their seconds).
