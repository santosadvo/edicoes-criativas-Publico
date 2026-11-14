/**
 * CustomGraphics — the ONE file you edit in Phase 2, and ONLY when a spoken
 * word calls for a bespoke motion graphic instead of a stock image (e.g.
 * "animações" → animated shapes, "roteiro" → a typewriter script sheet,
 * "gráfico" → a growing chart). Everything else is data in edit-data.json.
 *
 * Default: renders nothing. To add graphics, build components here (worked
 * examples below — same upper-zone card motif as the image inserts) and mount
 * them in <CustomGraphics/> with their own <Sequence from/durationInFrames>.
 *
 * Timings: get the payoff word's timestamp from the cut transcript and land
 * the animation on it. Keep 0.5–2s per accent; whoosh on entry, pop on shapes.
 */
import {
  AbsoluteFill,
  Sequence,
  Img,
  OffthreadVideo,
  staticFile,
  interpolate,
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Poppins';
import {Sfx} from './Main';
import editData from '../public/edit-data.json';

const {fontFamily} = loadFont('normal', {weights: ['400', '600', '900']});
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ============ MOUNT POINT (edit this) ==========================================
// STYLE "TELA DIVIDIDA" (split screen) — driven by edit-data.json `splitInserts`.
// Leave the array out and this renders nothing, as before.
type SplitInsert = {
  src: string;
  start: number;
  end: number;
  fit?: 'cover' | 'contain';
  // "gfx:<name>" sources read their content from here (see BAND GRAPHICS)
  gfx?: GfxProps;
  bandH?: number;
  layout?: 'top' | 'bottom';
  // Per-video override of LAYOUT below — the head is where THIS footage put it.
  zoom?: number;
  focusY?: number;
};

// Two variants of one idea — both PIN THE FACE to a fixed region and give the
// rest of the frame to the image:
//   'top'    "Tela dividida"   — art on top, head raised underneath
//   'bottom' "Tela dividida 2" — head held high, art underneath
// The zoom/focus pair is what pins the face and is NOT interchangeable between
// them. `focusY` is a SOURCE y that lands at the top of the video window, so a
// point y_src renders at (y_src - focusY) * zoom.
//   top:    the head must be lifted out of the source's headroom → zoom in hard.
//   bottom: that headroom is the point — it is what puts the face under the
//           frame edge instead of in the middle.
// MEASURE THE SOURCE before trusting these numbers: ffmpeg a frame out of
// cut.mp4, read the hair-top and chin y, and set focusY so the head lands where
// the user asked. The values below fit a head ~660px tall starting at y 455.
const LAYOUT = {
  top: {zoom: 1.25, focusY: 400},
  bottom: {zoom: 1.0, focusY: 225},
} as const;

// A cut transition: a light beam whips across the frame while a short flash
// blooms, with a click on the cut. Data, not JSX — `transitions` in
// edit-data.json — so the windows stay visible to the preview timeline and
// retimeable without touching code.
type CutFlash = {at: number; intensity?: number; sfx?: string; volume?: number};

export const CustomGraphics: React.FC = () => {
  const d = editData as {
    splitInserts?: SplitInsert[];
    split?: SplitOpts;
    transitions?: CutFlash[];
    nameTags?: NameTagItem[];
    punches?: Punch[];
    whips?: Whip[];
    fx?: FxWindow[];
  } & MirrorData;
  const splits = d.splitInserts ?? [];
  const flashes = d.transitions ?? [];
  const tags = d.nameTags ?? [];
  return (
    <>
      <MirrorStage d={d} />
      {d.fx?.length ? <FxLayer items={d.fx} /> : null}
      {d.punches?.length ? <Punches items={d.punches} /> : null}
      {d.whips?.length ? <Whips items={d.whips} /> : null}
      {splits.length ? <SplitScreen items={splits} opts={d.split} /> : null}
      {tags.map((t, i) => (
        <NameTag key={i} item={t} />
      ))}
      {flashes.length ? <CutFlashes items={flashes} /> : null}
      <MirrorOverlays d={d} />
    </>
  );
};

// ============ CUT FLASH =======================================================
// Starts BEFORE the cut and peaks on it. A transition that begins on the cut
// frame reads as a flash after the fact; leading it by two frames makes the
// light look like the thing that caused the change.
// `at` is the cut time exactly as segments.json states it — VIDEO_LAG lines it
// up with the frame the picture actually changes on, same as the split windows.
const FLASH_LEAD = 2; // frames before the cut
const FLASH_LEN = 7; // total, ~230ms at 30fps

const CutFlashes: React.FC<{items: CutFlash[]}> = ({items}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();

  const active = items.find((it) => {
    const c = Math.round(it.at * fps) + VIDEO_LAG;
    return frame >= c - FLASH_LEAD && frame < c - FLASH_LEAD + FLASH_LEN;
  });
  if (!active) return null;

  const c = Math.round(active.at * fps) + VIDEO_LAG;
  const k = active.intensity ?? 1;
  const p = (frame - (c - FLASH_LEAD)) / (FLASH_LEN - 1); // 0..1 pela janela

  // beam sweeps left→right, brightest as it crosses centre
  const x = interpolate(p, [0, 1], [-1.35 * width, 1.35 * width]);
  const beam = interpolate(p, [0, 0.35, 1], [0, 1 * k, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // the bloom is short and lands ON the cut, not spread across the window
  const bloom = interpolate(frame, [c - 1, c, c + 2], [0, 0.5 * k, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{backgroundColor: '#fff', opacity: bloom, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute',
            top: '-30%',
            left: 0,
            width: width * 0.46,
            height: '160%',
            transform: `translateX(${x.toFixed(1)}px) rotate(-18deg)`,
            background:
              'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.95) 50%,rgba(255,255,255,0) 100%)',
            opacity: beam,
            mixBlendMode: 'screen',
            filter: 'blur(16px)',
          }}
        />
      </AbsoluteFill>
      <Sequence from={c} durationInFrames={10} layout="none">
        <Sfx src={active.sfx ?? 'cut-click.mp3'} volume={active.volume ?? 0.9} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ============ SPLIT SCREEN ("tela dividida") ==================================
// Art on top, the talking head re-drawn underneath, seam at the subject's hairline.
//
// ONE always-mounted layer, NOT a <Sequence> per window. The obvious version wraps
// each window in <Sequence from> + <OffthreadVideo startFrom>, and that samples
// cut.mp4 ONE FRAME BEHIND the base video: on the first frame of the split you
// still see the previous take, so the layout appears to change before the picture
// does. Mounted flat with no startFrom, this layer decodes the same frame the base
// layer does, and the window edges land exactly on the cut.
// The art of one window: a still (slow Ken-Burns) or a clip from ai_video.py. A
// clip needs its own clock — the window's first frame is its frame 0 — hence the
// Sequence; that is fine HERE because nothing in the clip has to line up with a
// cut, unlike cut.mp4. The clip must be at least as long as its window.
const SplitArt: React.FC<{src: string; fit: 'cover' | 'contain'; fromFrame: number; progress: number; gfx?: GfxProps}> = ({
  src,
  fit,
  fromFrame,
  progress,
  gfx,
}) =>
  src.startsWith('gfx:') ? (
    <BandGfx name={src.slice(4)} fromFrame={fromFrame} props={gfx ?? {}} />
  ) : /\.(mp4|mov|webm)$/i.test(src) ? (
    <Sequence from={fromFrame} layout="none">
      <OffthreadVideo src={staticFile(src)} muted style={{width: '100%', height: '100%', objectFit: fit}} />
    </Sequence>
  ) : (
    <Img
      src={staticFile(src)}
      style={{width: '100%', height: '100%', objectFit: fit, scale: String(1 + 0.03 * progress)}}
    />
  );

type ArtLayer = {src: string; fromFrame: number; progress: number; gfx?: GfxProps};

const SplitFrame: React.FC<{
  art: ArtLayer;
  // the image this one is dissolving FROM, and how far in (0–1) — art only
  prev?: ArtLayer;
  fade: number;
  bandH: number;
  fit: 'cover' | 'contain';
  layout: 'top' | 'bottom';
  seam: number;
  zoom?: number;
  focusY?: number;
}> = ({art, prev, fade, bandH, fit, layout, seam, zoom: zoomIn, focusY: focusIn}) => {
  const zoom = zoomIn ?? LAYOUT[layout].zoom;
  const focusY = focusIn ?? LAYOUT[layout].focusY;
  const videoH = 1920 - bandH;
  const top = layout === 'top';
  // `split.seam` — a dissolve `seam` px tall, centred on the seam, instead of a
  // hard line. BOTH layers have to cross it: the art runs half of it past the
  // seam and fades out, and the footage is uncovered half of it the other way,
  // underneath. Fading the art alone leaves the footage's own edge showing
  // through as a line (tried: bright wall against a dark photo, plainly visible).
  // The picture does not move — only more of the source is revealed. 0 = classic.
  const half = seam / 2;
  const videoTop = top ? bandH - half : 0;
  const artTop = top ? 0 : videoH - half;
  const artH = bandH + half;
  const solid = (bandH - half) / artH; // fully opaque up to here
  const mask = seam
    ? top
      ? `linear-gradient(180deg, #000 0, #000 ${solid * 100}%, transparent 100%)`
      : `linear-gradient(0deg, #000 0, #000 ${solid * 100}%, transparent 100%)`
    : undefined;

  return (
    <AbsoluteFill style={{backgroundColor: '#0a0a0c'}}>
      <div style={{position: 'absolute', left: 0, top: videoTop, width: 1080, height: videoH + half, overflow: 'hidden'}}>
        <OffthreadVideo
          src={staticFile('cut.mp4')}
          muted
          style={{
            position: 'absolute',
            width: 1080 * zoom,
            height: 1920 * zoom,
            left: -(1080 * (zoom - 1)) / 2,
            top: -focusY * zoom + (top ? half : 0),
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: artTop,
          width: 1080,
          height: artH,
          overflow: 'hidden',
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {/* `split.crossfade` — consecutive images dissolve into each other. Only
            the ART fades: the footage underneath never does, which is why this is
            safe where a fade on the whole split is not. */}
        {prev && fade < 1 ? (
          <AbsoluteFill>
            <SplitArt src={prev.src} fit={fit} fromFrame={prev.fromFrame} progress={prev.progress} gfx={prev.gfx} />
          </AbsoluteFill>
        ) : null}
        <AbsoluteFill style={{opacity: prev ? fade : 1}}>
          <SplitArt src={art.src} fit={fit} fromFrame={art.fromFrame} progress={art.progress} gfx={art.gfx} />
        </AbsoluteFill>
        {/* Soft falloff into the seam — 'top' ONLY, and only with a hard seam.
            There the caption sits ON the seam over the art and needs the
            darkening to stay legible; with `seam` on, the dissolve already does
            that job. On 'bottom' the caption sits above the seam over the video,
            so the same gradient only smears grey across the top of the photo. */}
        {top && !seam ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              height: 110,
              background: 'linear-gradient(180deg,rgba(10,10,12,0),rgba(10,10,12,0.75))',
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// OffthreadVideo draws the source frame at or before frame/fps; on an exact frame
// boundary that lands one frame LATE, so the decoded picture changes one
// composition frame after the index says it should. Measured, not guessed: with
// the split disabled, the camera zoom (index-driven) steps at frame 350 while the
// take itself changes at 351. Delay the layout by the same frame or the split
// visibly precedes the cut.
export const VIDEO_LAG = 1;

// Optional softening, both off by default (the classic look is a hard edge and a
// hard swap): `split: {seam: 140, crossfade: 12}` in edit-data.json.
type SplitOpts = {seam?: number; crossfade?: number};

export const SplitScreen: React.FC<{items: SplitInsert[]; opts?: SplitOpts}> = ({items, opts}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // frame-indexed, not seconds: the window edges ARE cut frames
  const bounds = (it: SplitInsert) => ({
    a: Math.round(it.start * fps) + VIDEO_LAG,
    b: Math.round(it.end * fps) + VIDEO_LAG,
  });
  const active = items.find((it) => {
    const {a, b} = bounds(it);
    return frame >= a && frame < b;
  });
  if (!active) return null;
  const {a, b} = bounds(active);
  const layer = (it: SplitInsert, at: number): ArtLayer => {
    const r = bounds(it);
    return {src: it.src, gfx: it.gfx, fromFrame: r.a, progress: clamp((at - r.a) / Math.max(1, r.b - r.a), 0, 1)};
  };
  // the image that ended exactly where this one starts — a dissolve needs both
  const xf = Math.max(0, Math.round(opts?.crossfade ?? 0));
  const before = xf && frame - a < xf ? items.find((it) => bounds(it).b === a) : undefined;
  return (
    <SplitFrame
      art={layer(active, frame)}
      prev={before ? layer(before, frame) : undefined}
      fade={before ? clamp((frame - a + 1) / xf, 0, 1) : 1}
      bandH={active.bandH ?? 750}
      fit={active.fit ?? 'cover'}
      layout={active.layout ?? 'top'}
      seam={Math.max(0, opts?.seam ?? 0)}
      zoom={active.zoom}
      focusY={active.focusY}
    />
  );
};

// ============ WORKED EXAMPLE 1: editing timeline being cut + caption tracks =====
// For "os cortes, as legendas e as animações" — a mini editor UI: playhead
// sweeps and splits the video track, caption chips pop in, shapes pop last.
const TL_W = 800;
const TL_H = 378;
const PAD = 46;
const INNER = TL_W - PAD * 2;

const TimelineInner: React.FC<{totalFrames: number}> = ({totalFrames}) => {
  const f = useCurrentFrame();
  const appear = interpolate(f, [0, 9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const exit = interpolate(f, [totalFrames - 7, totalFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rise = interpolate(appear, [0, 1], [26, 0]);

  // playhead sweeps, bar splits into 3
  const gap = interpolate(f, [6, 16], [0, 16], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pieceW = (INNER - gap * 2) / 3;
  const playX = interpolate(f, [0, 16], [0, INNER], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const playOp = interpolate(f, [0, 2, 15, 19], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center'}}>
      <Sfx src="whoosh.mp3" />
      <div style={{width: TL_W, height: TL_H, marginTop: 105, borderRadius: 28, background: '#15171c', border: '1px solid #262a31', boxShadow: '0 18px 50px rgba(0,0,0,0.5)', opacity: appear * exit, scale: String(interpolate(appear, [0, 1], [0.93, 1])), translate: `0px ${rise}px`, padding: PAD, boxSizing: 'border-box', position: 'relative', fontFamily}}>
        {/* window dots */}
        <div style={{display: 'flex', gap: 12}}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (<div key={c} style={{width: 16, height: 16, borderRadius: 999, background: c}} />))}
        </div>

        {/* VIDEO track — being cut */}
        <div style={{position: 'absolute', left: PAD, top: 92, width: INNER, height: 62}}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{position: 'absolute', left: i * (pieceW + gap), width: pieceW, height: 62, borderRadius: 10, background: 'linear-gradient(180deg,#5b8dff,#3f6fe0)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)'}} />
          ))}
          <div style={{position: 'absolute', left: playX, top: -8, width: 3, height: 78, background: 'white', opacity: playOp, boxShadow: '0 0 8px rgba(255,255,255,0.8)'}} />
        </div>

        {/* LEGENDAS track — caption chips appear */}
        <div style={{position: 'absolute', left: PAD, top: 188, width: INNER, height: 46}}>
          {[0, 1, 2, 3].map((k) => {
            const ap = interpolate(f, [16 + k * 5, 24 + k * 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.5))});
            return (
              <div key={k} style={{position: 'absolute', left: k * (INNER / 4), width: INNER / 4 - 14, height: 46, borderRadius: 9, background: '#33e0a3', opacity: Math.min(1, ap), scale: String(Math.max(0.01, ap)), display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '0 12px', boxSizing: 'border-box'}}>
                <div style={{height: 6, width: '80%', borderRadius: 4, background: 'rgba(0,0,0,0.55)'}} />
                <div style={{height: 6, width: '55%', borderRadius: 4, background: 'rgba(0,0,0,0.4)'}} />
              </div>
            );
          })}
        </div>

        {/* ANIMAÇÕES track — shapes pop */}
        <div style={{position: 'absolute', left: PAD, top: 270, width: INNER, height: 60, display: 'flex', gap: 20, alignItems: 'center'}}>
          {[0, 1, 2, 3].map((k) => {
            const ap = interpolate(f, [34 + k * 4, 42 + k * 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.8))});
            const rot = Math.sin((f + k * 7) * 0.2) * 20;
            const colors = ['#ffffff', '#ffd23f', '#ff5f9e', '#5b8dff'];
            const rounds = [999, 12, 6, 999];
            return (<div key={k} style={{width: 52, height: 52, background: colors[k], borderRadius: rounds[k], opacity: Math.min(1, ap), scale: String(Math.max(0.01, ap)), rotate: `${rot}deg`}} />);
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const TimelineGraphic: React.FC<{startSec: number; endSec: number}> = ({startSec, endSec}) => {
  const {fps} = useVideoConfig();
  const from = Math.round(startSec * fps);
  const duration = Math.round((endSec - startSec) * fps);
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <TimelineInner totalFrames={duration} />
    </Sequence>
  );
};

// ============ WORKED EXAMPLE 2: script sheet with typewriter text ===============
// For "ela leu o roteiro" — a tilted paper card, lines typing in with a cursor.
const ScriptInner: React.FC<{totalFrames: number; lines: string[]}> = ({totalFrames, lines}) => {
  const f = useCurrentFrame();
  const appear = interpolate(f, [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const exit = interpolate(f, [totalFrames - 7, totalFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cps = 1.7; // chars per frame

  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center'}}>
      <Sfx src="whoosh.mp3" />
      <div style={{width: 640, height: 420, marginTop: 100, borderRadius: 16, background: '#f4f1e8', boxShadow: '0 22px 55px rgba(0,0,0,0.5)', opacity: appear * exit, scale: String(interpolate(appear, [0, 1], [0.94, 1])), rotate: '-2deg', translate: `0px ${interpolate(appear, [0, 1], [26, 0])}px`, padding: 46, boxSizing: 'border-box', fontFamily}}>
        <div style={{fontWeight: 900, fontSize: 26, letterSpacing: 3, color: '#c2492b'}}>ROTEIRO</div>
        <div style={{height: 4, width: 90, background: '#c2492b', borderRadius: 3, marginTop: 10, marginBottom: 30}} />
        {lines.map((line, i) => {
          const startLocal = 10 + i * 12;
          const shown = clamp(Math.floor((f - startLocal) * cps), 0, line.length);
          const isTyping = shown > 0 && shown < line.length;
          const cursor = isTyping && Math.floor(f / 6) % 2 === 0 ? '|' : '';
          return (
            <div key={i} style={{fontWeight: 400, fontSize: 32, color: '#2b2b2b', lineHeight: 1.5, minHeight: 40}}>
              {line.slice(0, shown)}
              <span style={{color: '#c2492b'}}>{cursor}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const ScriptGraphic: React.FC<{startSec: number; endSec: number; lines: string[]}> = ({startSec, endSec, lines}) => {
  const {fps} = useVideoConfig();
  const from = Math.round(startSec * fps);
  const duration = Math.round((endSec - startSec) * fps);
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <ScriptInner totalFrames={duration} lines={lines} />
    </Sequence>
  );
};

// ============ WORKED EXAMPLE 3: playful shapes pop (for "animações") ============
const Shape: React.FC<{i: number; color: string; round: number}> = ({i, color, round}) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [i * 3, i * 3 + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.6))});
  const pulse = 1 + 0.16 * Math.sin((frame + i * 6) * 0.28);
  const rot = Math.sin((frame + i * 8) * 0.12) * 22;
  return (
    <div
      style={{
        width: 92,
        height: 92,
        background: color,
        borderRadius: round,
        opacity: appear,
        scale: String(appear * pulse),
        rotate: `${rot}deg`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      }}
    />
  );
};

const ShapesInner: React.FC<{totalFrames: number}> = ({totalFrames}) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [totalFrames - 7, totalFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rise = interpolate(frame, [0, 8], [24, 0], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center'}}>
      <Sfx src="pop.mp3" volume={0.12} />
      <div style={{marginTop: 210, display: 'flex', gap: 34, opacity: exit, translate: `0px ${rise}px`}}>
        <Shape i={0} color="white" round={46} />
        <Shape i={1} color="#33e0a3" round={20} />
        <Shape i={2} color="white" round={8} />
      </div>
    </AbsoluteFill>
  );
};

export const ShapesGraphic: React.FC<{startSec: number; endSec: number}> = ({startSec, endSec}) => {
  const {fps} = useVideoConfig();
  const from = Math.round(startSec * fps);
  const duration = Math.round((endSec - startSec) * fps);
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <ShapesInner totalFrames={duration} />
    </Sequence>
  );
};

// ============ BAND GRAPHICS (split art = "gfx:<name>") ==========================
// Bespoke motion graphics drawn INSIDE the split band instead of a still. All the
// content is DATA: splitInserts[] = {"src": "gfx:terminal", "gfx": {...}, ...}.
// Local frame 0 = the window's first frame. The seam dissolve eats the top of
// the band, so content is centred below it. Catalogue (props in each component):
//   gfx:terminal  — an app/terminal window types a command and runs steps
//   gfx:versus    — two cards, A = B (or A vs B), the second one "scanned"
//   gfx:connect   — two nodes linked by a pulsing line, then a badge pops
//   gfx:counter   — a big number rolls up to a value, with a label
//   gfx:bigword   — one or two words slam in, kinetic type on the band
// Motion rules (references/creative-direction.md): land decelerates, leave
// accelerates, nothing grows from zero, never linear, nothing static > 3 frames.
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
const {fontFamily: mono} = loadMono('normal', {weights: ['400', '700']});

type GfxProps = Record<string, unknown>;
const str = (p: GfxProps, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: GfxProps, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : d);
const arr = <T,>(p: GfxProps, k: string): T[] => (Array.isArray(p[k]) ? (p[k] as T[]) : []);

const ACCENT = ((editData as {hook?: {accent?: string}}).hook?.accent) ?? '#ff3b3b';
const BG = '#0b0b0e';
// softLand ≈ power3 out — the default entry; snap for hero/CTA; accel for exits
const softLand = Easing.bezier(0.22, 1, 0.36, 1);
const snap = Easing.bezier(0.12, 0.9, 0.2, 1);
const accel = Easing.bezier(0.55, 0, 0.9, 0.4);
const rise = (f: number, at: number, dur = 10, ease = softLand) =>
  interpolate(f, [at, at + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

const BandBg: React.FC<{children: React.ReactNode; f: number}> = ({children, f}) => (
  <AbsoluteFill style={{background: BG}}>
    <AbsoluteFill
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '54px 54px',
        // slow drift — the band is never a dead frame
        backgroundPosition: `${(f * 0.6).toFixed(1)}px ${(f * 0.3).toFixed(1)}px`,
        maskImage: 'radial-gradient(ellipse at 50% 60%, #000 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 60%, #000 30%, transparent 80%)',
      }}
    />
    <AbsoluteFill style={{paddingTop: 110, paddingBottom: 40, alignItems: 'center', justifyContent: 'center'}}>
      {children}
    </AbsoluteFill>
  </AbsoluteFill>
);

const BandGfx: React.FC<{name: string; fromFrame: number; props: GfxProps}> = ({name, fromFrame, props}) => {
  const f = useCurrentFrame() - fromFrame;
  const G = {terminal: TerminalGfx, versus: VersusGfx, connect: ConnectGfx, counter: CounterGfx, bigword: BigWordGfx}[name];
  return G ? <G f={f} p={props} /> : <BandBg f={f}>{null}</BandBg>;
};

// gfx:terminal — {title, icon, iconColor, command, steps: [{at, text}], done, doneAt}
const TerminalGfx: React.FC<{f: number; p: GfxProps}> = ({f, p}) => {
  const enter = rise(f, 0, 12);
  const cmd = str(p, 'command', 'faça o trabalho');
  const iconColor = str(p, 'iconColor', '#d97757');
  const typed = cmd.slice(0, clamp(Math.floor((f - 14) / 1.4), 0, cmd.length));
  const steps = arr<{at: number; text: string}>(p, 'steps');
  const done = str(p, 'done', '');
  const doneAt = num(p, 'doneAt', 100);
  const caret = Math.floor(f / 8) % 2 === 0 && typed.length < cmd.length;
  return (
    <BandBg f={f}>
      <div
        style={{
          width: 900,
          borderRadius: 30,
          background: '#141418',
          border: '1px solid #2a2a31',
          boxShadow: '0 40px 90px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 60}px) scale(${1.12 - 0.12 * enter})`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '22px 28px', borderBottom: '1px solid #24242a'}}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />
          ))}
          <div style={{marginLeft: 18, fontFamily, fontWeight: 600, fontSize: 30, color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: 12}}>
            <span style={{color: iconColor, fontSize: 38, transform: `rotate(${f * 3}deg)`, display: 'inline-block'}}>{str(p, 'icon', '✻')}</span>
            {str(p, 'title', 'Terminal')}
          </div>
        </div>
        <div style={{padding: '30px 34px 38px', fontFamily: mono, fontSize: 36, lineHeight: 1.55, minHeight: 330}}>
          <div style={{color: '#fafafa'}}>
            <span style={{color: iconColor}}>&gt; </span>
            {typed}
            {caret ? <span style={{background: '#fafafa', marginLeft: 2}}>&nbsp;</span> : null}
          </div>
          {steps.map((s) => {
            const o = rise(f, s.at, 8);
            return (
              <div key={s.text} style={{color: '#a1a1aa', opacity: o, transform: `translateX(${(1 - o) * -24}px)`}}>
                <span style={{color: iconColor}}>{str(p, 'icon', '✻')} </span>
                {s.text}
              </div>
            );
          })}
          {done ? (
            <div style={{color: ACCENT, fontWeight: 700, opacity: rise(f, doneAt, 8, snap), transform: `scale(${1.25 - 0.25 * rise(f, doneAt, 8, snap)})`, transformOrigin: 'left center'}}>
              ✓ {done}
            </div>
          ) : null}
        </div>
      </div>
    </BandBg>
  );
};

// gfx:versus — {left, right, sign ("=" | "vs"), scan (bool), percentTo, percentFrames}
const Silhouette: React.FC<{color: string; glow?: boolean}> = ({color, glow}) => (
  <svg width="210" height="250" viewBox="0 0 210 250" style={{filter: glow ? `drop-shadow(0 0 22px ${ACCENT})` : undefined}}>
    <circle cx="105" cy="82" r="56" fill={color} />
    <path d="M10 250 C 14 172 58 146 105 146 C 152 146 196 172 200 250 Z" fill={color} />
  </svg>
);
const VersusGfx: React.FC<{f: number; p: GfxProps}> = ({f, p}) => {
  const a = rise(f, 0, 10);
  const b = rise(f, 8, 12);
  const scan = interpolate(f % 36, [0, 35], [0, 250]);
  const pTo = num(p, 'percentTo', 0);
  const pct = Math.round(clamp(interpolate(f, [10, 10 + num(p, 'percentFrames', 36)], [0, pTo]), 0, pTo));
  const card = (o: number, label: string, child: React.ReactNode, hot?: boolean, side = 1) => (
    <div
      style={{
        width: 330,
        height: 400,
        borderRadius: 32,
        background: hot ? 'linear-gradient(180deg,#1b1012,#121216)' : '#141418',
        border: `2px solid ${hot ? ACCENT : '#2a2a31'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        position: 'relative',
        opacity: o,
        transform: `translate(${(1 - o) * 90 * side}px, ${(1 - o) * 40}px) rotate(${(1 - o) * 8 * side}deg)`,
      }}
    >
      {child}
      <div style={{position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center', fontFamily, fontWeight: 900, fontSize: 30, letterSpacing: 2, color: hot ? ACCENT : '#a1a1aa'}}>
        {label}
      </div>
    </div>
  );
  const right = str(p, 'right', 'CLONE');
  return (
    <BandBg f={f}>
      <div style={{display: 'flex', alignItems: 'center', gap: 44}}>
        {card(a, str(p, 'left', 'ORIGINAL'), <Silhouette color="#3f3f46" />, false, -1)}
        <div style={{fontFamily, fontWeight: 900, fontSize: 64, color: '#fafafa', opacity: b, transform: `scale(${1.6 - 0.6 * b})`}}>{str(p, 'sign', '=')}</div>
        {card(
          b,
          pTo ? `${right} ${pct}%` : right,
          <>
            <Silhouette color="#52525b" glow />
            {p.scan !== false ? (
              <div style={{position: 'absolute', left: 0, right: 0, top: 80 + scan, height: 4, background: ACCENT, boxShadow: `0 0 24px ${ACCENT}`}} />
            ) : null}
          </>,
          true,
          1,
        )}
      </div>
    </BandBg>
  );
};

// gfx:connect — {left, leftColor, right, rightColor, badge, badgeAt}
const ConnectGfx: React.FC<{f: number; p: GfxProps}> = ({f, p}) => {
  const l = rise(f, 0, 10);
  const r = rise(f, 6, 10);
  const line = rise(f, 14, 22, Easing.inOut(Easing.cubic));
  const badgeAt = num(p, 'badgeAt', 66);
  const badge = rise(f, badgeAt, 10, snap);
  const lc = str(p, 'leftColor', '#d97757');
  const rc = str(p, 'rightColor', ACCENT);
  const node = (o: number, label: string, dot: string, side: 1 | -1) => (
    <div
      style={{
        padding: '26px 34px',
        borderRadius: 999,
        background: '#141418',
        border: '2px solid #2f2f37',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontFamily,
        fontWeight: 900,
        fontSize: 40,
        color: '#fafafa',
        opacity: o,
        transform: `translateX(${(1 - o) * 80 * side}px)`,
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{width: 22, height: 22, borderRadius: 11, background: dot, boxShadow: `0 0 18px ${dot}`}} />
      {label}
    </div>
  );
  const pulses = [0, 1, 2].map((k) => ((f - 30 + k * 10) % 30) / 30);
  const badgeText = str(p, 'badge', '');
  return (
    <BandBg f={f}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46}}>
        <div style={{display: 'flex', alignItems: 'center', width: 980, justifyContent: 'space-between', position: 'relative'}}>
          {node(l, str(p, 'left', 'A'), lc, -1)}
          <div style={{position: 'absolute', left: 360, right: 290, top: '50%', height: 6, marginTop: -3, background: '#26262c', borderRadius: 3, overflow: 'hidden'}}>
            <div style={{width: `${line * 100}%`, height: '100%', background: `linear-gradient(90deg, ${lc}, ${rc})`}} />
            {f > 36
              ? pulses.map((q, k) => (
                  <div key={k} style={{position: 'absolute', top: -5, left: `${q * 100}%`, width: 16, height: 16, borderRadius: 8, background: '#fff', boxShadow: '0 0 16px #fff'}} />
                ))
              : null}
          </div>
          {node(r, str(p, 'right', 'B'), rc, 1)}
        </div>
        {badgeText ? (
          <div
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 50,
              color: '#0b0b0e',
              background: '#fafafa',
              padding: '18px 40px',
              borderRadius: 20,
              opacity: badge,
              transform: `scale(${1.5 - 0.5 * badge}) rotate(${(1 - badge) * -6}deg)`,
            }}
          >
            {badgeText}
          </div>
        ) : null}
      </div>
    </BandBg>
  );
};

// gfx:counter — {value, prefix, suffix, label, frames, decimals}
const CounterGfx: React.FC<{f: number; p: GfxProps}> = ({f, p}) => {
  const frames = num(p, 'frames', 30);
  const v = num(p, 'value', 100) * Easing.out(Easing.cubic)(clamp(f / frames, 0, 1));
  const dec = num(p, 'decimals', 0);
  const landed = f >= frames;
  const pop = landed ? interpolate(f, [frames, frames + 6], [1.08, 1], {extrapolateRight: 'clamp', easing: softLand}) : 1;
  const e = rise(f, 0, 10);
  return (
    <BandBg f={f}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: e, transform: `translateY(${(1 - e) * 50}px)`}}>
        <div style={{fontFamily, fontWeight: 900, fontSize: 210, lineHeight: 1, color: landed ? ACCENT : '#fafafa', transform: `scale(${pop})`, fontVariantNumeric: 'tabular-nums'}}>
          {str(p, 'prefix', '')}
          {v.toLocaleString('pt-BR', {minimumFractionDigits: dec, maximumFractionDigits: dec})}
          {str(p, 'suffix', '')}
        </div>
        <div style={{fontFamily, fontWeight: 600, fontSize: 40, color: '#a1a1aa', letterSpacing: 1}}>{str(p, 'label', '')}</div>
      </div>
    </BandBg>
  );
};

// gfx:bigword — {words: [{t, at, accent}]} each word slams in at its local frame
const BigWordGfx: React.FC<{f: number; p: GfxProps}> = ({f, p}) => {
  const words = arr<{t: string; at: number; accent?: boolean}>(p, 'words');
  return (
    <BandBg f={f}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0}}>
        {words.map((w) => {
          const k = rise(f, w.at, 7, snap);
          return (
            <div
              key={w.t + w.at}
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 150,
                lineHeight: 1.0,
                letterSpacing: -4,
                textTransform: 'uppercase',
                color: w.accent ? ACCENT : '#fafafa',
                opacity: k,
                transform: `scale(${2.2 - 1.2 * k})`,
                filter: `blur(${((1 - k) * 14).toFixed(1)}px)`,
              }}
            >
              {w.t}
            </div>
          );
        })}
      </div>
    </BandBg>
  );
};

// ============ NAME TAG (data: nameTags[]) ====================================
type NameTagItem = {start: number; end: number; kicker: string; name: string; top?: number};
const NameTag: React.FC<{item: NameTagItem}> = ({item}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = Math.round(item.start * fps) + VIDEO_LAG;
  const b = Math.round(item.end * fps) + VIDEO_LAG;
  if (frame < a || frame >= b) return null;
  const i = rise(frame, a, 12);
  const n = rise(frame, a + 5, 12);
  const out = interpolate(frame, [b - 8, b], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: accel});
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: out}}>
      <div style={{position: 'absolute', top: item.top ?? 250, left: 70, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14}}>
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 3,
            color: '#fff',
            background: ACCENT,
            padding: '10px 20px',
            borderRadius: 10,
            opacity: i,
            transform: `translateX(${(1 - i) * -60}px)`,
          }}
        >
          {item.kicker}
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 76,
            lineHeight: 1,
            color: '#fff',
            WebkitTextStroke: '10px rgba(0,0,0,0.85)',
            paintOrder: 'stroke fill',
            opacity: n,
            transform: `translateX(${(1 - n) * -80}px)`,
          }}
        >
          {item.name}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============ CAMERA ACCENTS: punches[] and whips[] ==========================
// Both RE-DRAW cut.mp4 full-frame, flat-mounted (no <Sequence>/startFrom — same
// reason as the split: the layer must decode the SAME frame as the base). They
// sit under the captions (Main mounts captions after CustomGraphics) and over
// the hook — keep them out of the hook window.
//
// punches[] — {at, hold (s, default 0.8), zoom (1.3), shake (14 px), rgb (bool)}
//   Crash zoom on a payoff word: tiny 4-frame pull-back, 6-frame ease-IN push to
//   `zoom`, impact shake 14px·e^(−t/1.8) for ~6 frames, hold, then a 6-frame
//   ease-out release back to the base framing. Max ~1 per 5 s — it is an accent.
// whips[] — {at, dir ("up"|"left"), dist (px, 220)}
//   Whip cut: the last 4 frames of A accelerate out with motion blur, the first
//   6 frames of B land already moving and decelerate in. Put `at` ON a real cut
//   from segments.json. Pair with a soft whoosh starting ~15 ms before `at`.
type Punch = {at: number; hold?: number; zoom?: number; shake?: number; rgb?: boolean; focusX?: number; focusY?: number};
type Whip = {at: number; dir?: 'up' | 'left'; dist?: number};

// RGB split = an SVG filter that offsets the red and blue channels in opposite
// directions and screens them back over green. (Tinted copies blended with
// "screen" wash the whole frame pink — tried, rejected.)
const Redraw: React.FC<{transform: string; filter?: string; origin?: string; rgb?: number}> = ({transform, filter, origin, rgb}) => {
  const id = 'rgbsplit';
  const f = [rgb ? `url(#${id})` : '', filter ?? ''].join(' ').trim() || undefined;
  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      {rgb ? (
        <svg width="0" height="0" style={{position: 'absolute'}}>
          <filter id={id} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={rgb} result="r2" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feOffset in="b" dx={-rgb} result="b2" />
            <feBlend in="r2" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b2" mode="screen" />
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill style={{transform, transformOrigin: origin ?? '50% 40%', filter: f}}>
        <OffthreadVideo src={staticFile('cut.mp4')} muted style={{width: '100%', height: '100%'}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Punches: React.FC<{items: Punch[]}> = ({items}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const PULL = 4, PUSH = 6, REL = 6;
  const hit = items.find((it) => {
    const c = Math.round(it.at * fps) + VIDEO_LAG;
    const end = c + Math.round((it.hold ?? 0.8) * fps) + REL;
    return frame >= c - PULL - PUSH && frame < end;
  });
  if (!hit) return null;
  const c = Math.round(hit.at * fps) + VIDEO_LAG; // the push LANDS on the word
  const holdEnd = c + Math.round((hit.hold ?? 0.8) * fps);
  const Z = hit.zoom ?? 1.3;
  let z: number;
  if (frame < c - PUSH) z = interpolate(frame, [c - PUSH - PULL, c - PUSH], [1, 0.97], {easing: softLand});
  else if (frame < c) z = interpolate(frame, [c - PUSH, c], [0.97, Z], {easing: Easing.in(Easing.cubic)});
  else if (frame < holdEnd) z = Z + 0.02 * ((frame - c) / Math.max(1, holdEnd - c)); // creep, never frozen
  else z = interpolate(frame, [holdEnd, holdEnd + REL], [Z + 0.02, 1], {extrapolateRight: 'clamp', easing: softLand});
  const t = frame - c;
  const amp = t >= 0 && t < 7 ? (hit.shake ?? 14) * Math.exp(-t / 1.8) : 0;
  const sx = amp * Math.sin(t * 2.7), sy = amp * Math.cos(t * 3.3);
  const blur = frame >= c - 3 && frame < c ? 3 : 0;
  const rgb = hit.rgb && t >= 0 && t < 5 ? 10 * (1 - t / 5) : 0;
  const origin = `${(hit.focusX ?? 0.5) * 100}% ${(hit.focusY ?? 0.4) * 100}%`;
  return <Redraw transform={`translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${z.toFixed(4)})`} filter={blur ? `blur(${blur}px)` : undefined} origin={origin} rgb={rgb} />;
};

const Whips: React.FC<{items: Whip[]}> = ({items}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const OUT = 4, IN = 6;
  const w = items.find((it) => {
    const c = Math.round(it.at * fps) + VIDEO_LAG;
    return frame >= c - OUT && frame < c + IN;
  });
  if (!w) return null;
  const c = Math.round(w.at * fps) + VIDEO_LAG;
  const D = w.dist ?? 220;
  const off =
    frame < c
      ? -D * interpolate(frame, [c - OUT, c], [0, 1], {easing: Easing.in(Easing.quad)})
      : D * (1 - interpolate(frame, [c, c + IN], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}));
  const speed = Math.abs(off) / D; // 0..1 — blur follows velocity
  const t = w.dir === 'left' ? `translateX(${off.toFixed(1)}px) scale(1.08)` : `translateY(${off.toFixed(1)}px) scale(1.08)`;
  return <Redraw transform={t} filter={`blur(${(speed * 18).toFixed(1)}px)`} />;
};

// ============ OFFICIAL EFFECTS ON THE FOOTAGE: fx[] ===========================
// @remotion/effects (WebGL, needs `--gl=angle`) applied to a re-draw of cut.mp4
// through <Video> from @remotion/media. Data:
//   fx[] = {start, end, effects: [{name, params, rampIn, rampOut}]}
// `params` go straight to the effect; `rampIn`/`rampOut` (frames) fade the
// effect's `amount` (when it has one) in and out so it never pops on/off.
import {Video as FxVideo} from '@remotion/media';
import {thermalVision} from '@remotion/effects/thermal-vision';
import {scanlines} from '@remotion/effects/scanlines';
import {pixelate} from '@remotion/effects/pixelate';
import {chromaticAberration} from '@remotion/effects/chromatic-aberration';
import {halftone} from '@remotion/effects/halftone';
import {duotone} from '@remotion/effects/duotone';
import {glow} from '@remotion/effects/glow';
import {tvSignalOff} from '@remotion/effects/tv-signal-off';
import {zoomBlur} from '@remotion/effects/zoom-blur';
import {noiseDisplacement} from '@remotion/effects/noise-displacement';
import {vignette} from '@remotion/effects/vignette';
import {pixelDissolve} from '@remotion/effects/pixel-dissolve';
import {wave} from '@remotion/effects/wave';
import {grayscale} from '@remotion/effects/grayscale';
import {tint} from '@remotion/effects/tint';
import {contrast} from '@remotion/effects/contrast';
import {whiteNoise} from '@remotion/effects/white-noise';
import {zigzag} from '@remotion/effects/zigzag';
import {dotGrid} from '@remotion/effects/dot-grid';
import {lightTrail} from '@remotion/effects/light-trail';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FX: Record<string, (p?: any) => any> = {
  thermalVision, scanlines, pixelate, chromaticAberration, halftone, duotone, glow, tvSignalOff, zoomBlur,
  noiseDisplacement, vignette, pixelDissolve, wave, grayscale, tint, contrast, whiteNoise, zigzag, dotGrid, lightTrail,
};
type FxSpec = {name: string; params?: Record<string, unknown>; rampIn?: number; rampOut?: number};
type FxWindow = {start: number; end: number; effects: FxSpec[]};

const FxLayer: React.FC<{items: FxWindow[]}> = ({items}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const w = items.find((it) => {
    const a = Math.round(it.start * fps) + VIDEO_LAG;
    const b = Math.round(it.end * fps) + VIDEO_LAG;
    return frame >= a && frame < b;
  });
  if (!w) return null;
  const a = Math.round(w.start * fps) + VIDEO_LAG;
  const b = Math.round(w.end * fps) + VIDEO_LAG;
  const effects = w.effects
    .filter((e) => FX[e.name])
    .map((e) => {
      const k = Math.min(
        e.rampIn ? clamp((frame - a + 1) / e.rampIn, 0, 1) : 1,
        e.rampOut ? clamp((b - frame) / e.rampOut, 0, 1) : 1,
      );
      const params = {...(e.params ?? {})} as Record<string, unknown>;
      if (k < 1) params.amount = (typeof params.amount === 'number' ? (params.amount as number) : 1) * k;
      return FX[e.name](params);
    });
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <FxVideo src={staticFile('cut.mp4')} muted effects={effects} style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
};

// =============================================================================
// MIRROR FAMILY — built for a challenge reel ("O Espelho"), kept data-driven so a
// future video can reuse a piece when ITS concept calls for it (check the
// creative ledger first). All keys optional; absent = renders nothing.
//   mirrorTurn {at, frames}            the whole frame turns 180° like a hand mirror
//                                      and stays un-mirrored to the end
//   mirrorFold {seamAt, sweepStart, sweepEnd, releaseAt, releaseFrames, axis[[t,x]]}
//                                      left half of the face reflected over the nose axis
//   syncDrift[] {start, end, lags[], opacity[], registered}
//                                      delayed blue copies of the face (mouth lags / trail)
//   prizeBadge {enterAt, anchor{x,y}, w, h, faces[], flipAt[], dropAt}
//                                      virtual lanyard card with spring physics
//   mirrorTunnel {start, end, box{x,y,w,h}, levels, lagPerLevel, label}
//                                      recursive pocket mirror, each level later
//   endFreeze {at, until}              picture freezes while the voice goes on
//   clueTags[] {n, text, start, end, side, y, bracket?}
//   mirrorType[] {start, end, y, size, faces[{lines[], flipAt}], exit?, foot?}
// =============================================================================
import {Freeze, spring} from 'remotion';
import {DynamicVideo} from './Main';
import segData from '../public/segments.json';
import trackData from '../public/track.json';
import {loadFont as loadTight} from '@remotion/google-fonts/InterTight';
const {fontFamily: tight} = loadTight('normal', {weights: ['700', '800']});

const INK = '#0B0B0F';
const PAPER = '#F4F2EE';
const CLONE = '#7C8CFF';
const HUMAN = '#E3263E';
const flipEase = Easing.bezier(0.65, 0, 0.35, 1);
const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

type MTurn = {at: number; frames?: number};
type MFold = {seamAt: number; sweepStart: number; sweepEnd: number; releaseAt: number; releaseFrames?: number; axis: [number, number][]};
type MDrift = {start: number; end: number; lags: number[]; opacity: number[]; registered?: boolean};
type BadgeFace = {kicker: string; title: string; sub?: string; toggle?: {onAt: number; pulseAt?: number}; glyph?: {char: string; at: number}};
type MBadge = {enterAt: number; anchor: {x: number; y: number}; w: number; h: number; faces: BadgeFace[]; flipAt?: number[]; dropAt: number};
type MTunnel = {start: number; end: number; box: {x: number; y: number; w: number; h: number}; levels: number; lagPerLevel: number; label?: string};
type MFreeze = {at: number; until: number};
type Clue = {n: number; text: string; start: number; end: number; side?: 'left' | 'right'; y?: number; bracket?: {x: number; y: number; w: number; h: number}};
type MType = {start: number; end: number; y?: number; size?: number; faces: {lines: string[]; flipAt: number}[]; exit?: {at: number}; foot?: string};
type MirrorData = {
  mirrorTurn?: MTurn;
  mirrorFold?: MFold;
  syncDrift?: MDrift[];
  prizeBadge?: MBadge;
  mirrorTunnel?: MTunnel;
  endFreeze?: MFreeze;
  clueTags?: Clue[];
  mirrorType?: MType[];
};

const F = (sec: number, fps: number) => Math.round(sec * fps) + VIDEO_LAG;

// Same math as DynamicVideo in Main.tsx — where the face sits ON SCREEN.
const camAt = (frame: number, fps: number, W: number, H: number) => {
  const cam = (editData as unknown as {camera: {enabled: boolean; zooms: number[]; pushIn: number; targetX: number; targetY: number}}).camera;
  const segs = (segData as {segments: {start: number; dur: number}[]}).segments;
  let idx = 0;
  for (let i = 0; i < segs.length; i++) if (frame - 1 >= Math.round(segs[i].start * fps)) idx = i;
  const segFrom = Math.round(segs[idx].start * fps) + 1;
  const segLen = Math.max(1, Math.round(segs[idx].dur * fps));
  const S = (cam.zooms[idx % cam.zooms.length] ?? 1.14) + cam.pushIn * clamp((frame - segFrom) / segLen, 0, 1);
  const pts = (trackData as unknown as {points: [number, number][]}).points;
  const [cx, cy] = pts[Math.min(frame, pts.length - 1)] ?? [0.5, 0.4];
  const tx = clamp(cam.targetX * W - cx * W * S, W - W * S, 0);
  const ty = clamp(cam.targetY * H - cy * H * S, H - H * S, 0);
  return {S, x: tx + cx * W * S, y: ty + cy * H * S, seg: idx};
};
const segOf = (frame: number, fps: number) => camAt(frame, fps, 1080, 1920).seg;

const turnState = (d: MirrorData, frame: number, fps: number): {on: boolean; theta: number; done: boolean; t: number} => {
  if (!d.mirrorTurn) return {on: false, theta: 0, done: false, t: 0};
  const a = F(d.mirrorTurn.at, fps);
  const n = d.mirrorTurn.frames ?? 10;
  if (frame < a) return {on: false, theta: 0, done: false, t: 0};
  const t = clamp((frame - a) / n, 0, 1);
  return {on: true, theta: 180 * flipEase(t), done: t >= 1, t};
};
const faceScreen = (d: MirrorData, frame: number, fps: number) => {
  const c = camAt(frame, fps, 1080, 1920);
  return turnState(d, frame, fps).done ? {...c, x: 1080 - c.x} : c;
};

// ---- STAGE: the turned/un-mirrored frame (+ badge after the turn, + freeze) ----
const MirrorStage: React.FC<{d: MirrorData}> = ({d}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ts = turnState(d, frame, fps);
  if (!ts.on) return null;
  const fz = d.endFreeze && frame >= F(d.endFreeze.at, fps) ? F(d.endFreeze.at, fps) : null;
  const t = ts.t;
  const s = 1 - 0.08 * Math.sin(Math.PI * t);
  const blur = ts.done ? 0 : 2 * Math.sin(Math.PI * t);
  const glint = !ts.done && Math.abs(Math.cos((ts.theta * Math.PI) / 180)) < 0.15;
  const inner = (
    <AbsoluteFill style={{perspective: 2400}}>
      <AbsoluteFill style={{transform: `rotateY(${ts.theta.toFixed(2)}deg) scale(${s.toFixed(4)})`, transformStyle: 'preserve-3d', filter: blur ? `blur(${blur.toFixed(2)}px)` : undefined}}>
        <AbsoluteFill style={{backfaceVisibility: 'visible'}}>
          <DynamicVideo />
        </AbsoluteFill>
        {d.prizeBadge ? <PrizeBadge b={d.prizeBadge} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
  let freezeFx: React.ReactNode = null;
  let content = inner;
  if (fz !== null) {
    const k = interpolate(frame, [fz, fz + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: softLand});
    const creep = interpolate(frame, [fz, fz + 39], [1, 1.03], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: softLand});
    content = (
      <AbsoluteFill style={{transform: `scale(${creep.toFixed(4)})`, filter: `saturate(${(1 - 0.3 * k).toFixed(3)})`}}>
        <Freeze frame={fz}>{inner}</Freeze>
      </AbsoluteFill>
    );
    freezeFx = (
      <>
        <AbsoluteFill style={{background: CLONE, mixBlendMode: 'color', opacity: 0.12 * k}} />
        <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(0,0,0,0.55) 100%)', opacity: k}} />
      </>
    );
  }
  return (
    <AbsoluteFill style={{backgroundColor: INK}}>
      {content}
      {freezeFx}
      {glint ? <div style={{position: 'absolute', left: 537, top: 0, width: 6, height: 1920, background: '#dfe3ff', opacity: 0.9, boxShadow: `0 0 30px ${CLONE}`}} /> : null}
    </AbsoluteFill>
  );
};

// ---- OVERLAYS above the stage: fold, drift, pre-turn badge, tunnel, clues, type ----
const MirrorOverlays: React.FC<{d: MirrorData}> = ({d}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ts = turnState(d, frame, fps);
  return (
    <>
      {d.mirrorFold ? <MirrorFold m={d.mirrorFold} /> : null}
      {(d.syncDrift ?? []).map((m, i) => (
        <SyncDrift key={i} m={m} d={d} />
      ))}
      {d.prizeBadge && !ts.on ? <PrizeBadge b={d.prizeBadge} /> : null}
      {d.mirrorTunnel ? <MirrorTunnel m={d.mirrorTunnel} d={d} /> : null}
      {(d.clueTags ?? []).map((c) => (
        <ClueTag key={c.n} c={c} />
      ))}
      {(d.mirrorType ?? []).map((m, i) => (
        <MirrorType key={i} m={m} d={d} />
      ))}
    </>
  );
};

// ---- MirrorFold (signature) ----
const MirrorFold: React.FC<{m: MFold}> = ({m}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seamA = F(m.seamAt, fps);
  const relA = F(m.releaseAt, fps);
  const relN = m.releaseFrames ?? 8;
  if (frame < seamA || frame >= relA + relN) return null;
  const t = frame / fps;
  const ks = m.axis;
  const axis = interpolate(t, ks.map((k) => k[0]), ks.map((k) => k[1]), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const p =
    frame < relA
      ? interpolate(frame, [F(m.sweepStart, fps), F(m.sweepEnd, fps)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: snap})
      : 1 - interpolate(frame, [relA, relA + relN], [0, 1], {extrapolateRight: 'clamp', easing: easeIn});
  const X = 1080 + (axis - 1080) * p; // clip edge: from the right border to the axis
  const draw = interpolate(frame, [seamA, seamA + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: snap});
  const pulse = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin((frame / 15) * Math.PI * 2));
  const seamX = p > 0.001 ? X : axis;
  const tear = frame === relA;
  const fadeOut = frame >= relA ? 1 - (frame - relA) / relN : 1;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {p > 0.001 ? (
        <AbsoluteFill style={{clipPath: `inset(0 0 0 ${X.toFixed(1)}px)`}}>
          <AbsoluteFill style={{transformOrigin: '0 0', transform: `translateX(${(2 * axis).toFixed(1)}px) scaleX(-1)`}}>
            <DynamicVideo />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}
      {tear ? (
        <AbsoluteFill style={{clipPath: 'inset(780px 0 1100px 0)', transform: 'translateX(24px)'}}>
          <DynamicVideo />
        </AbsoluteFill>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: seamX - 1.5,
          top: 220,
          width: 3,
          height: 1280 * draw,
          background: CLONE,
          boxShadow: `0 0 18px ${CLONE}, 0 0 4px #fff`,
          opacity: (p > 0.001 ? pulse : 1) * fadeOut,
        }}
      />
    </AbsoluteFill>
  );
};

// ---- SyncDrift ----
const BLUE_MATRIX = (() => {
  const c3 = [0x7c / 255, 0x8c / 255, 0xff / 255];
  const L = [0.2126, 0.7152, 0.0722];
  return c3.map((c) => `${(L[0] * c).toFixed(3)} ${(L[1] * c).toFixed(3)} ${(L[2] * c).toFixed(3)} 0 0`).join(' ') + ' 0 0 0 1 0';
})();
const SyncDrift: React.FC<{m: MDrift; d: MirrorData}> = ({m, d}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = F(m.start, fps);
  const b = F(m.end, fps);
  if (frame < a || frame >= b + 6) return null;
  const env = frame < a + 4 ? (frame - a + 1) / 4 : frame >= b ? 1 - (frame - b) / 6 : 1;
  const fc = faceScreen(d, frame, fps);
  const mirrored = turnState(d, frame, fps).done;
  const rx = 270 * fc.S;
  const ry = 360 * fc.S;
  const mask = `radial-gradient(ellipse ${rx.toFixed(0)}px ${ry.toFixed(0)}px at ${fc.x.toFixed(0)}px ${fc.y.toFixed(0)}px, #000 55%, transparent 100%)`;
  const id = `drift${Math.round(m.start * 100)}`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={BLUE_MATRIX} />
        </filter>
      </svg>
      {m.lags.map((L, i) => {
        if (segOf(frame - L, fps) !== segOf(frame, fps)) return null; // never a ghost from another shot
        return (
          <AbsoluteFill key={L} style={{mixBlendMode: 'screen', opacity: (m.opacity[i] ?? 0.4) * env, maskImage: mask, WebkitMaskImage: mask}}>
            <AbsoluteFill style={{filter: `url(#${id})`, transform: mirrored ? 'scaleX(-1)' : undefined}}>
              <Sequence from={L} layout="none">
                <DynamicVideo frameOffset={m.registered ? L : 0} />
              </Sequence>
            </AbsoluteFill>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ---- PrizeBadge (inside the stage after the turn, so it turns with the frame) ----
const BadgeFaceView: React.FC<{f: BadgeFace; frame: number; fps: number}> = ({f, frame, fps}) => {
  const tog = f.toggle ? rise(frame, F(f.toggle.onAt, fps), 8) : 0;
  const pA = f.toggle?.pulseAt !== undefined ? F(f.toggle.pulseAt, fps) : -999;
  const pulse = interpolate(frame, [pA, pA + 5, pA + 10], [1, 1.06, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const g = f.glyph ? rise(frame, F(f.glyph.at, fps), 8, snap) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, borderRadius: 18, background: INK, border: '1px solid #FFFFFF2E', boxShadow: '0 18px 40px rgba(0,0,0,.5)', padding: '30px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, backfaceVisibility: 'hidden'}}>
      <div style={{fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 2, color: HUMAN}}>{f.kicker}</div>
      <div style={{fontFamily: tight, fontWeight: 800, fontSize: 60, lineHeight: 1, color: PAPER, display: 'flex', alignItems: 'center', gap: 16}}>
        {f.title}
        {f.glyph ? <span style={{fontSize: 34, opacity: g, transform: `scale(${(1.6 - 0.6 * g).toFixed(3)})`, display: 'inline-block'}}>{f.glyph.char}</span> : null}
      </div>
      {f.sub || f.toggle ? (
        <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: tight, fontWeight: 700, fontSize: 28, color: `${PAPER}B3`}}>
          {f.toggle ? (
            <span style={{width: 64, height: 34, borderRadius: 17, background: tog > 0.5 ? HUMAN : '#FFFFFF26', position: 'relative', display: 'inline-block', transform: `scale(${pulse})`, boxShadow: pulse > 1.01 ? `0 0 18px ${HUMAN}` : undefined}}>
              <span style={{position: 'absolute', top: 4, left: 4 + 30 * tog, width: 26, height: 26, borderRadius: 13, background: '#fff'}} />
            </span>
          ) : null}
          {f.sub}
        </div>
      ) : null}
    </div>
  );
};
const PrizeBadge: React.FC<{b: MBadge}> = ({b}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = F(b.enterAt, fps);
  const drop = F(b.dropAt, fps);
  if (frame < a || frame > drop + 16) return null;
  const sp = spring({frame: frame - a, fps, config: {damping: 11, stiffness: 140, mass: 0.8}});
  const landT = Math.max(0, (frame - a - 8) / fps);
  let rot = frame - a > 8 ? 8 * Math.exp(-landT / 0.6) * Math.cos((2 * Math.PI * landT) / 0.9) : 0;
  let y = b.anchor.y - 520 * (1 - sp) + 3 * Math.sin(frame / 18);
  if (frame >= drop) {
    const tt = (frame - drop) / fps;
    y += 0.5 * 4200 * tt * tt;
    rot += 25 * easeIn(clamp((frame - drop) / 14, 0, 1));
  }
  const flips = (b.flipAt ?? []).map((t) => F(t, fps));
  let extra = 0;
  let swapped = false;
  for (const fA of flips) {
    if (frame >= fA) {
      const u = clamp((frame - fA) / 10, 0, 1);
      extra += 180 * flipEase(u);
      if (u >= 0.5) swapped = true;
    }
  }
  const front = swapped ? b.faces[2] ?? b.faces[0] : b.faces[0];
  const back = b.faces[1] ?? b.faces[0];
  return (
    <div style={{position: 'absolute', left: b.anchor.x - b.w / 2, top: y, width: b.w, height: b.h, transformOrigin: '50% -20px', transform: `rotate(${rot.toFixed(2)}deg)`, transformStyle: 'preserve-3d'}}>
      <div style={{position: 'absolute', left: b.w / 2 - 30, top: -30, width: 60, height: 26, borderRadius: 6, background: HUMAN}}>
        <div style={{position: 'absolute', left: 25, top: 8, width: 10, height: 10, borderRadius: 5, background: INK}} />
      </div>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${extra.toFixed(2)}deg)`}}>
        <BadgeFaceView f={front} frame={frame} fps={fps} />
        <div style={{position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', transformStyle: 'preserve-3d'}}>
          <BadgeFaceView f={back} frame={frame} fps={fps} />
        </div>
      </div>
    </div>
  );
};

// ---- MirrorTunnel ----
const MirrorTunnel: React.FC<{m: MTunnel; d: MirrorData}> = ({m, d}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = F(m.start, fps);
  const b = F(m.end, fps);
  if (frame < a || frame >= b + 8) return null;
  const mirrored = turnState(d, frame, fps).done;
  const out = frame >= b ? easeIn(clamp((frame - b) / 8, 0, 1)) : 0;
  const fc = faceScreen(d, frame, fps);
  const boxes: {x: number; y: number; w: number; h: number}[] = [m.box];
  for (let k = 1; k < m.levels; k++) {
    const p = boxes[k - 1];
    const w = p.w * 0.72;
    const h = p.h * 0.72;
    boxes.push({x: p.x + (p.w - w) / 2, y: p.y + (p.h - h) / 2 - p.h * 0.08, w, h});
  }
  const enter = rise(frame, a, 12);
  const drift = 1 + 0.005 * ((frame - a) / fps);
  const cx = m.box.x + m.box.w / 2;
  const cy = m.box.y + m.box.h / 2;
  const segs = (segData as {segments: {start: number}[]}).segments;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        transformOrigin: `${cx}px ${cy}px`,
        transform: `scale(${((1.6 - 0.6 * enter) * drift * (1 - 0.8 * out)).toFixed(4)})`,
        opacity: 1 - out,
        filter: enter < 1 ? `blur(${((1 - enter) * 10).toFixed(1)}px)` : undefined,
      }}
    >
      {boxes.map((bx, k) => {
        const lvIn = rise(frame, a + 3 * k, 10);
        const lag = (k + 1) * m.lagPerLevel;
        const sameShot = segOf(frame - lag, fps) === segOf(frame, fps);
        const z = (bx.w / 1080) * 1.25; // zoom toward the face
        // face position in UN-mirrored screen space for this level's own frame
        const fx = mirrored ? 1080 - fc.x : fc.x;
        const mir = (mirrored ? 1 : 0) + (k % 2 === 0 ? 1 : 0);
        const shownX = mir % 2 === 1 ? 1080 - fx : fx;
        const ox = bx.w / 2 - shownX * z;
        const oy = bx.h / 2 - fc.y * z;
        const video = (
          <AbsoluteFill style={{transform: mir % 2 === 1 ? 'scaleX(-1)' : undefined}}>
            <DynamicVideo frameOffset={lag} />
          </AbsoluteFill>
        );
        const segStart = Math.round(segs[segOf(frame, fps)].start * fps) + 1;
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: bx.x,
              top: bx.y,
              width: bx.w,
              height: bx.h,
              overflow: 'hidden',
              border: `2px solid ${CLONE}`,
              opacity: lvIn * [1, 0.85, 0.7, 0.55][k % 4],
              background: INK,
              boxShadow: '0 20px 50px rgba(0,0,0,.45)',
            }}
          >
            <div style={{position: 'absolute', left: ox, top: oy, width: 1080, height: 1920, transformOrigin: '0 0', transform: `scale(${z.toFixed(4)})`}}>
              {sameShot ? (
                <Sequence from={lag} layout="none">
                  {video}
                </Sequence>
              ) : (
                <Freeze frame={segStart}>{video}</Freeze>
              )}
            </div>
            {k === 0 && m.label ? (
              <div style={{position: 'absolute', left: 12, top: 10, fontFamily: mono, fontWeight: 700, fontSize: 24, color: PAPER, textShadow: '0 2px 8px #000'}}>{m.label}</div>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---- ClueTag ----
const ClueTag: React.FC<{c: Clue}> = ({c}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = F(c.start, fps) - 2;
  const b = F(c.end, fps);
  if (frame < a || frame >= b + 8) return null;
  const i = rise(frame, a, 10);
  const o = frame >= b ? easeIn(clamp((frame - b) / 8, 0, 1)) : 0;
  const right = c.side === 'right';
  const dx = (1 - i) * (right ? 40 : -40) + 0.6 * (frame - a) * (right ? -1 : 1);
  const dot = interpolate(frame - a, [0, 6, 12], [1, 0.3, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const br = c.bracket;
  const bp = br ? rise(frame, a + 2, 12) : 0;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: c.y ?? 250,
          ...(right ? {right: 64} : {left: 64}),
          padding: '18px 24px',
          borderRadius: 20,
          background: '#0B0B0FB3',
          backdropFilter: 'blur(12px)',
          border: '1px solid #FFFFFF2E',
          opacity: i * (1 - o),
          transform: `translate(${dx.toFixed(1)}px, ${(-20 * o).toFixed(1)}px)`,
          filter: i < 1 ? `blur(${((1 - i) * 8).toFixed(1)}px)` : undefined,
          maxWidth: 760,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10, fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: `${PAPER}CC`}}>
          <span style={{width: 10, height: 10, borderRadius: 5, background: CLONE, opacity: dot, boxShadow: `0 0 10px ${CLONE}`}} />
          PISTA {c.n}
        </div>
        <div style={{fontFamily: tight, fontWeight: 700, fontSize: 46, lineHeight: 1.08, color: PAPER, marginTop: 6}}>{c.text}</div>
      </div>
      {br ? (
        <svg style={{position: 'absolute', left: 0, top: 0}} width={1080} height={1920}>
          {[
            [br.x, br.y + 28, br.x, br.y, br.x + 28, br.y],
            [br.x + br.w - 28, br.y, br.x + br.w, br.y, br.x + br.w, br.y + 28],
            [br.x + br.w, br.y + br.h - 28, br.x + br.w, br.y + br.h, br.x + br.w - 28, br.y + br.h],
            [br.x + 28, br.y + br.h, br.x, br.y + br.h, br.x, br.y + br.h - 28],
          ].map((q, k) => (
            <polyline
              key={k}
              points={`${q[0]},${q[1]} ${q[2]},${q[3]} ${q[4]},${q[5]}`}
              fill="none"
              stroke={CLONE}
              strokeWidth={3}
              strokeDasharray={56}
              strokeDashoffset={56 * (1 - bp)}
              opacity={1 - o}
              style={{filter: `drop-shadow(0 0 6px ${CLONE})`}}
            />
          ))}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ---- MirrorType: headline born mirrored, turns readable ----
const renderLine = (line: string) =>
  line.split(/(\{[^}]+\})/).map((part, i) =>
    part.startsWith('{') ? (
      <span key={i} style={{color: CLONE}}>
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
const MirrorType: React.FC<{m: MType; d: MirrorData}> = ({m, d}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = Math.round(m.start * fps);
  const b = Math.round(m.end * fps);
  if (frame < a || frame >= b) return null;
  const size = m.size ?? 104;
  const y = m.y ?? 250;
  // Face 0 is born turned (180°, read backwards) and turns to 0° at its flipAt.
  // Each later face turns 0 → -180 in 10 frames and is swapped in at edge-on;
  // past 90° the card shows its back, which reads mirrored — so the new face
  // is counter-mirrored to land readable.
  const f0 = F(m.faces[0].flipAt, fps);
  let theta = frame < f0 ? 180 + 20 * (1 - clamp((frame - a) / 4, 0, 1)) : 180 - 180 * flipEase(clamp((frame - f0) / 12, 0, 1));
  let face = 0;
  let counter = false;
  for (let k = 1; k < m.faces.length; k++) {
    const fk = F(m.faces[k].flipAt, fps);
    if (frame >= fk) {
      const u = clamp((frame - fk) / 10, 0, 1);
      theta = -180 * flipEase(u);
      if (u >= 0.5) {
        face = k;
        counter = true;
      }
    }
  }
  const showFace = m.faces[face];
  const blur = 8 * (1 - Math.abs(Math.cos((theta * Math.PI) / 180)));
  const creep = 1 + 0.025 * clamp((frame - a) / Math.max(1, b - a), 0, 1);
  let sx = 1;
  let lineOp = 0;
  let lineY = y + 60;
  let lineX = 540;
  if (m.exit) {
    const e = F(m.exit.at, fps);
    if (frame >= e) {
      const u = clamp((frame - e) / 8, 0, 1);
      sx = 1 - easeIn(u);
      const fc = faceScreen(d, frame, fps);
      lineX = fc.x;
      const v = clamp((frame - e - 8) / 12, 0, 1);
      lineOp = u >= 1 ? 1 - v : 0;
      lineY = y + 60 + (fc.y - y - 60) * v;
    }
  }
  const gradK = clamp((frame - a) / 8, 0, 1) * (sx > 0.02 ? 1 : 0);
  const lastFace = m.faces[m.faces.length - 1];
  const footIn = m.foot ? rise(frame, F(lastFace.flipAt, fps) + 6, 10) : 0;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${INK}73 0px, transparent 620px)`, opacity: gradK}} />
      <div style={{position: 'absolute', left: 70, width: 940, top: y, perspective: 1600}}>
        <div
          style={{
            transformOrigin: `${(lineX - 70).toFixed(0)}px 50%`,
            transform: `scaleX(${sx.toFixed(3)}) rotateY(${theta.toFixed(2)}deg) scale(${creep.toFixed(4)})`,
            filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
            textAlign: 'center',
            fontFamily: tight,
            fontWeight: 800,
            fontSize: size,
            letterSpacing: -2,
            lineHeight: 1.02,
            color: PAPER,
            textShadow: '0 6px 24px rgba(0,0,0,.45)',
          }}
        >
          <div style={{transform: counter ? 'scaleX(-1)' : undefined}}>
            {showFace.lines.map((l, i) => (
              <div key={i}>{renderLine(l)}</div>
            ))}
          </div>
        </div>
      </div>
      {m.foot ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: y + 40 + lastFace.lines.length * size * 1.02,
            textAlign: 'center',
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 3,
            color: `${PAPER}B3`,
            opacity: footIn,
            transform: `translateY(${((1 - footIn) * 16).toFixed(1)}px)`,
          }}
        >
          {m.foot}
        </div>
      ) : null}
      {lineOp > 0 ? <div style={{position: 'absolute', left: lineX - 1.5, top: lineY - 60, width: 3, height: 120, background: CLONE, boxShadow: `0 0 18px ${CLONE}`, opacity: lineOp}} /> : null}
    </AbsoluteFill>
  );
};
