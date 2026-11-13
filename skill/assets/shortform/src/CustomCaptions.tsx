/**
 * CustomCaptions — the "custom" caption style ("Personalizada" on the Estilo tab).
 *
 * The other six styles ARE their tuning; this one is the opposite: every visual
 * decision is data, set by the user on the Estilo tab with the result showing
 * live over their own footage. It reads `captions.custom` in edit-data.json:
 *
 *   font       one of FONTS below            size       px at 1080 wide
 *   posY       line centre, 0–1 of height    maxWords   words per line
 *   color      text                          active     the word being spoken
 *   stroke     outline colour                strokeW    outline px (0 = none)
 *   box        background box on/off         boxColor / boxOpacity
 *   upper      uppercase                     pop        punch on the active word
 *   shadow     drop shadow
 *
 * The preview's app.js mirrors this file (CUSTOM_FONTS, CUSTOM_DEFAULT and
 * buildCustomRenderer) — same grouping, same geometry scaled from 1080. Change
 * one, change both: a live preview that lies about the render is worse than none.
 *
 * Data: public/captions.json (word level) — no extra generation step.
 */
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadLato} from '@remotion/google-fonts/Lato';
import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadOswald} from '@remotion/google-fonts/Oswald';
import {loadFont as loadBaskerville} from '@remotion/google-fonts/LibreBaskerville';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import captions from '../public/captions.json';
import editData from '../public/edit-data.json';

type Word = {text: string; startMs: number; endMs: number};
type Config = {
  font: string;
  size: number;
  posY: number;
  maxWords: number;
  color: string;
  active: string;
  stroke: string;
  strokeW: number;
  box: boolean;
  boxColor: string;
  boxOpacity: number;
  upper: boolean;
  pop: boolean;
  shadow: boolean;
};

const DEFAULTS: Config = {
  font: 'poppins',
  size: 76,
  posY: 0.74,
  maxWords: 3,
  color: '#ffffff',
  active: '#ffdd00',
  stroke: '#000000',
  strokeW: 8,
  box: false,
  boxColor: '#000000',
  boxOpacity: 0.6,
  upper: false,
  pop: true,
  shadow: true,
};

const SUBSETS: {subsets: ('latin' | 'latin-ext')[]} = {subsets: ['latin', 'latin-ext']};
// Only the picked face is requested — a load() per entry, never nine at once.
const FONTS: Record<string, {weight: number; load: () => string}> = {
  poppins: {weight: 900, load: () => loadPoppins('normal', {weights: ['900'], ...SUBSETS}).fontFamily},
  montserrat: {weight: 900, load: () => loadMontserrat('normal', {weights: ['900'], ...SUBSETS}).fontFamily},
  inter: {weight: 800, load: () => loadInter('normal', {weights: ['800'], ...SUBSETS}).fontFamily},
  lato: {weight: 900, load: () => loadLato('normal', {weights: ['900'], ...SUBSETS}).fontFamily},
  bebas: {weight: 400, load: () => loadBebas('normal', {weights: ['400'], ...SUBSETS}).fontFamily},
  anton: {weight: 400, load: () => loadAnton('normal', {weights: ['400'], ...SUBSETS}).fontFamily},
  oswald: {weight: 700, load: () => loadOswald('normal', {weights: ['700'], ...SUBSETS}).fontFamily},
  baskerville: {weight: 700, load: () => loadBaskerville('normal', {weights: ['700'], ...SUBSETS}).fontFamily},
  playfair: {weight: 900, load: () => loadPlayfair('normal', {weights: ['900'], ...SUBSETS}).fontFamily},
};

const CAP = (editData as any).captions ?? {};
const IS_CUSTOM = CAP.style === 'custom';
const C: Config = {...DEFAULTS, ...(CAP.custom ?? {})};
const FONT = FONTS[C.font] ?? FONTS.poppins;
// requested only when this style is the one on screen
const FAMILY = IS_CUSTOM ? FONT.load() : 'sans-serif';

const SAFE_W = 940; // text budget at 1080 wide — clears the platform action rail
const LINGER_MS = 600; // a line outlives its last word by this much, then clears
const POP_FRAMES = 6;
const POP_GAIN = 0.14;

const clean = (t: string) => t.replace(/[.,!?…]+$/, '');
const isBreak = (t: string) => /[.,!?…]$/.test(t);
const shown = (t: string) => (C.upper ? clean(t).toUpperCase() : clean(t));

// Same rule as the karaoke style: a line ends at maxWords or at punctuation, so
// the text breaks where the speaker breathes.
function buildLines(words: Word[], maxWords: number): Word[][] {
  const lines: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= maxWords || isBreak(w.text)) {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}
const LINES = IS_CUSTOM ? buildLines(captions as Word[], Math.max(1, Math.round(C.maxWords))) : [];

const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const CustomCaptions: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const ms = (frame / fps) * 1000;

  let idx = -1;
  for (let i = 0; i < LINES.length; i++) {
    if (ms >= LINES[i][0].startMs) idx = i;
  }
  if (idx < 0) return null;
  const line = LINES[idx];
  if (ms > line[line.length - 1].endMs + LINGER_MS) return null;

  let activeIdx = 0;
  line.forEach((w, i) => {
    if (ms >= w.startMs) activeIdx = i;
  });

  const k = width / 1080; // every px below is authored at 1080 wide
  const size = C.size * k;
  const tracking = -0.01 * size;
  // A single word wider than the budget cannot wrap — shrink the whole line.
  const widest = Math.max(
    ...line.map(
      (w) =>
        measureText({
          text: shown(w.text),
          fontFamily: FAMILY,
          fontSize: size,
          fontWeight: FONT.weight,
          letterSpacing: `${tracking}px`,
        }).width,
    ),
  );
  const fit = Math.min(1, (SAFE_W * k) / Math.max(1, widest));

  // captions.windows: the split layouts park the caption on the seam for a while
  const win = (CAP.windows || []).find(
    (x: {start: number; end: number}) =>
      frame >= Math.round(x.start * fps) + 1 && frame < Math.round(x.end * fps) + 1,
  );
  const place: React.CSSProperties = win
    ? {bottom: win.paddingBottom}
    : {top: C.posY * height, transform: 'translateY(-50%)'};

  const strokeW = Math.max(0, C.strokeW) * k;

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', ...place}}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            columnGap: '0.24em',
            maxWidth: SAFE_W * k,
            fontFamily: FAMILY,
            fontWeight: FONT.weight,
            fontSize: size,
            letterSpacing: tracking,
            lineHeight: 1.16,
            scale: String(fit),
            padding: C.box ? '0.16em 0.42em' : 0,
            borderRadius: C.box ? '0.22em' : 0,
            background: C.box ? hexToRgba(C.boxColor, C.boxOpacity) : 'transparent',
            filter: C.shadow ? `drop-shadow(0 ${4 * k}px ${14 * k}px rgba(0,0,0,0.55))` : undefined,
          }}
        >
          {line.map((w, i) => {
            const on = i === activeIdx;
            const from = (w.startMs / 1000) * fps;
            const p = interpolate(frame, [from, from + POP_FRAMES], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            const scale = C.pop && on ? 1 + POP_GAIN * (1 - p) : 1;
            const text = shown(w.text);
            return (
              <span
                key={i}
                style={{position: 'relative', display: 'inline-block', whiteSpace: 'pre', scale: String(scale)}}
              >
                {/* The outline is a second copy stroked at 2× behind the fill: a
                    stroke on the fill itself eats half its width INTO the glyph
                    and thins the letters. */}
                {strokeW > 0 ? (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      color: C.stroke,
                      WebkitTextStroke: `${strokeW * 2}px ${C.stroke}`,
                      strokeLinejoin: 'round',
                    }}
                  >
                    {text}
                  </span>
                ) : null}
                <span style={{position: 'relative', color: on ? C.active : C.color}}>{text}</span>
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
