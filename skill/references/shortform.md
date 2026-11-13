# SHORT-FORM track (Reels / TikTok / Shorts) — Phase 2 + 3 reference

Read this file when the video is vertical short-form and the Phase-1 cut is
approved. Everything here rides on the **data-driven template** at
`assets/shortform/` — the code is immutable; a video is described by ONE JSON.

**Read `references/creative-direction.md` too, before writing edit-data.json** —
it is the direction layer (beat sheet, pacing numbers, motion grammar, sound,
quality gates) and documents the devices in `CustomGraphics.tsx`:
`splitInserts[].src = "gfx:terminal|versus|connect|counter|bigword"` with a
`gfx:{…}` props object, `punches[]` (crash zoom), `whips[]` (cut on motion),
`nameTags[]`. When the user says **"edições criativas"**, that file is the
brief: direct a full edit, don't stop at cut + captions. Shot recipes for
moves we don't have yet: `references/shotcraft/`.

## The style (the proven default)

- **Frame rate:** render at **30fps when the source is 30fps or higher** (natural
  motion, matches Instagram/TikTok/Shorts capture); only slower sources use 24.
  `render.py` picks this automatically for `cut.mp4` — then set `edit-data.json`
  `fps` to the SAME value as `cut.mp4` (ffprobe it) so the Remotion render matches.
- **Base:** 1080×1920 (fps per the rule above), `<OffthreadVideo src=cut.mp4>` with the **dynamic
  camera**, whose three parts are separate picks on the Estilo tab: hard zoom per
  cut segment (`zoomCuts`, ~1.10–1.22, cycles), slow push-in (`zoomAuto`,
  +0.04/segment), clamped eye-tracking (`tracking`, target upper third, never
  reveals an edge). `zoomCuts` is what makes a talking head feel edited — if the
  user turns everything off, say what they lose and build it anyway.
- **Visual hook (first ~4s):** static copywriting headline, **always two lines**
  with the size fitted to them (see "Headline styles"). Always on.
- **Captions:** eleven styles — four word-timed (**minimal**, **destaque**, **tarja**, **editorial**), three animated (**karaoke**, **stacked**, **scatter**),
  three static (**simples**, **serifada**, **classica**) and one adjustable
  (**custom**, "Personalizada"). The user already picked one on the Estilo tab;
  see the "Caption style" section.
  Karaoke: one line ≤3 words, words rise from below, Poppins Black, lower third,
  `measureText` fit into **SAFE_WIDTH 720** (~180px each side — clears
  Instagram/TikTok's right action rail; verified on a real screenshot). Never
  rely on `nowrap` alone.
- **Inserts (upper zone):** rounded-card + shadow motif synced to spoken nouns,
  slow Ken-Burns. Pexels for concrete objects; **bespoke motion graphics** when
  a word names something animatable (timeline for "cortes", typewriter sheet
  for "roteiro" — worked examples in `src/CustomGraphics.tsx`).
- **Zones:** inserts/graphics upper third, captions lower third, face clear.
  Minimalist; accent `#33e0a3`.
- **Audio:** whoosh ~0.09 on card entrances, pop ~0.12 on shapes, music ~0.12,
  and ALWAYS a final loudnorm pass (voice+music+SFX summed will clip). The
  shared sfx pack (`public/sfx/`) also ships `click1`/`click2` (element pops) and
  `tictac` (clocks/countdowns) — trigger any at a local frame by wrapping
  `<Sfx src="click2.mp3" volume={0.7}/>` in a `<Sequence from={frame} layout="none">`.

## Workflow

**Read `<edit>/preview_style.json` first — it IS the brief.** The user chose it on
the Estilo tab at the end of Fase 1; every key maps to something here:

| Pick | What it means |
|---|---|
| `edit: "limpa"` | **the default** — NO split inserts, full frame throughout. See the "Limpa" section |
| `edit: "split" \| "split2"` | the split-screen variant below — every image insert uses it |
| `headline: "outline" \| "card" \| "realce" \| "misto" \| "manchete" \| "pergunta" \| "etiqueta" \| "impacto"` | `hook.style` in edit-data.json (+ `hook.kicker` for the last-but-one three — see "Headline styles") |
| `captions: "karaoke" \| "stacked" \| "scatter" \| "simples" \| "serifada" \| "classica" \| "minimal" \| "destaque" \| "tarja" \| "editorial" \| "custom"` | `captions.style` in edit-data.json (+ the director step for stacked) |
| `captionsCustom` (object, only with `captions: "custom"`) | copy it WHOLE into `captions.custom` in edit-data.json — see "custom (Personalizada)" |
| `accent` (hex) | `hook.accent` + `captions.accent`. Painted by headlines `realce`/`misto`/`manchete`/`etiqueta`/`impacto` and captions `stacked`/`destaque`/`tarja`/`editorial`; `accentUsed:false` means the picked styles have none |
| `elements.softSplit` | `"split": {"seam": 180, "crossfade": 14}` in edit-data.json — ON by default; OFF → leave `split` out (hard seam, hard swap). See the split section |
| `elements.imagesAI` | split inserts come from `ai_images.py` (Gemini) instead of stock search — see "Illustrative images" |
| `elements.tracking` | `face_track.py` + `track.json`; OFF → skip it, fixed frame |
| `elements.zoomAuto` | the slow push-in inside each segment (`+0.04/segment`) |
| `elements.zoomCuts` | the hard zoom change ON each cut (~1.10–1.22, cycles) |
| `elements.flashCut` | `transitions[]` in edit-data.json — see "Flash na transição" |
| `elements.musicAI` | Phase 3 via `treblo_music.py`; OFF → deliver with voice only |
| `note` | free text — read it, it overrides the defaults above |

An unchecked box is an explicit NO, not a silence. Copy the picks into
`state.json` as `style`, clear `awaitingStyle`, delete `preview_style.json`.

1. **Scaffold (one command, never read the TSX):**
   ```bash
   cp -R <skill>/assets/shortform/. <edit>/remotion/ && cd <edit>/remotion && npm install
   ```
2. **Generate machine data into `remotion/public/`:**
   - `cp cut.mp4 remotion/public/`
   - `transcribe.py cut.mp4 --edit-dir <edit>` → `transcripts/cut.json`
     (cut times are already on the output timeline — never map the source EDL)
   - `captions_for_remotion.py --transcript transcripts/cut.json -o public/captions.json`
   - **Caption style** — from the Estilo tab pick. `stacked` ALSO needs
     `caption_style.py --transcript transcripts/cut.json -o public/caption-cues.json`
     plus `captions.style:"stacked"` (see the "Caption style" section).
   - `face_track.py cut.mp4 -o public/track.json` — **only when
     `elements.tracking` is on.** Off, the frame stays put — but the file must
     still EXIST: the template imports it statically and the bundle fails to
     build without it ("track.json doesn't exist" out of webpack, not a runtime
     warning). Write a neutral one instead: every point pinned to the camera
     target, so the follow has nothing to correct.
     ```bash
     python - <<'EOF'
     import json, pathlib
     ed = json.loads(pathlib.Path('public/edit-data.json').read_text())
     n = round(ed['durationSec'] * ed['fps'])
     tx, ty = ed['camera']['targetX'], ed['camera']['targetY']
     pathlib.Path('public/track.json').write_text(json.dumps(
         {"fps": ed['fps'], "width": ed['width'], "height": ed['height'],
          "count": n, "points": [[tx, ty]] * n, "neutral": True}))
     EOF
     ```
   - `public/segments.json` — cut boundaries **measured from the PICTURE of
     `cut.mp4` with `scdet`**, never summed from anything.

     **Read this before reaching for the older recipe below.** Summing the
     encoded segments' frame counts is what this used to say, and under the
     default J-cut it is wrong twice over: the takes OVERLAP, so the sum exceeds
     the output by construction, and the assertion `sum == cut.mp4` aborts with
     "do not ship this file" on every J-cut project. Indexing off
     `jcut_timeline` instead gets you closer but still not there — measured on a
     14-take 30fps edit, the timeline's frame numbers were exact for the first
     three cuts and then slid to **+3 frames** by the end:

     ```
     offsets vs jcut_timeline: 0, 0, 0, +1, +2, +2, +2, +3, +3, +3, +3, +3, +3
     ```

     The cause is not the J-cut arithmetic — it is **29.97 → 30**. An iPhone
     records 30000/1001, `shortform_target_fps` targets 30, and ffmpeg duplicates
     roughly one frame every 33 seconds to make up the difference. Over 71.8s
     that is ~2.2 frames, which the per-segment rounding turns into 3. The
     timeline says where each take was PLACED; the encode then adds frames the
     timeline never hears about. Only the picture knows.

     So measure the picture. `scdet` scores every frame against the previous one,
     and a cut is the peak — even on a single-camera talking head where the
     framing never changes (the lowest peak in that same edit still scored 1.10
     against neighbours under 0.36).

     ```bash
     python3 - <<'EOF'
     import json, pathlib, subprocess, re
     fps = 30                                    # match cut.mp4
     tl  = json.loads(pathlib.Path("edl.json").read_text())["jcut_timeline"]
     def frames(f):
         return int(subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
             "-count_frames","-show_entries","stream=nb_read_frames",
             "-of","default=nw=1:nk=1",f], capture_output=True, text=True).stdout)
     total, cuts = frames("cut.mp4"), []
     for t in tl[1:]:                            # the timeline gives the SEARCH CENTRE
         f = round(t["video_start_in_output"] * fps)
         a, b = max(0, f - 6), f + 6             # widen if a peak lands on the edge
         out = subprocess.run(["ffmpeg","-v","error","-i","cut.mp4","-vf",
             f"select='between(n\\,{a}\\,{b})',setpts=N/{fps}/TB,"
             f"scdet=threshold=0,metadata=print:key=lavfi.scd.score:file=-",
             "-an","-f","null","-"], capture_output=True, text=True).stdout
         sc = [float(x) for x in re.findall(r"=([0-9.]+)\s*$", out, re.M)]
         cuts.append(a + max(range(len(sc)), key=lambda k: sc[k]))
     assert cuts == sorted(set(cuts)), f"picos fora de ordem: {cuts}"
     b = [0] + cuts + [total]
     json.dump({"segments": [{"start": round(b[i]/fps,4), "dur": round((b[i+1]-b[i])/fps,4)}
                             for i in range(len(b)-1)]},
               open("remotion/public/segments.json","w"), indent=2)
     print("offsets vs timeline:",
           [c - round(t["video_start_in_output"]*fps) for c, t in zip(cuts, tl[1:])])
     EOF
     ```

     A peak landing on the edge of its ±6 window means the real cut is outside
     it — widen and re-run rather than accepting the edge. And the offsets should
     be **monotonically non-decreasing**; a peak that jumps backwards is a gesture
     scoring higher than its own cut, not a cut.

     <details><summary>The old sum-the-segments recipe (only valid with <code>--no-jcut</code>)</summary>

     Kept because the reasoning still holds for butt-joined edits: ffmpeg
     quantises each segment to whole frames, so EDL arithmetic in SECONDS drifts a
     fraction of a frame per cut and the error ACCUMULATES.
     **Regenerate it after EVERY Phase-1 re-render.** A stale segments.json is
     invisible: the render succeeds, the overlays look plausible, and every cut
     is off by a frame or three. Measured on this project after a re-grade — the
     file still carried EDL-summed times and drifted +1 frame by the 3rd cut and
     +3 by the 20th, while `VIDEO_LAG` quietly absorbed the first frame of it and
     made the error look fixed. The mechanism: ffmpeg quantises each segment to
     whole frames, so EDL arithmetic drifts a fraction of a frame per cut and the
     error ACCUMULATES. Anything that must land on a cut then sits visibly early.
     ```bash
     python - <<'EOF'
     import subprocess, glob, json, pathlib, sys
     # TWO assertions, because globbing a directory is only as good as the
     # directory. `_v.mp4` first: the J-cut writes video-only segments and a bare
     # glob also matches butt-join leftovers. Then check the COUNT against the EDL
     # and the SUM against cut.mp4 — a re-render with fewer ranges leaves the old
     # higher-numbered segments behind, and that gave segments.json 9.23s for a
     # 7.57s video. It renders clean and every overlay lands wrong.
     segs = sorted(glob.glob("clips_graded/seg_*_v.mp4")) or sorted(glob.glob("clips_graded/seg_*.mp4"))
     nranges = len(json.loads(pathlib.Path("edl.json").read_text())["ranges"])
     if len(segs) != nranges:
         sys.exit(f"{len(segs)} segments for {nranges} ranges — clips_graded is dirty")
     cum, t = [0], 0
     for f in segs:
         n = int(subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
             "-count_frames","-show_entries","stream=nb_read_frames",
             "-of","default=nw=1:nk=1",f], capture_output=True, text=True).stdout)
         t += n; cum.append(t)
     real = int(subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
         "-count_frames","-show_entries","stream=nb_read_frames",
         "-of","default=nw=1:nk=1","cut.mp4"], capture_output=True, text=True).stdout)
     if t != real:
         sys.exit(f"segments sum {t}f != cut.mp4 {real}f — do not ship this file")
     fps = 30  # match cut.mp4
     json.dump({"segments": [{"start": round(cum[i]/fps,4),
                              "dur": round((cum[i+1]-cum[i])/fps,4)}
                             for i in range(len(cum)-1)]},
               open("remotion/public/segments.json","w"), indent=2)
     EOF
     ```
     </details>
   - **In the RENDER the same cut lands one frame later** — that is the
     `OffthreadVideo` lag `VIDEO_LAG` exists for. Both numbers together are the
     proof: cut spike at frame F in `cut.mp4`, at F+1 in the render, overlay
     window opening at F+1. Spot-check one junction in the finished render before
     calling the overlays aligned.
   - `pexels_search.py "<query>" --out-dir public/pexels --count 3 --orientation portrait`
3. **Write `public/edit-data.json`** — the whole edit in one file (schema in
   `assets/shortform/README.md`): durationSec (exact ffprobe of cut.mp4),
   camera zooms, hook lines/logo/sign, captions config, inserts[], behind[],
   soundtrack (leave `enabled:false` until Phase 3).
4. **Verify with stills, batched:** `npx remotion still Reels --frame=<n> f.png`
   for the hook still (user approval), then ONE contact sheet for spot checks:
   `contact_sheet.py <render> --times t1 t2 t3 -o sheet.png` — one image, not N.
5. **Render:** `npx remotion render Reels out/render.mp4`, then loudnorm →
   `edit/final.mp4` (see Phase 3).

Never edit `src/Main.tsx`. Bespoke graphics go in `src/CustomGraphics.tsx`
(the ONE editable file — read it only when the video needs a custom graphic).

## Headline styles — always two lines

Eight looks via `hook.style`, picked by the user on the Estilo tab — four share the Poppins fit below, four have their own face (next section): **`outline`**
(default, white + thick black stroke), **`card`** (dark rounded card, UPPERCASE,
optional logo row), **`realce`** (each line on a solid accent marker block),
**`misto`** (line 1 light white, line 2 heavy accent).

### The accent colour (`accent` in preview_style.json)

`realce`, `misto` and the `stacked` caption are the only things that paint an
accent; the default is `#ff5200`. The user picks it on the Estilo tab and it
arrives as a hex — set it on **`hook.accent`** and **`captions.accent`** in
edit-data.json so headline and caption stay the same colour. `preview_style.json`
also carries `accentUsed`: when it is `false`, the picked styles have no accent
and the colour is not a request to find somewhere to put one.

Hardcoding `#ff5200` anywhere in the template re-breaks this — the preview will
show the user's colour and the render will show orange, which is worse than not
offering the choice.

### The four with their own face (`HeadlineExtras.tsx`)

Same two-line contract, each measured and fitted in its own font:

- **`manchete`** — newspaper strip: red tag + Playfair headline on paper, line 2
  run over with an accent marker. The natural partner of real-news split inserts.
- **`pergunta`** — comment bubble: small grey label + the question in a white
  balloon (Inter). Write `hook.text` AS the question.
- **`etiqueta`** — accent pill naming the subject + clean white Poppins title.
- **`impacto`** — condensed UPPERCASE (Anton), heavy black stroke, line 2 in the
  accent. The loudest one.

**`hook.kicker`** is the small label of the first three. Defaults: `ATENÇÃO`,
`Dúvida comum`, `VOCÊ SABIA?` — write one per video (etiqueta wants the SUBJECT,
e.g. `SUPERENDIVIDAMENTO`). For a regulated advertiser never label the `pergunta`
bubble as a real person's question ("pergunta de um seguidor") unless it is one.

**Author `hook.text` as one plain sentence.** Whatever you write — `text`, or a
hand-broken `lines[]` — is joined and re-broken into exactly TWO lines balanced by
MEASURED width, then the size is fitted to the widest one. A third line shrinks
the type and costs the glance the headline exists to win.

- The break is measured, not counted: "É assim que vai" (4 words) and "ficar a sua
  headline" (3 words) are nearly the same width. Counting words breaks it wrong.
- **`fontSizePx` is a CEILING, not a fixed size.** As a hard override it defeats
  the whole feature: at a size the text cannot fit in, the line wraps and you are
  back to three lines. Measured, not guessed — the uppercase `card` style did
  exactly that at an inherited `fontSizePx: 66`.
- Per-style geometry (weights, cap, safeWidth, lineHeight, paddingTop) lives in
  `HL_STYLES` in `src/Main.tsx` **and is mirrored in the preview's `app.js`** so
  the Estilo tab shows the real break at the real size. Change one, change both.
- In a split layout, `paddingTop` still has to follow the seam — see the split
  section.

## Caption style — seven of them

One is adjustable (`custom`, see its own section below). Of the fixed six,
three are animated (karaoke, stacked, scatter) and three are STATIC
(`simples`, `serifada`, `classica`) — no animation at all, a cue just replaces
the previous one. All three static ones live in `SimpleCaptions.tsx`, read
`captions.json` alone, and share one rule that is the whole point:

**Lines group by MEASURED WIDTH, capped at `maxWords` — never by word count.**
"inteligência" and "de" cannot obey the same rule: the long word takes the line
alone and the short ones ride together. A fixed 3-words-per-line gets this
backwards on every long word.

- `simples` — Poppins 600 at 82, squeezed to 0.9 on BOTH axes, one line, ≤3 words.
  Poppins ships no condensed cut, so this is a distorted regular: it thins the
  stems in both directions. If it ever reads too light, raise the weight to 700
  rather than compressing further.
- `serifada` — Libre Baskerville 700 at 84, same rules, no distortion.
- `classica` — Inter 500 at 52, TWO lines, classic subtitle. The split is width
  balance PLUS a penalty for ending a line on a short function word ("o", "de"),
  which a pure balance does constantly and no real subtitle ever does.
- **The horizontal squeeze changes the line grouping** (narrower glyphs → more
  words fit); the vertical one does not (grouping is measured on width). Worth
  knowing before "just squashing it a bit".
- All three sit at `bottom: 430`, the same band as the others. Lower than that
  and a 9:16 caption lands under the platform's own UI.

### minimal, destaque, tarja, editorial — word-timed (`ExtraCaptions.tsx`)

All four read `captions.json` alone (no extra step), group by measured width
capped at `maxWords`, and — unlike the three static ones — **honour
`captions.windows`**, so on a split layout they move to the seam by themselves.

- `minimal` — word by word, heavy white Poppins, no colour and no SFX; each word
  fades up when spoken and the line holds. The quiet successor of the yellow
  karaoke look. Takes the `color` nudge.
- `destaque` — UPPERCASE with a black stroke; the spoken word sits on a solid
  accent block (ink flips black/white with the accent's luminance).
- `tarja` — broadcast strip: a whole phrase, up to two lines, on a dark bar with
  an accent edge; the spoken word turns accent. Breaks on full stops and pauses,
  not commas. The most institutional one.
- `editorial` — sans line with ONE keyword (the longest content word of the cue)
  in accent serif italic. Static: a cue replaces the previous one.

### Keeping `stacked` / `scatter` off the split art — `windows[].adjustOffsetY`

Those two do not read `paddingBottom`, so `captions.windows` alone leaves them
where they are — and with a user `adjust.offsetY` that is often ON the art of a
`split2`. A window may carry `adjustOffsetY` (fraction of height, replaces
`adjust.offsetY` while the window is up): `-0.16` to `-0.17` parks the stack on
the chest above a `bottom` seam. Check one still; a face closer to the camera
needs a higher `focusY` so the chin clears the stack.

### custom ("Personalizada") — the adjustable one

The other six are their own tuning. This one is all data: the user sets font,
size, vertical position, words per line, text / active-word / outline colours,
outline width, background box, uppercase, pop and shadow on the Estilo tab, with
the caption drawn live over their own cut. `preview_style.json` carries the result
as `captionsCustom`; **copy that object, untouched, into `captions.custom`** in
edit-data.json and set `captions.style:"custom"`. Do not "improve" a value — every
one of them was judged by eye on the real footage.

- Component: `src/CustomCaptions.tsx`. Reads `captions.json` alone — no extra
  generation step. Lines follow the karaoke rule (≤ `maxWords`, break on
  punctuation); the word being spoken takes the `active` colour.
- All sizes are authored at 1080 wide. `posY` is the line's CENTRE as a fraction
  of the height (0.74 default); `captions.windows` still overrides it on a split
  seam, exactly as for karaoke.
- The outline is a second copy stroked at 2× BEHIND the fill. A stroke on the
  fill itself eats half its width into the glyph and thins the letters.
- Fonts are the nine in `FONTS` (Poppins, Montserrat, Inter, Lato, Bebas Neue,
  Anton, Oswald, Libre Baskerville, Playfair Display); only the picked one is
  requested. A new face is one entry there, one in `CUSTOM_FONTS` (app.js) and
  one in the Google Fonts link of the preview's index.html — all three.
- The preview mirrors this component (`buildCustomRenderer` in app.js). Change
  the look in one, change it in the other.
- **Projects scaffolded before this style existed** have no `CustomCaptions.tsx`:
  copy it from the template into the project's `remotion/src/` and bring over the
  import + the `'custom'` branch in `Main.tsx` (three small hunks) before
  rendering — otherwise `style:"custom"` silently falls through to karaoke.
- The user's own presets live in `~/.edvid/caption-presets.json` (outside the
  skill, shared by every project). The UI reads and writes them; you never need
  to.

**Feed the gate real words.** The stage on the Estilo tab plays `cut.mp4` and
draws the caption from, in order: `state.captions`, `remotion/public/captions.json`,
`<edit>/captions_preview.json`. On a first pass none of the first two exist yet,
and the stage falls back to a sample sentence. So before setting
`awaitingStyle`, transcribe the approved cut (`transcribe.py cut.mp4` — Fase 2
needs that transcript anyway) and write
`captions_for_remotion.py --transcript transcripts/cut.json -o <edit>/captions_preview.json`.

### Nudging a fixed style — `captions.adjust`

The six fixed styles take three adjustments from the Estilo tab, sent as
`captionsAdjust` in `preview_style.json`: `scale` (0.6–1.4, 1 = as designed),
`offsetY` (fraction of the height, + is down, measured from the style's own
resting height) and `color` (karaoke and the three static only — Empilhado and
Disperso have palettes, not a colour). Write the object to `captions.adjust` in
edit-data.json; **when the save carries none, delete `captions.adjust`** — a
leftover from the previous render is a silent wrong size.

It is one wrapper (`CaptionAdjust` in `Main.tsx`) around whichever component is
on screen, scaling around the centre of that style's caption band
(`CAPTION_ORIGIN_Y`, mirrored as `ADJ_ORIGIN` in app.js). Font is not adjustable
here on purpose: the mix of faces IS Empilhado and Disperso. Someone who wants
another font wants `custom`. The per-style tunables that already existed
(`stackedOffsetY`, `scatterFontSize`…) still work and stack with this.

### karaoke (default), STACKED or SCATTER

Short-form ships two caption styles. **The user already picked one on the Estilo
tab**, where both previews run the real animation — do not ask again, just set
`captions.style` from `preview_style.json`. (`caption-styles/stacked.png` is
still there as a montage over real footage if a still is useful.)

- **`"karaoke"`** (default): one line ≤3 words, Poppins Black, lower third.
- **`"scatter"`** ("Disperso"): Lora serif, lowercase, off-white with a slight
  darkening toward the baseline, one word at a time in short ragged lines. Reads
  `captions.json` alone — no extra generation step. Ordinary words FADE only; one
  word per cue (the longest, ≥7 chars) resolves out of a heavy blur at 1.62× and
  dissolves back into blur on the way out. Tunables in `captions`:
  `scatterOffsetY` (block centre, default 0.72), `scatterFontSize` (72),
  `scatterSafeWidth` (820); `SPREAD` in the component caps how far a line wanders.
  Three things it took real footage to learn:
  - **Never `Math.random()`.** Remotion renders frames independently, so a true
    random re-rolls the layout every frame and the text shakes. Positions are
    hashed off the cue index.
  - **The middle of the frame is the FACE.** The reference look lives over B-roll;
    on a talking head the block belongs on the chest (`scatterOffsetY` 0.72).
    Raise it only when the shot behind is not a face.
  - **Motion on every word is motion on nothing.** Ordinary words used to drop in
    from above too, and at one word per ~200ms the screen read as frantic. The
    blur on the highlighted word only reads because everything else is still.
- **`"stacked"`**: words stacked tight, mixing per line — Poppins bold-italic
  (white→gray gradient) / Poppins regular (smaller) / Playfair serif bold-italic
  in ORANGE `#ff5200` / Poppins bold. Emphasis words appear solo; key ones get a
  hand-drawn green pencil ellipse. **Baked SFX** (no extra step, no Premiere): a
  **click** on every solo word, a **scratch** when a word is circled.

For stacked, the ONE extra data step is the director (reads the same cut
transcript as `captions_for_remotion.py`):
```bash
uv run python helpers/caption_style.py --transcript <edit>/transcripts/cut.json \
    -o remotion/public/caption-cues.json
```
Then set `captions.style:"stacked"` in edit-data.json (keep the other caption
fields — they stay valid). Defaults match the user-approved look: the stack sits
~15.6% of the height below center and SFX play from `public/sfx/caption-click.mp3`
+ `caption-scratch.mp3` (both already in the template). Optional overrides inside
`captions`: `stackedOffsetY` (0–1 of height), `fontScale`, and
`sfx:{enabled,clickVolume(0.45),scratchVolume(0.16)}`. The director groups words
into short cues, gives the orange serif accent to the content word (never a
connective), keeps 1-letter/short connectors from standing alone, and flags
solo/circled words. It is language-tuned for pt-BR (`--lang`); for other
languages it falls back to length heuristics.

A solo word also needs DURATION, not just weight — a word spoken in under
`MIN_SOLO_MS` (340ms) renders as a one-frame flash and reads as a glitch, so the
director folds it into a neighbouring stack instead. Fast connective speech hits
this often. After generating cues, sanity-check the plan (it prints a summary):
every non-`STACK_MIXED` cue should span ≥0.34s, and the word list across all
cues must match the transcript exactly, in order.

## Visual hook — static headline, first ~4s (always on)

The first 1–2 seconds decide the swipe. Write `hook.lines` like a
social-media/copywriting/virality specialist, not a summarizer: read the cut
transcript, find the core promise/tension, and craft a scroll-stopper. Levers:
**curiosity gap · high stakes/bold claim · specificity/number · urgency ·
pattern interrupt**. Match the video's language; never clickbait it can't pay off.

**Two locked styles via `hook.style`** (both user-approved, encoded in the
template):
- **`"card"`** (default): Poppins Black white UPPERCASE on a dark-gray `#232326`
  rounded card, **every line the same font size (~54)** — never a big hero line +
  smaller kicker. Optional row above the card: real brand logo (rounded card,
  w300) + transparent symbol (drop-shadow, w128) — prefer real assets in
  `public/brand/` over drawn SVG; pick a symbol that frames the angle (danger,
  money, trophy…).
- **`"outline"`**: white text + thick black stroke (`WebkitTextStroke` +
  `paintOrder:'stroke fill'`), **no card**, **sentence-case** (write `lines[]`
  normally, not caps), sits lower (`paddingTop` ~330 — may overlap the top of the
  head, which is fine). The TikTok/MrBeast headline look. Tune `fontSizePx` (68),
  `strokePx` (12), `paddingTop` (330), `lineHeight` (1.06). Drop logo/sign.

Both are static hold, fade+rise at the edges, soft whoosh.

Example (Claude Fable video): "A IA MAIS / PERIGOSA DO MUNDO / ACABOU DE SER
LIBERADA". Draft 2–3 copy candidates in chat (text — no renders), let the user
pick, then render ONE still for design approval before the full render.

**De-conflict:** the hook owns the upper zone for its window — push any insert
that wants the same zone to after `hook.endSec` (e.g. move a 2.5s cutaway to
~4.1s).

## Flash na transição (`elements.flashCut`)

A light beam whips across the frame with a bloom and a dry click. Data-driven:
one entry per cut in `transitions[]`, `at` being the cut time **exactly as
segments.json states it** — `VIDEO_LAG` lines it up with the frame the picture
changes on, same as the split windows. Never index it off its own clock.

```json
"transitions": [{"at": 11.7}]
```

Default placement when the element is ON: **one per split-insert entry, not per
cut.** The video has ~27 cuts; a flash on each one stops reading as an accent and
starts reading as a strobe. Put it where the layout changes, which is where the
transition means something. Optional per entry: `intensity` (default 1), `sfx`,
`volume`.

- **The beam LEADS the cut by 2 frames.** Starting it on the cut frame reads as a
  flash after the fact — the eye sees the picture change, then the light. Leading
  it makes the light look like the cause.
- **Blur is what separates a beam from a wash.** At 26px it read as a general
  brightening; 16px reads as a beam. Raise opacity and lower blur together.
- **CHECK THE SFX FILE BEFORE TRUSTING IT.** The pack's `click2.mp3` peaks at
  −25 dB — it is inaudible under speech at any sane volume, and the mix looks
  fine while nothing is heard. `ffmpeg -i <sfx> -af volumedetect -f null -` is
  the check. `cut-click.mp3` (−2 dB, 57ms) is the one that reads.
- **And check WHERE the transient sits inside the file.** The source this click
  came from had 180ms of silence before the hit; delayed to the cut it would have
  landed 180ms late — after a 230ms effect had already finished. Trim the lead-in
  so the transient is at t=0, then delay by the cut time.
- **The delivered click is mixed by ffmpeg, not by Remotion.** The delivery
  re-mux discards Remotion's audio (it drifts), so add the SFX as another input
  with `adelay=<frame/fps*1000>`. The `<Sfx>` in the component only sounds in a
  plain `remotion render`.

## Style: "Limpa" (`edit: "limpa"`) — no split inserts

The whole frame stays on the speaker. **Leave `splitInserts` out of
`edit-data.json` entirely** (an empty array is fine; a populated one is not) and
skip the split director step. Everything else is unchanged — captions, hook,
zoom, tracking, soundtrack and behind-the-subject all still apply, and they are
where the edit gets its life when there is no art on screen.

Two consequences of the frame never being split, both easy to miss:

- **The hook keeps its full-frame padding.** `hook.paddingTop` is tuned per split
  layout (738 / ~920 for a seam that does not exist here). Under `limpa` the
  headline places against the frame, not a seam — start from the template default
  and render one still, rather than carrying a split value over.
- **`captions.windows` has nothing to dodge.** Those entries only exist to move
  the caption off a split seam. Leave the array empty; a stale window from a
  previous render shoves the caption up for no reason.

**This is the default** (`STYLE_CATALOG.edits[0]`), so it is also what a user who
never opens the Estilo tab gets. Split inserts are opted INTO, not out of. It is a
legitimate final look — a talking-head cut, images to be placed by hand later, or
simply no B-roll worth showing — not a placeholder.

## Style: "tela dividida" (split screen) — two variants

Both pin the FACE to a fixed region and give the rest of the frame to the image.
Data lives in `edit-data.json` `splitInserts[]` (`layout: "top" | "bottom"`); the
component is already in the template's `CustomGraphics.tsx`. Hard cut (no fade),
every window snapped to a take cut, consecutive images contiguous, and
`captions.windows` moves the caption to the seam while a window is up. Full rules
in `assets/shortform/README.md`.

| | **Tela dividida** (`top`) | **Tela dividida 2** (`bottom`) |
|---|---|---|
| Art | top band (750) | bottom band (750) |
| Head | raised underneath, `zoom 1.25 / focusY 400` | held high above, `zoom 1.0 / focusY 225` |
| Caption | ON the seam (`paddingBottom` 1074) | just ABOVE the seam (`paddingBottom` 790) |
| Seam gradient | yes — the caption sits over the art | **no** — it only greys the top of the photo |

**Soft seam (`elements.softSplit`, on by default).** Top-level
`"split": {"seam": 180, "crossfade": 14}` in edit-data.json:
- `seam` (px) — image and footage dissolve into each other across a band centred
  on the seam, instead of meeting on a line. Both layers cross it: the art fades
  out past the seam and the footage is revealed the same distance the other way
  (more source headroom, the picture itself does not move). With it on, lower the
  head a little (`focusY` ~30 less than for a hard seam) so the hair-top clears
  the dissolve, and the dark caption falloff of `top` is dropped — the dissolve
  does that job.
- `crossfade` (frames) — a window that starts exactly where the previous one
  ends dissolves its ART in from the previous image. The footage never fades,
  which is why this is safe where fading the whole split is not: the "hard cut,
  never a fade" rule still holds for the split turning on and off.
Element OFF → omit `split` and you get the classic hard edge and hard swap.

**`focusY` is a SOURCE y that lands at the top of the video window** — a point
`y_src` renders at `(y_src - focusY) * zoom`. **Measure before trusting the
numbers:** pull a frame out of `cut.mp4`, read the hair-top and chin y, and set
`focusY` so the head lands where the user asked. The defaults fit a head ~660px
tall starting at y 455.

The two are opposites in one specific way, and it is the whole trick: the source
has a lot of headroom above the head. `top` has to zoom in to throw that headroom
away; `bottom` **keeps** it, and that is what puts the face under the frame edge
instead of in the middle. Swapping the zoom/focus pair between them breaks both.

**The hook does not transfer for free.** `hook.paddingTop` is tuned to the seam of
whichever layout is up: 738 for `top` (text on the seam under the art), ~920 for
`bottom` (text in the gap between chin and seam). Left at the `top` value, the
headline lands across the speaker's mouth. Render one hook still after switching.

## Behind-the-subject (element between person and background)

Puts an image or giant word(s) BEHIND the person. Great on medium/wide shots;
on tight close-ups anchor elements to the TOP (template already does). Needs
the matting extra: `uv sync --extra matting` (torch).

```bash
uv run python helpers/person_matte.py cut.mp4 -o remotion/public/fg_<name>.mov --start <s> --duration <d>
```

Then describe each window in `edit-data.json` `behind[]` (kind image/words,
matte file, start, dur, words with per-word `at` times). Gotchas the template
already encodes — do not re-learn them:
- ProRes 4444 `.mov` (libvpx silently drops alpha on some builds)
- source RGB composited with alpha, not RVM's `fgr` (halo otherwise)
- `<OffthreadVideo transparent>` or the matte renders opaque
- matte gets the same camera via `frameOffset` or the person drifts

Matte ONLY the windows you need — each file's frame 0 = its window start.

## Illustrative images

### AI-generated (`elements.imagesAI`) — `ai_images.py`

When the user ticks **Imagens por IA** on the Estilo tab, the split inserts are
GENERATED instead of searched: `ai_images.py` (Gemini, `GEMINI_API_KEY` in the
skill's `.env` — an AI Studio key, not the Gemini app subscription). It only has
work to do with `edit: "split" | "split2"`; with `limpa` there are no inserts —
say so instead of inventing a place for them.

1. Pick the windows as usual (snapped to take cuts, the lines that carry weight).
2. For each, write a prompt for the picture THAT LINE needs: a concrete scene in
   English — subject, setting, light, framing. "A hand holding a phone, bank app
   showing a zero balance, dark room, screen glow on the face out of focus", not
   "bank fraud".
3. Put them in one plan and generate in one call, so they share a look:
   `ai_images.py --plan plan.json --out-dir remotion/public/ai` (3:2 default — the
   art band is 1080×750). `--look "..."` overrides the common art direction.
4. **Look at every image before placing it** (`contact_sheet`-style: one Read of a
   montage). Extra fingers, melted text and uncanny faces are routine; regenerate
   that one with a tighter prompt rather than shipping it.

Never ask for readable text, a brand's logo (a bank's above all), or a real
person. For a regulated advertiser (law, health, finance) also avoid a realistic
"client" or "victim" face — hands, objects, screens and silhouettes carry the
same idea without implying a real case. If a generation is blocked or fails, fall
back to the stock helpers below for that window and tell the user which.

### AI clips (`ai_video.py`, Veo) — motion where it earns its cost

Same key as `ai_images.py`. Billed per SECOND and many times the price of an
image, so it is for the one or two windows where movement is the point — never a
default, and never without the user having asked for clips. Defaults are the
cheapest call (lite model, 4 s, 720p). Usual flow: generate the still, get it
approved, then animate THAT (`--image`), so the look is already agreed.

- Veo only outputs 16:9 or 9:16. Feed it a 16:9 still; a 3:2 one comes back
  pillarboxed (`cropdetect`, then crop the bars off).
- A split window is usually longer than 4 s and **the clip must cover its whole
  window** (past its end there is nothing to draw). Slow it instead of paying for
  more seconds: `setpts=<k>*PTS,minterpolate=fps=<fps>:mi_mode=mci` holds up well
  on drifting, particle-like motion; check a few frames before trusting it on
  anything with faces or hard edges.
- Drop the clip's own audio (`-an`) — the track is the speaker.
- A `splitInserts[].src` ending in `.mp4/.mov/.webm` is played as a clip by
  `SplitFrame`; everything else about the window is unchanged.

`splitInserts[]` also takes `zoom` / `focusY` per item, overriding the `LAYOUT`
defaults — measure the hair-top in `cut.mp4` and set `focusY` in the DATA rather
than editing the constants.

### Stock

Pexels for generic concepts (key: `PEXELS_API_KEY`). For brands/people/specific
things, **Wikimedia Commons first** (`wikimedia_images.py` — no key, clean
licensing, prints license+author), then `google_images.py` (needs
`GOOGLE_API_KEY`+`GOOGLE_CSE_ID`, mind rights — pass `--rights cc`, flag
licensing to the user for logos/celebrities). Keep photographer credits.

## Phase 3 — soundtrack (short-form)

Ask: **AI-generated** (Treblo) or **local file** (copy to `public/trilha.mp3`).

**Writing the Treblo prompt — derive it from the video's context, and ask for
MUSIC, not a texture.** Read the cut transcript: what's the topic, energy and
emotional arc? Then describe a real **composed instrumental piece** — name a
**genre + key instruments + tempo/BPM + mood**, and (optionally) a reference
artist/style. Match the content: a hype tech/AI reel wants upbeat modern
electronic with a catchy synth melody; a calm tutorial wants warm lo-fi keys; a
luxury/story piece wants cinematic strings. **Avoid SFX-y phrasing** ("bed",
bare "beat", "sound design", "drones", "risers") — that's what makes Treblo
return sound effects instead of a song. `treblo_music.py` auto-frames the vibe
as a composed instrumental and bans SFX/vocals, but the vibe you pass still has
to read musical.
```bash
uv run python helpers/treblo_music.py "upbeat modern electronic, catchy synth melody, warm analog bass, crisp light drums, ~110 BPM, bright and motivational" -o public/trilha.mp3 --length-min 30 --length-max 60
```
Then flip `soundtrack.enabled: true` in edit-data.json. **Volume:** start ~0.25
and check it's clearly audible under wall-to-wall narration (a bed at 0.12 is
usually inaudible once the mix is loudnorm'd to the voice — confirm by listening,
not just by the meter). Re-render. Finish with the mandatory loudnorm:

**Take the PICTURE from Remotion and the AUDIO from `cut.mp4`.** Remotion's own
audio track drifts against the source — measured on a 95s edit: the voice is
+90ms late by 8s and +660ms by 78s, i.e. it slides progressively out of lip sync,
unnoticeable at the start and obvious by the end. Its audio track also comes out
~0.7s longer than its video. So never re-encode Remotion's audio; re-mux the
approved master instead and mix the soundtrack here:

**Remotion's picture is FULL-RANGE and mis-tagged — never `-c:v copy` it.** Its
output is `yuvj420p`, `color_range=pc`, `color_primaries=bt470bg` (PAL!), transfer
unknown. Measured: luma 0–255 where `cut.mp4` sits at 16–235. Copying the stream
carries all of that into the delivery, so a compliant player shifts the hue off the
PAL primaries and a player that ignores the range tag crushes the blacks — the
Phase-1 grade the user approved drifts at the very last step. Convert the range and
stamp the tags. `setparams` is what makes them stick: the bare `-color_primaries` /
`-color_trc` output flags silently leave both `unknown` here.

```bash
VD=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=nw=1:nk=1 out/render.mp4)
FADE=$(python3 -c "print(f'{$VD-1.5:.3f}')")
ffmpeg -y -i out/render.mp4 -i ../cut.mp4 -i public/trilha.mp3 \
  -filter_complex "[0:v]scale=in_range=full:out_range=limited,format=yuv420p,\
setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[vid];\
                   [1:a]adelay=33:all=1[v];\
                   [2:a]volume=0.10,afade=t=in:st=0:d=0.4,afade=t=out:st=$FADE:d=1.5[m];\
                   [v][m]amix=inputs=2:duration=first:normalize=0[mix];\
                   [mix]loudnorm=I=-14:TP=-1:LRA=11[out]" \
  -map "[vid]" -map "[out]" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 192k -ar 48000 -t "$VD" -movflags +faststart ../final.mp4
```

**Verify the delivery carries the same tags as the cut** — `bt709 / bt709 / bt709 /
tv`, exactly what left Phase 1:
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=color_space,color_primaries,color_transfer,color_range \
  -of default=nw=1 ../final.mp4
```

**Keeping Remotion's audio is sometimes the right call — measure, don't assume.**
The re-mux above exists because Remotion's audio drifts, and on a 95s edit it does
(+660ms by 78s). But the `stacked` caption bakes a click on nearly every word plus
the flash clicks, and the re-mux throws all of that away — reconstructing ~20 SFX
by hand from the cue file is guesswork. Correlate first (15s+ windows, or the whole
clip when it is short): if the offset is CONSTANT across start/middle/end there is
no drift, and Remotion's own audio keeps the SFX with the sync intact. Measured on
a 7.6s edit: +42.7ms at the head, the tail and the whole — constant, and only ~10ms
from the picture's own +33ms lag. There, `-map 0:a` through the same loudnorm beats
the re-mux. Say which one you used and why.

`adelay=33` is one frame at 30fps: OffthreadVideo draws the source frame one
composition frame late (the same VIDEO_LAG the overlays compensate for), so the
picture sits a frame behind cut.mp4's timeline and the voice must follow it.
`-t "$VD"` keeps the audio from outliving the video. **Verify** by correlating the
delivered voice against `cut.mp4` at three points — the offset must be CONSTANT
(≈+33ms). Use 15s windows: short windows lock onto the wrong syllable and report
a drift that is not there. Drop this re-mux ONLY if Phase 2 baked SFX into the
audio (stacked captions' click/scratch), and then verify sync by hand.

If the video has no soundtrack, the same shape without input 2:

```bash
ffmpeg -y -i out/render.mp4 -i ../cut.mp4 -filter_complex "[1:a]adelay=33:all=1,loudnorm=I=-14:TP=-1:LRA=11[out]" \
  -map 0:v -map "[out]" -c:v copy -c:a aac -b:a 192k -ar 48000 -t "$VD" -movflags +faststart ../final.mp4
```

Verify `max_volume ≤ -1 dB` (`-af volumedetect`). Copy to `edit/final.mp4`.

---

## The Estilo tab (between Fase 1 and Fase 2)

The cut is approved and nothing about the LOOK of Fase 2 is decided yet. **Do not
ask the style questions in chat** — set `"awaitingStyle": true` in `state.json`
and the UI opens its own tab, sitting between FASE 1 and FASE 2:

- **Tipo de edição** — `limpa` ("Limpa": no split inserts, full frame throughout —
  **the default**, and the right pick for a talking-head cut or when the user will
  place images by hand later), `split` ("Tela dividida"), `split2` ("Tela
  dividida 2").
- **Cor de destaque** — `accent`, a hex. Sits BEFORE the text styles, because it
  is what they paint with. One spectral swatch (the OS picker) plus a hex field,
  synced both ways — no preset row. Only `realce`/`misto` headlines and the
  `stacked` caption paint an accent, so the save also carries **`accentUsed`**;
  when it is `false` the picked styles have none and the colour is not an
  instruction to invent a place for one.
- **Estilo de headline** — `outline`, `card`, `realce`, `misto`. Always two
  lines, size fitted to the text (see the track reference).
- **Estilo de legenda** — three animated (`karaoke`, `stacked`/"Empilhado",
  `scatter`/"Disperso"), three static (`simples`, `serifada`, `classica`) and
  `custom`/"Personalizada". Picking that last one opens **Ajustes da legenda**
  right under the row: the user's cut playing with the caption on top, the
  knobs beside it, built-in presets and a field to save their own. The save
  then also carries `captionsCustom`. Every OTHER style shows the same stage
  with three nudges (size, height, text colour) and carries `captionsAdjust`
  when one was moved.
- **Elementos da edição** — checkboxes: `tracking` (movimento de tracking),
  `zoomAuto` (automação de zoom in), `zoomCuts` (zoom in/out nos cortes),
  `flashCut` (flash na transição), `musicAI` (trilha sonora com IA), plus a
  free-text observation field.

Saving writes `<edit>/preview_style.json` (its OWN file — a style pick and a
timeline correction are different screens at different moments, and one shared
file would clobber the other) and `watch_edits.py` notifies you with the picks,
**what was left out**, and the observation. Then: build Fase 2 from exactly those
choices, **copy them into `state.json` as `style`**, clear `awaitingStyle`, and
delete `preview_style.json`.

Writing `style` back is not bookkeeping — it is what keeps the tab open. The tab
is enabled while `awaitingStyle` OR `style` is set, so the user can return, change
a caption style or tick one more element, and save again. That save arrives with
`"rerender": true` and the watcher says **REFAÇA a Fase 2** — re-render with the
new choices, don't treat it as a first pick.

**The catalog lives in `STYLE_CATALOG` (app.js), not in a session.** A new editing
or caption style is one entry there plus its implementation in the track
reference; adding it in chat only, for one project, makes it invisible to every
other project. What is in it today is the **short-form** vocabulary (tela
dividida, karaokê/empilhado) — on a longform job the gate has nothing to offer
yet, so skip `awaitingStyle` and ask the layer questions in chat until longform
entries exist here.

---

## Anti-patterns (Fase 2/3)

These moved out of SKILL.md: they only bite after the phase gate, and the
skill prompt is resent every turn.

- Asking the style questions in chat, or starting Phase 2 before the pick lands.
  The gate screen exists so the user SEES what each style does — a chat list of
  names asks them to choose blind. Set `awaitingStyle` and wait for
  `preview_style.json`.
- Treating an unchecked element as "não pediu". It is an explicit NO: the user
  looked at "Movimento de tracking" and left it off. `watch_edits.py` prints the
  `fora:` line for exactly this reason.
- Hardcoding `#ff5200` (or any accent) in the template. The Estilo tab lets the
  user pick it, so a literal makes the preview show their colour and the render
  show orange — worse than not offering the choice. Feed `accent` into
  `hook.accent` + `captions.accent`.
- Changing a caption's look in the template without changing its preview in
  `app.js` (`buildKaraokeDemo` / `buildStackedDemo`). The gate's previews render
  the real faces, sizes and motion, scaled from 1080-wide — that is the whole
  reason the user can choose by looking. A preview that lies about the style is
  worse than no preview.
- Hardcoding a bespoke graphic's timings inside `CustomGraphics.tsx`. Put the
  windows in an `edit-data.json` array (a key the template ignores, e.g.
  `splitInserts`) and map over it — otherwise the graphic is invisible to the
  preview timeline and the user cannot see or retime it.
- Building `segments.json` from ANY arithmetic — summed segment frames, summed
  EDL seconds, or `jcut_timeline` frame numbers. All three are what the edit was
  *asked* to be; only `scdet` on `cut.mp4` reports what it *is*. A 29.97 source
  targeted at 30fps drifts +3 frames over 72s and nothing errors.
- Re-rendering Phase 1 without regenerating `segments.json`. Every Phase-2
  overlay that must land on a cut is indexed off that file; stale, it is off by
  frames and nothing errors. Worse, a `VIDEO_LAG`-style constant can absorb the
  first frame of the drift and make a broken file look correct at the one
  boundary you happen to check.
- Delivering Phase 2 with Remotion's own audio track — it drifts progressively against the source (+0.66s by 78s on a 95s edit). Re-mux `cut.mp4`'s audio and mix the soundtrack in ffmpeg (recipe in the track reference).
- Judging A/V sync with short correlation windows — speech is quasi-periodic and a 2–3s window happily locks onto the wrong syllable, inventing a drift. Use 15s+ windows, and remember a PARTIAL render cannot show drift that accumulates over the full timeline.
- Indexing Phase 2 off `Σ(end−start)` when a `jcut_timeline` exists — the J-cut output is shorter, so everything after the first take lands late.

---

## Helpers de Fase 2/3

- **`captions_for_remotion.py`** (karaoke JSON) · **`face_track.py`** (eye-track JSON) · **`person_matte.py`** (RVM alpha matte; `uv sync --extra matting`) · **`pexels_search.py`** · **`wikimedia_images.py`** (no key, brands/people first choice) · **`google_images.py`** (fallback, mind rights) · **`captions_srt.py`** (longform .srt) · **`chapters.py`** (YouTube chapters) · **`treblo_music.py`** (AI soundtrack — pass a context-driven MUSICAL vibe: genre + instruments + tempo + mood, not SFX-y phrasing; auto-framed as a composed instrumental).
