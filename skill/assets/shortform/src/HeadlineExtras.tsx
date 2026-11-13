/**
 * HeadlineExtras — four more hook styles, each with its own face.
 *
 *   "manchete"  newspaper strip: red kicker tag + serif headline on paper, the
 *               second line run over with an accent marker
 *   "pergunta"  comment bubble: a small label + the question in a white balloon
 *   "etiqueta"  accent pill naming the subject + a clean white title
 *   "impacto"   condensed uppercase with a heavy stroke, line 2 in the accent
 *
 * Same contract as the four in Main.tsx: ALWAYS two lines, balanced by measured
 * width, size fitted to the widest one. They live here because each measures in
 * its own font — Main's fit is Poppins-only.
 *
 * `hook.kicker` feeds the small label (manchete / pergunta / etiqueta); every
 * style has a default so the headline still renders without one.
 *
 * Mirrored by buildExtraHeadlineDemo in the preview's app.js (HL_EXTRA there).
 * Change one side, change the other.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {loadFont as loadPoppins} from '@remotion/google-fonts/Poppins';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';

const POPPINS = loadPoppins('normal', {weights: ['800']}).fontFamily;
const PLAYFAIR = loadPlayfair('normal', {weights: ['800']}).fontFamily;
const INTER = loadInter('normal', {weights: ['500', '700', '800']}).fontFamily;
const ANTON = loadAnton('normal', {weights: ['400']}).fontFamily;

type Extra = {
  family: string;
  weight: number;
  cap: number; // size ceiling
  safeW: number; // widest line allowed
  lh: number;
  top: number;
  tracking: number;
  upper: boolean;
  kicker: string; // default label
};

export const EXTRA_HL: Record<string, Extra> = {
  manchete: {family: PLAYFAIR, weight: 800, cap: 78, safeW: 800, lh: 1.14, top: 250, tracking: -1, upper: false, kicker: 'ATENÇÃO'},
  pergunta: {family: INTER, weight: 700, cap: 66, safeW: 780, lh: 1.18, top: 250, tracking: -1, upper: false, kicker: 'Dúvida comum'},
  etiqueta: {family: POPPINS, weight: 800, cap: 88, safeW: 900, lh: 1.06, top: 270, tracking: -1, upper: false, kicker: 'VOCÊ SABIA?'},
  impacto: {family: ANTON, weight: 400, cap: 150, safeW: 900, lh: 1.06, top: 250, tracking: 1, upper: true, kicker: ''},
};

const HL_MIN = 40;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const widthOf = (text: string, size: number, E: Extra) =>
  text
    ? measureText({text, fontFamily: E.family, fontSize: size, fontWeight: E.weight, letterSpacing: `${E.tracking}px`}).width
    : 0;

function twoLines(text: string, E: Extra): [string, string] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] ?? '', ''];
  let best: [string, string] = [words[0], words.slice(1).join(' ')];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const d = Math.abs(widthOf(a, 100, E) - widthOf(b, 100, E));
    if (d < bestDiff) {
      bestDiff = d;
      best = [a, b];
    }
  }
  return best;
}

function fit(lines: [string, string], E: Extra, cap: number, safeW: number): number {
  const widest = (size: number) => Math.max(widthOf(lines[0], size, E), widthOf(lines[1], size, E));
  let size = Math.floor((safeW / Math.max(1, widest(100))) * 100);
  size = clamp(Math.floor((safeW / Math.max(1, widest(size))) * size), HL_MIN, cap);
  return size;
}

// Text that sits ON the accent has to stay readable whatever colour was picked.
export const inkOn = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#111';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? '#111' : '#fff';
};

export const ExtraHeadline: React.FC<{
  styleId: string;
  text: string;
  accent: string;
  kicker?: string;
  top?: number;
  cap?: number;
  safeW?: number;
  lineHeight?: number;
  op: number;
  y: number;
}> = ({styleId, text, accent, kicker, top, cap, safeW, lineHeight, op, y}) => {
  const E = EXTRA_HL[styleId];
  const lines = twoLines(E.upper ? text.toUpperCase() : text, E);
  const size = fit(lines, E, cap ?? E.cap, safeW ?? E.safeW);
  const label = (kicker ?? E.kicker).trim();
  const shell: React.CSSProperties = {
    opacity: op,
    translate: `0px ${y}px`,
    fontFamily: E.family,
    fontWeight: E.weight,
    fontSize: size,
    lineHeight: lineHeight ?? E.lh,
    letterSpacing: E.tracking,
    whiteSpace: 'nowrap',
  };
  const fill: React.CSSProperties = {justifyContent: 'flex-start', alignItems: 'center', paddingTop: top ?? E.top};

  if (styleId === 'manchete') {
    return (
      <AbsoluteFill style={fill}>
        <div style={{...shell, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          {label ? (
            <div style={{background: '#d40000', color: '#fff', fontFamily: INTER, fontWeight: 800, fontSize: 26, letterSpacing: 3, lineHeight: 1, padding: '9px 20px'}}>
              {label.toUpperCase()}
            </div>
          ) : null}
          <div style={{background: '#f6f3ea', color: '#111', padding: '24px 34px 30px', boxShadow: '0 14px 40px rgba(0,0,0,0.5)', textAlign: 'left'}}>
            <div>{lines[0]}</div>
            {lines[1] ? (
              <div>
                <span style={{background: `linear-gradient(transparent 58%, ${accent} 58%)`}}>{lines[1]}</span>
              </div>
            ) : null}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (styleId === 'pergunta') {
    return (
      <AbsoluteFill style={fill}>
        <div style={{...shell, background: '#fff', color: '#111', borderRadius: 38, padding: '24px 38px 32px', boxShadow: '0 14px 40px rgba(0,0,0,0.5)', textAlign: 'left'}}>
          {label ? (
            <div style={{fontFamily: INTER, fontWeight: 500, fontSize: 27, letterSpacing: 0, lineHeight: 1.2, color: '#777', marginBottom: 8}}>{label}</div>
          ) : null}
          {lines.filter(Boolean).map((l, i) => (<div key={i}>{l}</div>))}
        </div>
      </AbsoluteFill>
    );
  }

  if (styleId === 'etiqueta') {
    return (
      <AbsoluteFill style={fill}>
        <div style={{...shell, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
          {label ? (
            <div style={{background: accent, color: inkOn(accent), fontFamily: INTER, fontWeight: 800, fontSize: 27, letterSpacing: 4, lineHeight: 1, padding: '12px 28px', borderRadius: 99, marginBottom: 20, boxShadow: '0 8px 22px rgba(0,0,0,0.4)'}}>
              {label.toUpperCase()}
            </div>
          ) : null}
          <div style={{color: '#fff', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.6))'}}>
            {lines.filter(Boolean).map((l, i) => (<div key={i}>{l}</div>))}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // impacto
  return (
    <AbsoluteFill style={fill}>
      <div style={{...shell, textAlign: 'center', WebkitTextStroke: '14px #000', paintOrder: 'stroke fill', filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))', padding: '0 50px'}}>
        <div style={{color: '#fff'}}>{lines[0]}</div>
        {lines[1] ? <div style={{color: accent}}>{lines[1]}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
