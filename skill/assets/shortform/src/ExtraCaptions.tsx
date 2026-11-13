/**
 * ExtraCaptions — four more caption styles, all word-timed off captions.json.
 *
 *   "minimal"    word by word, heavy white Poppins, no colour, no SFX — each
 *                word fades up as it is spoken and the line holds
 *   "destaque"   UPPERCASE with a black stroke; the word being spoken sits on a
 *                solid accent block
 *   "tarja"      broadcast strip: a whole phrase (two lines) on a dark bar with
 *                an accent edge, the spoken word in the accent
 *   "editorial"  sans line with ONE keyword set in accent serif italic; static,
 *                a cue replaces the previous one
 *
 * Cues are grouped by MEASURED WIDTH capped at maxWords and end on punctuation
 * or a speech gap, the same rule as SimpleCaptions. Unlike those, these four
 * honour `captions.windows` — on a split layout the caption moves to the seam.
 *
 * Mirrored by buildExtraCaptionDemo in the preview's app.js (EXTRA_CAPS there).
 * Change one side, change the other.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import captions from '../public/captions.json';
import editData from '../public/edit-data.json';
import {inkOn} from './HeadlineExtras';

const POPPINS = loadPoppins('normal', {weights: ['600', '800', '900']}).fontFamily;
const PLAYFAIR = loadPlayfair('italic', {weights: ['700']}).fontFamily;
const INTER = loadInter('normal', {weights: ['600']}).fontFamily;

type Word = {text: string; startMs: number; endMs: number};
type Variant = {
  family: string;
  weight: number;
  size: number;
  maxWords: number;
  lines: 1 | 2;
  tracking: number;
  bottom: number;
  maxW: number; // per line
  upper: boolean;
};

type Win = {start: number; end: number; paddingBottom: number};
const C = ((editData as any).captions ?? {}) as {accent?: string; adjust?: {color?: string}; windows?: Win[]};
const ACCENT = C.accent ?? '#ff5200';

export const EXTRA_VARIANTS: Record<string, Variant> = {
  minimal: {family: POPPINS, weight: 800, size: 78, maxWords: 3, lines: 1, tracking: -1, bottom: 430, maxW: 860, upper: false},
  destaque: {family: POPPINS, weight: 900, size: 74, maxWords: 3, lines: 1, tracking: -1, bottom: 430, maxW: 820, upper: true},
  tarja: {family: INTER, weight: 600, size: 52, maxWords: 9, lines: 2, tracking: 0, bottom: 400, maxW: 780, upper: false},
  editorial: {family: POPPINS, weight: 600, size: 70, maxWords: 3, lines: 1, tracking: -1, bottom: 430, maxW: 840, upper: false},
};

const clean = (t: string) => t.replace(/[.,!?…]+$/, '');
const isBreak = (t: string) => /[.,!?…]$/.test(t);
const show = (w: Word, V: Variant) => (V.upper ? clean(w.text).toUpperCase() : clean(w.text));

const widthOf = (words: Word[], V: Variant) =>
  measureText({
    text: words.map((w) => show(w, V)).join(' '),
    fontFamily: V.family,
    fontSize: V.size,
    fontWeight: V.weight,
    letterSpacing: `${V.tracking}px`,
  }).width;

const ORPHAN = /^(o|a|os|as|e|é|de|do|da|em|no|na|um|uma|que|se|ao|à|por|com)$/i;

function buildCues(words: Word[], V: Variant): Word[][] {
  const budget = V.maxW * V.lines;
  const phrase = V.lines === 2;
  const cues: Word[][] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) cues.push(cur);
    cur = [];
  };
  words.forEach((w, i) => {
    const trial = [...cur, w];
    if (cur.length && (trial.length > V.maxWords || widthOf(trial, V) > budget)) {
      // a forced break must not strand a connective at the end of the strip
      // ("…para pagar a" / "…organizar isso e"): it opens the next cue instead
      const carry: Word[] = [];
      while (phrase && cur.length > 2 && ORPHAN.test(clean(cur[cur.length - 1].text))) carry.unshift(cur.pop() as Word);
      flush();
      cur = [...carry, w];
    } else {
      cur = trial;
    }
    const next = words[i + 1];
    const gap = next ? next.startMs - w.endMs : 0;
    // a phrase style always breaks on a full stop or a real pause, and on a
    // comma once the strip already carries a phrase worth of words
    const stop = phrase ? /[.!?…]$/.test(w.text) || (cur.length >= 4 && /,$/.test(w.text)) : isBreak(w.text);
    if (cur.length && (stop || gap > 450)) flush();
  });
  flush();
  return cues;
}


function splitTwo(words: Word[], V: Variant): Word[][] {
  if (V.lines === 1 || words.length < 2 || widthOf(words, V) <= V.maxW) return [words];
  let best = 1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(widthOf(words.slice(0, i), V) - widthOf(words.slice(i), V));
    const score = diff + (ORPHAN.test(clean(words[i - 1].text)) ? 200 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [words.slice(0, best), words.slice(best)];
}

// editorial: the ONE word worth setting apart — the longest content word.
const STOP = /^(para|como|mais|isso|esse|essa|este|esta|pelo|pela|você|voce|seus|suas|está|estão|muito|muita|quando|porque|sobre|entre|também|ainda|então|mesmo|cada|toda|todo|aqui|onde|quem|qual|quais|apenas|sendo|foram|tinha|temos)$/i;
function keyword(words: Word[]): number {
  let best = -1;
  let len = 5;
  words.forEach((w, i) => {
    const t = clean(w.text);
    if (t.length > len && !STOP.test(t)) {
      len = t.length;
      best = i;
    }
  });
  return best;
}

export const ExtraCaptions: React.FC<{variant: string}> = ({variant}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const V = EXTRA_VARIANTS[variant] ?? EXTRA_VARIANTS.minimal;
  const cues = React.useMemo(() => buildCues(captions as Word[], V), [V]);
  const fOf = (ms: number) => Math.round((ms / 1000) * fps);

  let idx = -1;
  for (let i = 0; i < cues.length; i++) {
    if (frame >= fOf(cues[i][0].startMs)) idx = i;
  }
  if (idx < 0) return null;
  const cue = cues[idx];
  const next = cues[idx + 1];
  const end = next ? fOf(next[0].startMs) : Math.min(durationInFrames, fOf(cue[cue.length - 1].endMs) + fps);
  if (frame >= end) return null;

  // the word being spoken: the last one whose start has passed
  let active = 0;
  cue.forEach((w, i) => {
    if (frame >= fOf(w.startMs)) active = i;
  });

  const win = (C.windows || []).find(
    (x) => frame >= Math.round(x.start * fps) + 1 && frame < Math.round(x.end * fps) + 1,
  );
  const fill: React.CSSProperties = {justifyContent: 'flex-end', alignItems: 'center', paddingBottom: win ? win.paddingBottom : V.bottom};
  const base: React.CSSProperties = {
    fontFamily: V.family,
    fontWeight: V.weight,
    fontSize: V.size,
    letterSpacing: V.tracking,
    lineHeight: 1.16,
    whiteSpace: 'nowrap',
    textAlign: 'center',
  };

  if (variant === 'destaque') {
    return (
      <AbsoluteFill style={fill}>
        <div style={{...base, display: 'flex', alignItems: 'center', gap: 16, filter: 'drop-shadow(0 5px 12px rgba(0,0,0,0.5))'}}>
          {cue.map((w, i) =>
            i === active ? (
              <span key={i} style={{background: ACCENT, color: inkOn(ACCENT), borderRadius: 12, padding: '0 16px 2px'}}>{show(w, V)}</span>
            ) : (
              <span key={i} style={{color: '#fff', WebkitTextStroke: '12px #000', paintOrder: 'stroke fill'}}>{show(w, V)}</span>
            ),
          )}
        </div>
      </AbsoluteFill>
    );
  }

  if (variant === 'tarja') {
    const lines = splitTwo(cue, V);
    let n = 0;
    return (
      <AbsoluteFill style={fill}>
        <div style={{...base, lineHeight: 1.3, textAlign: 'left', color: '#fff', background: 'rgba(11,28,51,0.93)', borderLeft: `12px solid ${ACCENT}`, padding: '20px 36px 22px 30px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)'}}>
          {lines.map((ln, li) => (
            <div key={li}>
              {ln.map((w) => {
                const i = n++;
                return (
                  <span key={i} style={{color: i === active ? ACCENT : '#fff'}}>
                    {w.text.trim()}
                    {' '}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  if (variant === 'editorial') {
    const k = keyword(cue);
    return (
      <AbsoluteFill style={fill}>
        <div style={{...base, display: 'flex', alignItems: 'baseline', gap: 18, color: '#fff', textShadow: '0 4px 18px rgba(0,0,0,0.6)'}}>
          {cue.map((w, i) =>
            i === k ? (
              <span key={i} style={{fontFamily: PLAYFAIR, fontStyle: 'italic', fontWeight: 700, fontSize: Math.round(V.size * 1.2), letterSpacing: 0, color: ACCENT}}>{clean(w.text)}</span>
            ) : (
              <span key={i}>{clean(w.text)}</span>
            ),
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // minimal — every word keeps its slot from the start, so the line never
  // re-centres as words arrive; each one just fades up when spoken
  return (
    <AbsoluteFill style={fill}>
      <div style={{...base, display: 'flex', alignItems: 'baseline', gap: 18, color: C.adjust?.color || '#fff', textShadow: '0 4px 18px rgba(0,0,0,0.6)'}}>
        {cue.map((w, i) => {
          const e = interpolate(frame, [fOf(w.startMs), fOf(w.startMs) + 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <span key={i} style={{opacity: e, translate: `0px ${((1 - e) * 12).toFixed(2)}px`}}>{clean(w.text)}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
