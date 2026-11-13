# Shot library — vendored from Vincentwei1021/video-shotcraft

Copied 2026-11-13 from https://github.com/Vincentwei1021/video-shotcraft (Apache-2.0, see LICENSE).
Files: `shots/` (124 Remotion shot cards: camera, effects, interaction, opening, outro,
rhythm, transition, typography, ui-entrance, data), `sequences/`, `aesthetic-rules.md`,
`sound-design.md`. Unmodified. The cards are mostly in Chinese: each has a front-matter
block (一句话 = one-liner, 适用 = when to use, 时长 = duration, 能量 = energy) and a
"动效核心" (motion core) section with frame counts and easings.

How to use: when a beat needs a move, grep the cards by tag or idea
(`grep -l "crash\|急推" shots/*/*.md`), read ONE card, and re-implement its motion core
inside our template (CustomGraphics.tsx, data-driven). Never paste their demo code: our
template is talking-head 1080x1920, theirs is product-promo.
