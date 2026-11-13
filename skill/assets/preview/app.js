/* Two structural constraints of the timeline gutter, learned the hard way.
   These live here and not in SKILL.md: they matter to whoever EDITS this file,
   not to an agent using the skill, and the skill prompt is resent every turn.

   **Nothing in the ancestor chain of `.track-label` may have `overflow:hidden`** —
   the gutter mask rides `position:sticky` there, and an overflow ancestor makes a
   new scroll container and strands it. That rules out the usual max-height
   accordion; the reveal animates the blocks instead.
   **The panel's `pointerdown` must ignore the gutter.** It falls through to a
   scrub branch that calls `setPointerCapture` on the panel, which retargets the
   following click — a real click on a gutter control was swallowed entirely (while
   a programmatic `.click()` worked, which is what makes it confusing to diagnose)
   and the needle jumped to 0, since the gutter sits left of t=0.
*/
/* CRVID preview — interactive editing timeline.
 * IMMUTABLE app: everything per-session comes from /api/state (state.json,
 * edl.json) + /gen/* (waveform, thumbs) + /media/* (video, captions, edit-data).
 * User adjustments are POSTed to /api/save → <edit>/preview_edits.json and
 * applied by the skill (which re-renders and bumps state).
 *
 * Three interaction rules worth knowing before editing this file:
 *  - Tracks are identified by ICON only (ICON.captions/video/audio/inserts/music),
 *    painted into .tl-chip cards. LABEL_W must stay in sync with .track-label's
 *    width. The gutter masks the lanes with .track-label::before painted in
 *    --panel-bg (the panel is a solid surface for exactly this reason), pinned by
 *    native position:sticky. #gutterLine is the divider, pinned by a scroll-driven
 *    CSS timeline on `translate`. Do NOT re-drive either from a JS scroll handler
 *    or a clip-path animation — both lag a frame and the column visibly breathes
 *    while scrolling. JS only publishes --max-scroll (on zoom/resize).
 *  - Correction markers: M (or the transport button) drops an IN, the next M closes
 *    the range and opens the note editor. They ride in S.notes and ship as
 *    payload.notes on save; watch_edits.py turns each save into a chat notification.
 *  - Zoom: the slider is anchored on the needle, trackpad pinch (wheel+ctrlKey)
 *    on the pointer. Both go through applyZoom(pps, t, anchorX) — never on scroll 0.
 *  - Layout follows the SOURCE aspect: portrait clips get body.portrait (player
 *    right at full column height, transport+timeline left), landscape keeps the
 *    stacked layout. #stage keeps the split from swallowing anything below it.
 *  - Timecode uses a MONOSPACE stack: Poppins ships no tabular figures, so
 *    `font-variant-numeric: tabular-nums` silently does nothing and every digit
 *    change resized the readout, shoving the whole transport row sideways.
 *  - No glows anywhere — depth shadows are fine, coloured halos are not.
 *  - The style gate (STYLE_CATALOG → #styleSetup) stands BETWEEN the phases: when
 *    state.awaitingStyle is true it replaces the stage entirely, so the choice of
 *    editing style / caption style / edit elements cannot be skipped. It saves to
 *    <edit>/preview_style.json (never preview_edits.json — different screens,
 *    different moments, one would clobber the other).
 */
'use strict';

// ---------- dom ----------
const $ = (id) => document.getElementById(id);
const video = $('video');
const panel = $('timelinePanel');
const timelineEl = $('timeline');
const rulerCv = $('ruler');
const waveCv = $('wave');
const laneVideo = $('laneVideo');
const laneAudio = $('laneAudio');
const laneCaptions = $('laneCaptions');
const insertTracksEl = $('insertTracks');
const needle = $('needle');
const tooltip = $('tooltip');

// minimal solid icons (design-system consistent — no emoji)
const ICON = {
  play: '<svg viewBox="0 0 16 16"><path d="M4 2.2v11.6c0 .9 1 1.5 1.8 1L15 9.2c.8-.5.8-1.7 0-2.2L5.8 1.2C5 .7 4 1.3 4 2.2z"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/></svg>',
  vol: '<svg viewBox="0 0 16 16"><path d="M2 6v4h2.8L9 13.4V2.6L4.8 6H2z"/><path d="M11 5.2a3.4 3.4 0 0 1 0 5.6V9.4a2 2 0 0 0 0-2.8V5.2z"/></svg>',
  mute: '<svg viewBox="0 0 16 16"><path d="M2 6v4h2.8L9 13.4V2.6L4.8 6H2z"/><path d="M11.2 6.2l3.6 3.6m0-3.6l-3.6 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>',
  // track identity — icons replace text labels (data-icon in index.html)
  captions: '<svg viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="3.4" y="8.4" width="4.4" height="1.5" rx=".75"/><rect x="8.9" y="8.4" width="3.7" height="1.5" rx=".75"/></svg>',
  video: '<svg viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 5.9v4.2c0 .4.44.64.79.42l3.3-2.1a.5.5 0 0 0 0-.85l-3.3-2.1a.5.5 0 0 0-.79.43z"/></svg>',
  audio: '<svg viewBox="0 0 16 16"><path d="M2.4 6.2v3.6h2.4l3.5 2.8V3.4L4.8 6.2H2.4z"/><path d="M10.5 5.7a3.2 3.2 0 0 1 0 4.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12.4 3.9a5.7 5.7 0 0 1 0 8.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  inserts: '<svg viewBox="0 0 16 16"><rect x="1.2" y="3.2" width="13.6" height="9.6" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5.3" cy="6.6" r="1.15"/><path d="M2.6 11.7l3-2.9a1 1 0 0 1 1.34-.05l1.84 1.58 1.5-1.24a1 1 0 0 1 1.29.02l1.72 1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  music: '<svg viewBox="0 0 16 16"><path d="M13.1 1.9 6.6 3.5a.8.8 0 0 0-.6.78v6.06a2.25 2.25 0 1 0 1.5 2.12V6.6l5-1.22v3.5a2.25 2.25 0 1 0 1.5 2.12V2.68a.8.8 0 0 0-.9-.78z"/></svg>',
  text: '<svg viewBox="0 0 16 16"><path d="M2 2.6h12v2.5h-1.5V4.1H8.75v8.1h1.6v1.3H5.65v-1.3h1.6V4.1H3.5v1H2V2.6z"/></svg>',
  notes: '<svg viewBox="0 0 16 16"><rect x="1.9" y="1.4" width="1.6" height="13.2" rx=".8"/><path d="M5 2.7h7.6a.6.6 0 0 1 .47.97L11.36 6l1.71 2.33a.6.6 0 0 1-.47.97H5V2.7z"/></svg>',
  flag: '<svg viewBox="0 0 16 16"><rect x="1.9" y="1.4" width="1.6" height="13.2" rx=".8"/><path d="M5 2.7h7.6a.6.6 0 0 1 .47.97L11.36 6l1.71 2.33a.6.6 0 0 1-.47.97H5V2.7z"/></svg>',
};

/* ---------- style catalog (the Fase 1 → Fase 2 gate) ----------
 * The one place that knows which looks Edvid can build. It is APP-level, not
 * session-level: a new editing style or caption style is a new entry here plus
 * its implementation in the track reference — never a per-session UI.
 * The user's pick ships to <edit>/preview_style.json; the skill reads it once,
 * at the gate, and builds Fase 2 from it.
 */
const STYLE_CATALOG = {
  edits: [
    {
      // First on purpose: defaultStyle() takes edits[0], so this is also the
      // default for every new project — a clean full-frame cut, with inserts as
      // something the user opts into.
      id: 'limpa',
      name: 'Limpa',
      mock: `<svg viewBox="0 0 66 118" xmlns="http://www.w3.org/2000/svg">
        <rect x=".5" y=".5" width="65" height="117" rx="7" fill="#0b0e13" stroke="rgba(255,255,255,.12)"/>
        <rect x="3" y="3" width="60" height="112" rx="5" fill="rgba(255,255,255,.05)"/>
        <circle cx="33" cy="48" r="13" fill="rgba(255,255,255,.16)"/>
        <path d="M12 115a21 21 0 0142 0z" fill="rgba(255,255,255,.16)"/>
        <rect x="14" y="14" width="38" height="4.4" rx="2.2" fill="rgba(255,255,255,.5)"/>
        <rect x="20" y="21.5" width="26" height="4.4" rx="2.2" fill="rgba(255,255,255,.3)"/>
        <rect x="12" y="74" width="42" height="11" rx="5.5" fill="#0b0e13" stroke="rgba(9,181,183,.65)"/>
        <rect x="16" y="78.5" width="12" height="2.4" rx="1.2" fill="rgba(9,181,183,.9)"/>
        <rect x="30" y="78.5" width="8" height="2.4" rx="1.2" fill="rgba(255,255,255,.5)"/>
        <rect x="40" y="78.5" width="10" height="2.4" rx="1.2" fill="rgba(255,255,255,.5)"/>
      </svg>`,
    },
    {
      id: 'split',
      name: 'Tela dividida',
      mock: `<svg viewBox="0 0 66 118" xmlns="http://www.w3.org/2000/svg">
        <rect x=".5" y=".5" width="65" height="117" rx="7" fill="#0b0e13" stroke="rgba(255,255,255,.12)"/>
        <rect x="3" y="3" width="60" height="36" rx="5" fill="rgba(35,201,214,.16)"/>
        <circle cx="17" cy="15" r="3.6" fill="rgba(35,201,214,.6)"/>
        <path d="M6 36l11-11a2 2 0 013 0l7 7 5-4a2 2 0 013 0l11 8" fill="none" stroke="rgba(35,201,214,.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 40.5h60" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>
        <rect x="3" y="42" width="60" height="73" rx="5" fill="rgba(255,255,255,.05)"/>
        <circle cx="33" cy="70" r="12" fill="rgba(255,255,255,.16)"/>
        <path d="M15 115a18 18 0 0136 0z" fill="rgba(255,255,255,.16)"/>
        <rect x="12" y="35" width="42" height="11" rx="5.5" fill="#0b0e13" stroke="rgba(9,181,183,.65)"/>
        <rect x="16" y="39.5" width="12" height="2.4" rx="1.2" fill="rgba(9,181,183,.9)"/>
        <rect x="30" y="39.5" width="8" height="2.4" rx="1.2" fill="rgba(255,255,255,.5)"/>
        <rect x="40" y="39.5" width="10" height="2.4" rx="1.2" fill="rgba(255,255,255,.5)"/>
      </svg>`,
    },
    {
      id: 'split2',
      name: 'Tela dividida 2',
      mock: `<svg viewBox="0 0 66 118" xmlns="http://www.w3.org/2000/svg">
        <rect x=".5" y=".5" width="65" height="117" rx="7" fill="#0b0e13" stroke="rgba(255,255,255,.12)"/>
        <rect x="3" y="3" width="60" height="65" rx="5" fill="rgba(255,255,255,.05)"/>
        <circle cx="33" cy="24" r="11" fill="rgba(255,255,255,.16)"/>
        <path d="M16 68a17 17 0 0134 0z" fill="rgba(255,255,255,.16)"/>
        <path d="M3 69.5h60" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>
        <rect x="3" y="71" width="60" height="44" rx="5" fill="rgba(35,201,214,.16)"/>
        <circle cx="17" cy="83" r="3.6" fill="rgba(35,201,214,.6)"/>
        <path d="M6 111l11-11a2 2 0 013 0l7 7 5-4a2 2 0 013 0l11 8" fill="none" stroke="rgba(35,201,214,.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="12" y="58" width="42" height="11" rx="5.5" fill="#0b0e13" stroke="rgba(9,181,183,.65)"/>
        <rect x="16" y="62.5" width="12" height="2.4" rx="1.2" fill="rgba(9,181,183,.9)"/>
        <rect x="30" y="62.5" width="8" height="2.4" rx="1.2" fill="rgba(255,255,255,.5)"/>
        <rect x="40" y="62.5" width="10" height="2.4" rx="1.2" fill="rgba(255,255,255,.5)"/>
      </svg>`,
    },
  ],
  // No names on purpose: the sample headline IS the label. Ids and geometry
  // mirror HL_STYLES in the template's Main.tsx — keep the two in step.
  headlines: [
    {id: 'outline', name: 'Contorno', hl: 'outline'},
    {id: 'card', name: 'Cartão', hl: 'card'},
    {id: 'realce', name: 'Realce', hl: 'realce'},
    {id: 'misto', name: 'Misto', hl: 'misto'},
    // the four with their own face — HeadlineExtras.tsx / HL_EXTRA below
    {id: 'manchete', name: 'Manchete', hl: 'manchete'},
    {id: 'pergunta', name: 'Pergunta', hl: 'pergunta'},
    {id: 'etiqueta', name: 'Etiqueta', hl: 'etiqueta'},
    {id: 'impacto', name: 'Impacto', hl: 'impacto'},
  ],
  captions: [
    {id: 'karaoke', name: 'Karaokê', demo: 'karaoke'},
    {id: 'stacked', name: 'Empilhado', demo: 'stacked'},
    {id: 'scatter', name: 'Disperso', demo: 'scatter'},
    {id: 'simples', name: 'Simples', stat: 'simples'},
    {id: 'serifada', name: 'Serifada', stat: 'serifada'},
    {id: 'classica', name: 'Clássica', stat: 'classica'},
    // word-timed, ExtraCaptions.tsx / EXTRA_CAPS below
    {id: 'minimal', name: 'Minimal', demo: 'minimal'},
    {id: 'destaque', name: 'Destaque', demo: 'destaque'},
    {id: 'tarja', name: 'Tarja', demo: 'tarja'},
    {id: 'editorial', name: 'Editorial', demo: 'editorial'},
    // the one style with knobs — picking it opens the adjust panel below the row
    {id: 'custom', name: 'Personalizada', custom: true},
  ],
  elements: [
    {
      id: 'tracking',
      name: 'Movimento de tracking',
      def: false,
      icon: '<svg viewBox="0 0 16 16"><path d="M2 5.6V3.4A1.4 1.4 0 013.4 2h2.2M10.4 2h2.2A1.4 1.4 0 0114 3.4v2.2M14 10.4v2.2a1.4 1.4 0 01-1.4 1.4h-2.2M5.6 14H3.4A1.4 1.4 0 012 12.6v-2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="2.1"/></svg>',
    },
    {
      id: 'zoomAuto',
      name: 'Automação de zoom in',
      def: true,
      icon: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.6 10.6L14 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/><path d="M7 5.1v3.8M5.1 7h3.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>',
    },
    {
      id: 'zoomCuts',
      name: 'Zoom in e out nos cortes',
      def: true,
      icon: '<svg viewBox="0 0 16 16"><rect x="1.2" y="3.4" width="6" height="9.2" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="9.6" y="1.9" width="5.2" height="12.2" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.4 8h.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    },
    {
      id: 'flashCut',
      name: 'Flash na transição',
      def: false,
      icon: '<svg viewBox="0 0 16 16"><path d="M3 13.2L13 3.2" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none"/><path d="M6.6 14L9.4 11.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".55"/><path d="M6.6 4.8L3.8 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".55"/></svg>',
    },
    {
      // Split layouts only: image and footage dissolve into each other at the
      // seam, and one image dissolves into the next, instead of hard edges.
      id: 'softSplit',
      name: 'Emenda suave na tela dividida',
      def: true,
      icon: '<svg viewBox="0 0 16 16"><rect x="1.4" y="1.6" width="13.2" height="12.8" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.4 6.2h9.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".9"/><path d="M3.4 8.2h9.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><path d="M3.4 10.2h9.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".22"/></svg>',
    },
    {
      // Only has something to do in the split layouts — that is where images go.
      id: 'imagesAI',
      name: 'Imagens por IA',
      def: false,
      icon: '<svg viewBox="0 0 16 16"><rect x="1.4" y="3" width="13.2" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.4 11.2l2.9-3a1 1 0 011.4 0l1.6 1.6 1-1a1 1 0 011.4 0l1 1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.4 4.4l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z"/></svg>',
    },
    {
      id: 'musicAI',
      name: 'Trilha sonora com IA',
      def: true,
      icon: '<svg viewBox="0 0 16 16"><path d="M12.6 1.6L6.9 3a.7.7 0 00-.55.68v5.6a2 2 0 101.35 1.9V5.9l4.4-1.05v2.9a2 2 0 101.35 1.9V2.3a.7.7 0 00-.85-.7z"/><path d="M2.4 2.2l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/></svg>',
    },
  ],
};

/* ---------- caption previews: the template's animation, not an impression ----
 * Every number here is lifted from the render (Main.tsx Karaoke/Word and
 * StackedCaptions.tsx STACK_MIXED) and scaled by boxWidth/1080, so the preview
 * shows the real proportions, the real faces and the real motion. If the
 * template's caption look changes, change it HERE too — a preview that lies
 * about the style is worse than no preview.
 */
const CAP_TEXT = 'É assim que sua legenda irá aparecer';
const FPS_REF = 30; // the template's reference fps for frame-based timings

// cubic-bezier solver — the stacked style eases on bezier(.16,1,.3,1)
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (t) => ((ax * t + bx) * t + cx) * t;
  const dfx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = fx(t) - x;
      if (Math.abs(e) < 1e-4) break;
      const d = dfx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3); // Easing.out(Easing.cubic)
const easeStack = bez(0.16, 1, 0.3, 1);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

let capAnims = []; // step(nowSeconds) per visible caption demo

// Karaoke: lines of ≤3 words (captions.maxWords), Poppins 900 white, each word
// rises 34px and fades in over 7 frames; the line is replaced by the next one.
function buildKaraokeDemo(host) {
  const s = host.clientWidth / 1080;
  host.innerHTML = '';
  const wrap = el('div', 'cap-demo', host);
  const words = CAP_TEXT.split(' ');
  const lines = [];
  for (let i = 0; i < words.length; i += 3) lines.push(words.slice(i, i + 3));

  const STEP = 0.26, ENTER = 7 / FPS_REF, HOLD = 0.6;
  const rise = 34 * s;
  const built = [];
  let t = 0;
  for (const ln of lines) {
    const box = el('div', 'kar-line', wrap);
    box.style.fontSize = `${76 * s}px`;
    const spans = ln.map((w) => {
      const sp = el('span', '', box);
      sp.textContent = w;
      sp.style.marginRight = `${18 * s}px`;
      return sp;
    });
    const start = t;
    t = start + (ln.length - 1) * STEP + ENTER + HOLD;
    built.push({ box, spans, start, end: t });
  }
  const cycle = t + 0.3;

  return (now) => {
    const p = now % cycle;
    for (const L of built) {
      const on = p >= L.start && p < L.end;
      L.box.style.display = on ? '' : 'none';
      if (!on) continue;
      L.spans.forEach((sp, j) => {
        const e = easeOutCubic(clamp01((p - (L.start + j * STEP)) / ENTER));
        sp.style.opacity = e;
        sp.style.translate = `0px ${((1 - e) * rise).toFixed(2)}px`;
      });
    }
  };
}

// Stacked: one cue, lines cycling the STACK_MIXED styles (bold-italic gradient →
// regular small → Playfair italic orange). Words rise 46px with a blur that
// resolves; the cue leaves with the blur_up exit.
const STK_LINES = [
  { words: ['É', 'assim'], style: 0 },
  { words: ['que', 'sua', 'legenda'], style: 1 },
  { words: ['irá', 'aparecer'], style: 2 },
];
function buildStackedDemo(host) {
  const s = host.clientWidth / 1080;
  host.innerHTML = '';
  const wrap = el('div', 'cap-demo', host);
  const cue = el('div', 'stk-cue', wrap);

  const STEP = 0.2, ENTER = 8 / FPS_REF, HOLD = 0.8, EXIT = 7 / FPS_REF;
  const rise = 46 * s, blurIn = 5 * s, upY = 55 * s, cueBlur = 14 * s;
  const shadow = `drop-shadow(0 ${(5 * s).toFixed(2)}px ${(9 * s).toFixed(2)}px rgba(0,0,0,0.5))`;
  const all = [];
  let idx = 0;
  for (const L of STK_LINES) {
    const row = el('div', 'stk-line', cue);
    let size = 86;
    if (L.style === 1) size = Math.round(size * 0.72);
    if (L.style === 2) size = Math.round(size * 0.95);
    row.style.fontSize = `${size * s}px`;
    L.words.forEach((w, i) => {
      // the face/gradient belongs to the WORD, like the template's `...ls` spread
      const sp = el('span', `s${L.style}`, row);
      sp.textContent = w + (i < L.words.length - 1 ? ' ' : '');
      all.push({ sp, start: idx * STEP });
      idx++;
    });
  }
  const exitStart = (idx - 1) * STEP + ENTER + HOLD;
  // short gap after the exit: side by side with the karaoke card, a preview that
  // sits blank for half a second reads as broken rather than as a cue boundary
  const cycle = exitStart + EXIT + 0.15;

  return (now) => {
    const p = now % cycle;
    const ex = clamp01((p - exitStart) / EXIT);
    cue.style.opacity = 1 - ex;
    cue.style.translate = `0px ${(-upY * ex).toFixed(2)}px`;
    cue.style.filter = ex > 0.02 ? `blur(${(cueBlur * ex).toFixed(2)}px)` : '';
    for (const w of all) {
      const e = easeStack(clamp01((p - w.start) / ENTER));
      const eb = (1 - e) * blurIn;
      w.sp.style.opacity = e;
      w.sp.style.translate = `0px ${((1 - e) * rise).toFixed(2)}px`;
      w.sp.style.filter = `${eb > 0.06 ? `blur(${eb.toFixed(2)}px) ` : ''}${shadow}`;
    }
  };
}

/* ---------- headline previews: the template's own hook styles ----------------
 * Same contract as the caption demos — these render what `HookInner` renders,
 * scaled from 1080-wide. The two-line break and the size fit run the SAME
 * algorithm as the template (balance by measured width, then fit to safeW), so
 * the preview shows the real break at the real size, not an approximation.
 * HL_STYLES exists on both sides; change one, change the other.
 */
const HEADLINE_TEXT = 'É assim que vai ficar a sua headline';
const HL_MIN = 40;
const HL_STYLES = {
  outline: { weights: [800, 800], cap: 92, safeW: 900, lh: 1.02 },
  card: { weights: [900, 900], cap: 82, safeW: 820, lh: 1.06 },
  realce: { weights: [900, 900], cap: 86, safeW: 830, lh: 1.04 },
  misto: { weights: [400, 900], cap: 98, safeW: 900, lh: 0.98 },
};

// Measured in RENDER units (1080-wide), scaled to the box only at the end — the
// template's letterSpacing is -1px at 1080, which is NOT proportional once the
// preview shrinks it, so measuring in preview px would break the fit.
let hlMeter = null;
function measureType(text, size, weight, family, tracking) {
  if (!text) return 0;
  if (!hlMeter) {
    hlMeter = document.createElement('span');
    hlMeter.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;';
    document.body.appendChild(hlMeter);
  }
  hlMeter.style.fontFamily = family || "'Poppins',sans-serif";
  hlMeter.style.letterSpacing = `${tracking == null ? -1 : tracking}px`;
  hlMeter.style.fontSize = `${size}px`;
  hlMeter.style.fontWeight = String(weight);
  hlMeter.textContent = text;
  return hlMeter.offsetWidth;
}
const hlWidth = (text, size, weight) => measureType(text, size, weight);

// Balance by MEASURED width, not word count: "É assim que vai" and "ficar a sua
// headline" are 4 and 3 words but nearly the same width — counting words breaks
// the line in the wrong place.
function hlTwoLines(text, weights) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] || '', ''];
  let best = [words[0], words.slice(1).join(' ')];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const d = Math.abs(hlWidth(a, 100, weights[0]) - hlWidth(b, 100, weights[1]));
    if (d < bestDiff) { bestDiff = d; best = [a, b]; }
  }
  return best;
}

function hlFit(lines, S) {
  const widest = (size) =>
    Math.max(hlWidth(lines[0], size, S.weights[0]), hlWidth(lines[1], size, S.weights[1]));
  let size = Math.floor((S.safeW / Math.max(1, widest(100))) * 100);
  size = Math.floor((S.safeW / Math.max(1, widest(size))) * size);
  return Math.max(HL_MIN, Math.min(size, S.cap));
}

function buildHeadlineDemo(host, styleId) {
  if (HL_EXTRA[styleId]) return buildExtraHeadlineDemo(host, styleId);
  const s = host.clientWidth / 1080;
  const S = HL_STYLES[styleId];
  host.innerHTML = '';
  const wrap = el('div', 'cap-demo', host);
  const raw = styleId === 'card' ? HEADLINE_TEXT.toUpperCase() : HEADLINE_TEXT;
  const lines = hlTwoLines(raw, S.weights);
  const size = hlFit(lines, S) * s;
  const box = el('div', `hl-demo hl-${styleId}`, wrap);
  box.style.lineHeight = String(S.lh);
  box.style.letterSpacing = `${-1 * s}px`;

  if (styleId === 'realce') {
    for (const l of lines) {
      if (!l) continue;
      const b = el('div', 'hl-block', box);
      b.style.fontSize = `${size}px`;
      b.style.borderRadius = `${12 * s}px`;
      b.textContent = l;
    }
    return;
  }
  if (styleId === 'card') {
    box.style.borderRadius = `${24 * s}px`;
    box.style.padding = `${28 * s}px ${46 * s}px`;
  }
  if (styleId === 'outline') {
    box.style.webkitTextStroke = `${12 * s}px #000`;
  }
  lines.forEach((l, i) => {
    if (!l) return;
    const d = el('div', '', box);
    d.style.fontSize = `${size}px`;
    d.style.fontWeight = String(S.weights[i]);
    // var(), not a literal — an inline colour would beat the accent variable and
    // this preview would keep painting orange while the others followed the pick
    if (styleId === 'misto') d.style.color = i === 1 ? 'var(--hl-accent)' : '#fff';
    d.textContent = l;
  });
}

// Scatter ("disperso"): serif, lowercase, one word at a time, off-white with a
// slight darkening toward the baseline. Ordinary words FADE only — no movement;
// the one highlighted word resolves out of a blur and dissolves back into it.
// Mirrors ScatterCaptions.tsx: same line rules, same SPREAD, same hash.
const SCAT = { base: 72, hiScale: 1.62, gap: 12, spread: 0.45, safeW: 820 };
const scatHash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function buildScatterDemo(host) {
  const s = host.clientWidth / 1080;
  host.innerHTML = '';
  const wrap = el('div', 'cap-demo', host);
  const cue = el('div', 'scat-cue', wrap);

  const words = CAP_TEXT.toLowerCase().split(' ');
  // highlight = longest word of the cue, and only if it carries weight (>6)
  let hiIdx = -1, hiLen = 6;
  words.forEach((w, i) => { if (w.length > hiLen) { hiLen = w.length; hiIdx = i; } });

  // ragged lines of 3–4 words; the highlighted word takes a line of its own
  const lines = [];
  let line = [];
  words.forEach((w, i) => {
    if (i === hiIdx) {
      if (line.length) lines.push(line);
      lines.push([{ w, i, hi: true }]);
      line = [];
      return;
    }
    line.push({ w, i, hi: false });
    if (line.length >= (scatHash(31 + i) > 0.5 ? 4 : 3)) { lines.push(line); line = []; }
  });
  if (line.length) lines.push(line);

  const STEP = 0.22, ENTER = 7 / FPS_REF, HI_ENTER = 10 / FPS_REF, HOLD = 0.9, EXIT = 8 / FPS_REF;
  const all = [];
  lines.forEach((ln, li) => {
    const row = el('div', 'scat-line', cue);
    row.style.gap = `${SCAT.gap * s}px`;
    let w = 0;
    for (const it of ln) {
      const sp = el('span', it.hi ? 'hi' : '', row);
      sp.textContent = it.w;
      sp.style.fontSize = `${(it.hi ? SCAT.base * SCAT.hiScale : SCAT.base) * s}px`;
      all.push({ sp, start: it.i * STEP, hi: it.hi });
      w += sp.offsetWidth + SCAT.gap * s;
    }
    const room = Math.max(0, (SCAT.safeW * s - w) / 2) * SCAT.spread;
    row.style.translate = `${((scatHash(17 + li * 5 + 3) * 2 - 1) * room).toFixed(1)}px 0px`;
  });

  const exitStart = (words.length - 1) * STEP + ENTER + HOLD;
  const cycle = exitStart + EXIT + 0.35;
  const blurIn = 26 * s, blurOut = 30 * s;

  return (now) => {
    const p = now % cycle;
    const out = clamp01((p - exitStart) / EXIT);
    for (const w of all) {
      const t = easeOutCubic(clamp01((p - w.start) / (w.hi ? HI_ENTER : ENTER)));
      w.sp.style.opacity = t * (1 - out);
      if (w.hi) {
        const b = (1 - t) * blurIn + out * blurOut;
        w.sp.style.filter = b > 0.1 ? `blur(${b.toFixed(2)}px)` : '';
      }
    }
  };
}

/* ---------- the three STATIC caption styles ---------------------------------
 * No animation, so no entry in capAnims — built once and left alone. Mirrors
 * SIMPLE_VARIANTS in SimpleCaptions.tsx, including the rule that matters most:
 * lines are grouped by MEASURED WIDTH, capped at maxWords. That is why a long
 * word ends up alone and short ones ride together.
 */
const STATIC_VARIANTS = {
  simples: {family: "'Poppins',sans-serif", weight: 600, size: 82, maxWords: 3, lines: 1, sx: 0.9, sy: 0.9, tracking: -3, maxW: 860},
  serifada: {family: "'Libre Baskerville',serif", weight: 700, size: 84, maxWords: 3, lines: 1, sx: 1, sy: 1, tracking: -1, maxW: 860},
  classica: {family: "'Inter',sans-serif", weight: 500, size: 52, maxWords: 14, lines: 2, sx: 1, sy: 1, tracking: 0, maxW: 840},
};
const ORPHAN_PT = /^(o|a|os|as|e|é|de|do|da|em|no|na|um|uma|que|se|ao|à|por|com)$/i;

function buildStaticDemo(host, id) {
  const V = STATIC_VARIANTS[id];
  const s = host.clientWidth / 1080;
  host.innerHTML = '';
  const wrap = el('div', 'cap-demo', host);
  const words = CAP_TEXT.split(' ');
  const wOf = (ws) => measureType(ws.join(' '), V.size, V.weight, V.family, V.tracking) * V.sx;

  // the WHOLE sentence, cut into cues exactly as the render would
  const cues = [];
  let cur = [];
  for (const w of words) {
    const trial = [...cur, w];
    if (cur.length && (trial.length > V.maxWords || wOf(trial) > V.maxW * V.lines)) {
      cues.push(cur);
      cur = [w];
    } else {
      cur = trial;
    }
  }
  if (cur.length) cues.push(cur);

  const boxes = cues.map((cue) => {
    let lines = [cue];
    if (V.lines === 2 && cue.length > 1) {
      let best = 1, bestScore = Infinity;
      for (let i = 1; i < cue.length; i++) {
        const score = Math.abs(wOf(cue.slice(0, i)) - wOf(cue.slice(i))) + (ORPHAN_PT.test(cue[i - 1]) ? 200 : 0);
        if (score < bestScore) { bestScore = score; best = i; }
      }
      lines = [cue.slice(0, best), cue.slice(best)];
    }
    const box = el('div', 'stat-demo', wrap);
    box.style.fontFamily = V.family;
    box.style.fontWeight = String(V.weight);
    box.style.fontSize = `${V.size * s}px`;
    box.style.letterSpacing = `${V.tracking * s}px`;
    box.style.transform = V.sx === 1 && V.sy === 1 ? '' : `scale(${V.sx}, ${V.sy})`;
    for (const ln of lines) el('div', '', box).textContent = ln.join(' ');
    return box;
  });

  // A style with no animation still has a RHYTHM — the cues replacing each other
  // is what the viewer sees. So the card plays the whole sentence, cue by cue,
  // on hard cuts. A single-cue style (the two-line "classica" fits the sentence
  // whole) has nothing to step through and stays still.
  if (boxes.length < 2) return null;
  const HOLD = 0.95;
  const cycle = boxes.length * HOLD;
  return (now) => {
    const i = Math.floor((now % cycle) / HOLD);
    boxes.forEach((b, k) => { b.style.display = k === i ? '' : 'none'; });
  };
}

const CAP_BUILDERS = {
  karaoke: buildKaraokeDemo, stacked: buildStackedDemo, scatter: buildScatterDemo,
  minimal: (h) => buildExtraCaptionDemo(h, 'minimal'),
  destaque: (h) => buildExtraCaptionDemo(h, 'destaque'),
  tarja: (h) => buildExtraCaptionDemo(h, 'tarja'),
  editorial: (h) => buildExtraCaptionDemo(h, 'editorial'),
};

/* ---------- the four headline styles with their own face ---------------------
 * Mirrors EXTRA_HL / ExtraHeadline in the template's HeadlineExtras.tsx: same
 * numbers, same two-line break and fit, measured in each style's own font.
 */
const HL_EXTRA = {
  manchete: {family: "'Playfair Display',serif", weight: 800, cap: 78, safeW: 800, lh: 1.14, tracking: -1, upper: false, kicker: 'ATENÇÃO'},
  pergunta: {family: "'Inter',sans-serif", weight: 700, cap: 66, safeW: 780, lh: 1.18, tracking: -1, upper: false, kicker: 'Dúvida comum'},
  etiqueta: {family: "'Poppins',sans-serif", weight: 800, cap: 88, safeW: 900, lh: 1.06, tracking: -1, upper: false, kicker: 'VOCÊ SABIA?'},
  impacto: {family: "'Anton',sans-serif", weight: 400, cap: 150, safeW: 900, lh: 1.06, tracking: 1, upper: true, kicker: ''},
};
// text that sits ON the accent stays readable whatever colour was picked
function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#111';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? '#111' : '#fff';
}

function buildExtraHeadlineDemo(host, id) {
  const E = HL_EXTRA[id];
  const s = host.clientWidth / 1080;
  host.innerHTML = '';
  const wrap = el('div', 'cap-demo', host);
  const w = (t, size) => measureType(t, size, E.weight, E.family, E.tracking);
  const words = (E.upper ? HEADLINE_TEXT.toUpperCase() : HEADLINE_TEXT).split(/\s+/);
  let lines = [words[0], words.slice(1).join(' ')], bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const d = Math.abs(w(a, 100) - w(b, 100));
    if (d < bestDiff) { bestDiff = d; lines = [a, b]; }
  }
  const widest = (size) => Math.max(w(lines[0], size), w(lines[1], size));
  let size = Math.floor((E.safeW / Math.max(1, widest(100))) * 100);
  size = Math.max(HL_MIN, Math.min(Math.floor((E.safeW / Math.max(1, widest(size))) * size), E.cap));

  const box = el('div', `hl-demo hlx hlx-${id}`, wrap);
  box.style.fontFamily = E.family;
  box.style.fontWeight = String(E.weight);
  box.style.fontSize = `${size * s}px`;
  box.style.lineHeight = String(E.lh);
  box.style.letterSpacing = `${E.tracking * s}px`;
  const px = (n) => `${n * s}px`;
  const line = (parent, text) => { const d = el('div', '', parent); d.textContent = text; return d; };

  if (id === 'manchete') {
    const tag = el('div', 'hlx-tag', box);
    tag.textContent = E.kicker;
    tag.style.cssText += `font-size:${px(26)};letter-spacing:${px(3)};padding:${px(9)} ${px(20)};`;
    const paper = el('div', 'hlx-paper', box);
    paper.style.padding = `${px(24)} ${px(34)} ${px(30)}`;
    line(paper, lines[0]);
    el('span', 'hlx-mark', line(paper, '')).textContent = lines[1];
  } else if (id === 'pergunta') {
    box.style.borderRadius = px(38);
    box.style.padding = `${px(24)} ${px(38)} ${px(32)}`;
    const who = el('div', 'hlx-who', box);
    who.textContent = E.kicker;
    who.style.cssText += `font-size:${px(27)};margin-bottom:${px(8)};`;
    lines.forEach((l) => line(box, l));
  } else if (id === 'etiqueta') {
    const pill = el('div', 'hlx-pill', box);
    pill.textContent = E.kicker;
    pill.style.cssText += `font-size:${px(27)};letter-spacing:${px(4)};padding:${px(12)} ${px(28)};margin-bottom:${px(20)};`;
    lines.forEach((l) => line(box, l));
  } else {
    box.style.webkitTextStroke = `${px(14)} #000`;
    line(box, lines[0]);
    line(box, lines[1]).style.color = 'var(--hl-accent)';
  }
}

/* ---------- the four word-timed caption styles -------------------------------
 * Mirrors EXTRA_VARIANTS / ExtraCaptions.tsx: grouped by measured width capped
 * at maxWords, the spoken word driving the look. Authored at 1080, scaled.
 */
const EXTRA_CAPS = {
  minimal: {family: "'Poppins',sans-serif", weight: 800, size: 78, maxWords: 3, lines: 1, tracking: -1, maxW: 860, upper: false},
  destaque: {family: "'Poppins',sans-serif", weight: 900, size: 74, maxWords: 3, lines: 1, tracking: -1, maxW: 820, upper: true},
  tarja: {family: "'Inter',sans-serif", weight: 600, size: 52, maxWords: 9, lines: 2, tracking: 0, maxW: 780, upper: false},
  editorial: {family: "'Poppins',sans-serif", weight: 600, size: 70, maxWords: 3, lines: 1, tracking: -1, maxW: 840, upper: false},
};

function buildExtraCaptionDemo(host, id) {
  const V = EXTRA_CAPS[id];
  const s = host.clientWidth / 1080;
  host.innerHTML = '';
  const wrap = el('div', 'cap-demo', host);
  const px = (n) => `${n * s}px`;
  const all = (V.upper ? CAP_TEXT.toUpperCase() : CAP_TEXT).split(' ');
  const wOf = (ws) => measureType(ws.join(' '), V.size, V.weight, V.family, V.tracking);
  const cues = [];
  let cur = [];
  for (const w of all) {
    const trial = [...cur, w];
    if (cur.length && (trial.length > V.maxWords || wOf(trial) > V.maxW * V.lines)) { cues.push(cur); cur = [w]; }
    else cur = trial;
  }
  if (cur.length) cues.push(cur);

  const STEP = 0.3, HOLD = 0.5, FADE = 4 / FPS_REF;
  let t = 0;
  const built = cues.map((cue) => {
    const box = el('div', `xcap xcap-${id}`, wrap);
    box.style.fontFamily = V.family;
    box.style.fontWeight = String(V.weight);
    box.style.fontSize = px(V.size);
    box.style.letterSpacing = px(V.tracking);
    box.style.gap = px(id === 'tarja' ? 0 : id === 'destaque' ? 16 : 18);
    let rows = [cue];
    if (V.lines === 2 && cue.length > 1 && wOf(cue) > V.maxW) {
      let best = 1, bestScore = Infinity;
      for (let i = 1; i < cue.length; i++) {
        const score = Math.abs(wOf(cue.slice(0, i)) - wOf(cue.slice(i))) + (ORPHAN_PT.test(cue[i - 1]) ? 200 : 0);
        if (score < bestScore) { bestScore = score; best = i; }
      }
      rows = [cue.slice(0, best), cue.slice(best)];
    }
    if (id === 'tarja') {
      box.style.borderLeftWidth = px(12);
      box.style.padding = `${px(20)} ${px(36)} ${px(22)} ${px(30)}`;
    }
    // editorial: the longest content word of the cue is the one set apart
    let key = -1, len = 5;
    if (id === 'editorial') cue.forEach((w, i) => { if (w.length > len) { len = w.length; key = i; } });
    const spans = [];
    for (const row of rows) {
      const parent = id === 'tarja' ? el('div', '', box) : box;
      for (const w of row) {
        const sp = el('span', '', parent);
        sp.textContent = id === 'tarja' ? `${w} ` : w;
        if (id === 'destaque') {
          sp.style.webkitTextStroke = `${px(12)} #000`;
          sp.style.borderRadius = px(12);
          sp.style.padding = `0 ${px(16)} ${px(2)}`;
        }
        if (spans.length === key) { sp.className = 'key'; sp.style.fontSize = px(Math.round(V.size * 1.2)); }
        spans.push(sp);
      }
    }
    const start = t;
    t = start + cue.length * STEP + HOLD;
    return {box, spans, start, end: t};
  });
  const cycle = t;

  return (now) => {
    const p = now % cycle;
    for (const L of built) {
      const on = p >= L.start && p < L.end;
      L.box.style.display = on ? '' : 'none';
      if (!on) continue;
      const active = Math.min(L.spans.length - 1, Math.floor((p - L.start) / STEP));
      L.spans.forEach((sp, j) => {
        if (id === 'minimal') {
          const e = clamp01((p - (L.start + j * STEP)) / FADE);
          sp.style.opacity = e;
          sp.style.translate = `0px ${((1 - e) * 12 * s).toFixed(2)}px`;
        } else if (id !== 'editorial') {
          sp.classList.toggle('on', j === active);
        }
      });
    }
  };
}

/* ---------- "Personalizada": the caption style that is ALL data --------------
 * The six styles above are their own tuning. This one is the opposite — font,
 * size, position, colours, outline, box and effects are picks the user makes
 * here, watching them land on their own footage. Everything below mirrors
 * CustomCaptions.tsx in the template (FONTS, DEFAULTS, the line rule, the 2×
 * stroke copy, the pop curve), authored at 1080 wide and scaled by the box.
 * Change one side, change the other.
 */
const CUSTOM_FONTS = {
  poppins: {name: 'Poppins', css: "'Poppins',sans-serif", weight: 900},
  montserrat: {name: 'Montserrat', css: "'Montserrat',sans-serif", weight: 900},
  inter: {name: 'Inter', css: "'Inter',sans-serif", weight: 800},
  lato: {name: 'Lato', css: "'Lato',sans-serif", weight: 900},
  bebas: {name: 'Bebas Neue', css: "'Bebas Neue',sans-serif", weight: 400},
  anton: {name: 'Anton', css: "'Anton',sans-serif", weight: 400},
  oswald: {name: 'Oswald', css: "'Oswald',sans-serif", weight: 700},
  baskerville: {name: 'Libre Baskerville', css: "'Libre Baskerville',serif", weight: 700},
  playfair: {name: 'Playfair Display', css: "'Playfair Display',serif", weight: 900},
};
const CUSTOM_DEFAULT = {
  font: 'poppins', size: 76, posY: 0.74, maxWords: 3,
  color: '#ffffff', active: '#ffdd00', stroke: '#000000', strokeW: 8,
  box: false, boxColor: '#000000', boxOpacity: 0.6,
  upper: false, pop: true, shadow: true,
};
// Starting points, not a second catalog: a preset only fills the controls.
const CUSTOM_PRESETS = [
  {name: 'Impacto', cfg: {font: 'anton', size: 92, upper: true, active: '#ffdd00', strokeW: 10}},
  {name: 'Neon', cfg: {font: 'poppins', size: 78, upper: true, active: '#39ff14', strokeW: 8}},
  {name: 'Limpo', cfg: {font: 'inter', size: 60, maxWords: 4, active: '#ffffff', strokeW: 0, pop: false}},
  {name: 'Caixa', cfg: {font: 'montserrat', size: 66, maxWords: 4, strokeW: 0, box: true, boxOpacity: 0.65, shadow: false}},
  {name: 'Clássico', cfg: {font: 'baskerville', size: 64, maxWords: 4, active: '#ffdd00', strokeW: 4, pop: false}},
];
const CUSTOM_SAFE_W = 940; // text budget at 1080 wide
const CUSTOM_LINGER_MS = 600;
const CUSTOM_POP_S = 6 / FPS_REF;
const CUSTOM_POP_GAIN = 0.14;

const numIn = (v, lo, hi, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
function normCustom(c) {
  const d = CUSTOM_DEFAULT;
  const o = {...d, ...(c || {})};
  return {
    font: CUSTOM_FONTS[o.font] ? o.font : d.font,
    size: Math.round(numIn(o.size, 40, 130, d.size)),
    posY: +numIn(o.posY, 0.1, 0.92, d.posY).toFixed(2),
    maxWords: Math.round(numIn(o.maxWords, 1, 6, d.maxWords)),
    color: normHex(o.color) || d.color,
    active: normHex(o.active) || d.active,
    stroke: normHex(o.stroke) || d.stroke,
    strokeW: Math.round(numIn(o.strokeW, 0, 16, d.strokeW)),
    box: !!o.box,
    boxColor: normHex(o.boxColor) || d.boxColor,
    boxOpacity: +numIn(o.boxOpacity, 0, 1, d.boxOpacity).toFixed(2),
    upper: !!o.upper,
    pop: !!o.pop,
    shadow: !!o.shadow,
  };
}
const hexRgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// Any control change bumps this; the renderers rebuild their line when it moves.
let customRev = 0;
const CUSTOM_DEMO_WORDS = CAP_TEXT.split(' ').map((t, i) => ({text: t, startMs: i * 340, endMs: i * 340 + 300}));
const capClean = (t) => t.replace(/[.,!?…]+$/, '');

// The karaoke rule: a line ends at maxWords or at punctuation.
function customLines(words, maxWords) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= maxWords || /[.,!?…]$/.test(w.text)) { lines.push(cur); cur = []; }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/* One renderer for both places the style shows: the option card (demo sentence,
 * centred) and the stage (the user's video + their real words, at posY).
 *   opt.words()  real word list, or empty → the demo sentence on a loop
 *   opt.time()   seconds on the cut timeline (the stage video's clock)
 *   opt.placed   honour posY instead of centring
 */
function buildCustomRenderer(host, opt = {}) {
  const old = host.querySelector(':scope > .cc-layer');
  if (old) old.remove();
  const layer = el('div', 'cc-layer', host);
  let linesKey = '', lines = [], key = '', row = null, fills = [], cells = [];

  return (now) => {
    const cfg = S.style.captionsCustom;
    const real = opt.words ? opt.words() : null;
    const demo = !(real && real.length);
    const words = demo ? CUSTOM_DEMO_WORDS : real;
    const lk = `${demo}|${cfg.maxWords}|${words.length}|${words[0].startMs}`;
    if (lk !== linesKey) { lines = customLines(words, cfg.maxWords); linesKey = lk; key = ''; }

    const ms = (demo || !opt.time
      ? now % (words[words.length - 1].endMs / 1000 + 0.9)
      : opt.time()) * 1000;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) if (ms >= lines[i][0].startMs) idx = i;

    const W = host.clientWidth;
    const k = `${idx}|${customRev}|${W}`;
    if (k !== key) {
      key = k;
      layer.innerHTML = '';
      row = null; fills = []; cells = [];
      if (idx >= 0 && W > 0) {
        const s = W / 1080;
        const F = CUSTOM_FONTS[cfg.font];
        const size = cfg.size * s;
        const tracking = -0.01 * size;
        const show = (t) => (cfg.upper ? capClean(t).toUpperCase() : capClean(t));
        layer.classList.toggle('placed', !!opt.placed);
        layer.style.top = opt.placed ? `${cfg.posY * 100}%` : '';
        row = el('div', 'cc-row', layer);
        const widest = Math.max(...lines[idx].map((w) => measureType(show(w.text), size, F.weight, F.css, tracking)));
        const st = row.style;
        st.maxWidth = `${CUSTOM_SAFE_W * s}px`;
        st.fontFamily = F.css;
        st.fontWeight = String(F.weight);
        st.fontSize = `${size}px`;
        st.letterSpacing = `${tracking}px`;
        st.scale = String(Math.min(1, (CUSTOM_SAFE_W * s) / Math.max(1, widest)));
        if (cfg.box) {
          st.padding = '0.16em 0.42em';
          st.borderRadius = '0.22em';
          st.background = hexRgba(cfg.boxColor, cfg.boxOpacity);
        }
        if (cfg.shadow) st.filter = `drop-shadow(0 ${4 * s}px ${14 * s}px rgba(0,0,0,.55))`;
        for (const w of lines[idx]) {
          const cell = el('span', 'cc-word', row);
          if (cfg.strokeW > 0) {
            const back = el('span', 'cc-stroke', cell);
            back.textContent = show(w.text);
            back.style.color = cfg.stroke;
            back.style.webkitTextStroke = `${cfg.strokeW * s * 2}px ${cfg.stroke}`;
          }
          const fill = el('span', 'cc-fill', cell);
          fill.textContent = show(w.text);
          cells.push(cell);
          fills.push(fill);
        }
      }
    }
    if (!row) return;
    const line = lines[idx];
    row.style.visibility = ms > line[line.length - 1].endMs + CUSTOM_LINGER_MS ? 'hidden' : '';
    let act = 0;
    line.forEach((w, i) => { if (ms >= w.startMs) act = i; });
    line.forEach((w, i) => {
      const on = i === act;
      fills[i].style.color = on ? cfg.active : cfg.color;
      const p = easeOutCubic(clamp01((ms - w.startMs) / 1000 / CUSTOM_POP_S));
      cells[i].style.scale = cfg.pop && on ? String(1 + CUSTOM_POP_GAIN * (1 - p)) : '';
    });
  };
}

/* ---- the adjust panel: the user's own video on the left, the knobs on the right.
 * Built ONCE and then only synced — rebuilding it on every renderSetup would
 * restart the video and drop the slider the user is still dragging. */
const CC_GROUPS = [
  {title: 'Texto', items: [
    {k: 'font', type: 'select', label: 'Fonte'},
    {k: 'size', type: 'range', label: 'Tamanho', min: 40, max: 130, step: 1},
    {k: 'posY', type: 'range', label: 'Posição vertical', min: 10, max: 92, step: 1, pct: true},
    {k: 'maxWords', type: 'range', label: 'Palavras por vez', min: 1, max: 6, step: 1},
  ]},
  {title: 'Cores', items: [
    {k: 'color', type: 'color', label: 'Texto'},
    {k: 'active', type: 'color', label: 'Palavra ativa'},
    {k: 'stroke', type: 'color', label: 'Contorno'},
    {k: 'strokeW', type: 'range', label: 'Espessura do contorno', min: 0, max: 16, step: 1},
  ]},
  {title: 'Caixa de fundo', items: [
    {k: 'box', type: 'toggle', label: 'Caixa de fundo'},
    {k: 'boxColor', type: 'color', label: 'Cor da caixa'},
    {k: 'boxOpacity', type: 'range', label: 'Opacidade', min: 0, max: 100, step: 5, pct: true},
  ]},
  {title: 'Efeitos', items: [
    {k: 'upper', type: 'toggle', label: 'MAIÚSCULAS'},
    {k: 'pop', type: 'toggle', label: 'Pop na palavra'},
    {k: 'shadow', type: 'toggle', label: 'Sombra'},
  ]},
];
let ccInputs = {}; // key → {input, out, item}
let ccBuilt = false;
let userPresets = []; // [{name, cfg}] — kept by the server, shared by every project

async function loadUserPresets() {
  try {
    const d = await (await fetch('/api/presets')).json();
    userPresets = Array.isArray(d.presets) ? d.presets : [];
  } catch (e) { userPresets = []; }
  if (ccBuilt) renderPresetRow();
}
async function saveUserPresets() {
  try {
    await fetch('/api/presets', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({presets: userPresets}),
    });
  } catch (e) { toast('Não consegui gravar o preset — o servidor está de pé?', 4000); }
}

function setCustom(patch) {
  S.style.captionsCustom = normCustom({...S.style.captionsCustom, ...patch});
  customRev++;
}

function renderPresetRow() {
  const host = $('ccPresets');
  host.innerHTML = '';
  const chip = (p, mine, i) => {
    const b = el('button', `cc-chip${mine ? ' mine' : ''}`, host);
    b.type = 'button';
    el('span', '', b).textContent = p.name;
    b.addEventListener('click', () => {
      // a preset is a full look: start from the defaults, not from the current mix
      S.style.captionsCustom = normCustom(p.cfg);
      customRev++;
      syncCustomControls();
    });
    if (mine) {
      const x = el('span', 'cc-chip-x', b);
      x.textContent = '×';
      x.title = 'Apagar este preset';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        userPresets.splice(i, 1);
        saveUserPresets();
        renderPresetRow();
      });
    }
  };
  CUSTOM_PRESETS.forEach((p) => chip(p, false));
  userPresets.forEach((p, i) => chip(p, true, i));
}

function ensureCustomPanel() {
  if (ccBuilt) return;
  ccBuilt = true;
  const host = $('ccControls');
  for (const g of CC_GROUPS) {
    const box = el('div', 'cc-group', host);
    el('div', 'cc-group-title', box).textContent = g.title;
    const body = el('div', 'cc-group-body', box);
    for (const it of g.items) {
      const rowEl = el('label', `cc-ctl ${it.type}`, body);
      el('span', 'cc-label', rowEl).textContent = it.label;
      let input, out = null;
      if (it.type === 'select') {
        input = el('select', '', rowEl);
        for (const [id, f] of Object.entries(CUSTOM_FONTS)) {
          const o = el('option', '', input);
          o.value = id;
          o.textContent = f.name;
          o.style.fontFamily = f.css;
        }
      } else {
        input = el('input', '', rowEl);
        input.type = it.type === 'toggle' ? 'checkbox' : it.type;
        if (it.type === 'range') {
          input.min = it.min; input.max = it.max; input.step = it.step;
          out = el('span', 'cc-out', rowEl);
        }
        if (it.type === 'toggle') el('span', 'cc-switch', rowEl);
      }
      const read = () => {
        if (it.type === 'toggle') return input.checked;
        if (it.type === 'range') return it.pct ? input.value / 100 : +input.value;
        return input.value;
      };
      input.addEventListener(it.type === 'range' || it.type === 'color' ? 'input' : 'change', () => {
        setCustom({[it.k]: read()});
        syncCustomControls(it.k);
        updateSummary();
      });
      ccInputs[it.k] = {input, out, item: it};
    }
  }
  $('ccPresetSave').addEventListener('click', () => {
    const name = $('ccPresetName').value.trim();
    if (!name) { $('ccPresetName').focus(); return; }
    const at = userPresets.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    const entry = {name, cfg: {...S.style.captionsCustom}};
    if (at >= 0) userPresets[at] = entry; else userPresets.push(entry);
    $('ccPresetName').value = '';
    saveUserPresets();
    renderPresetRow();
    toast(`Preset “${name}” salvo — fica disponível em todos os projetos`, 3000);
  });
  $('ccPresetName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('ccPresetSave').click(); }
    e.stopPropagation(); // typing a name must not trigger the timeline shortcuts
  });
  const sv = $('ccVideo');
  $('ccStage').addEventListener('click', (e) => {
    if (e.target.closest('#ccSound')) return;
    if (sv.paused) { delete sv.dataset.userPaused; sv.play().catch(() => {}); }
    else { sv.dataset.userPaused = '1'; sv.pause(); }
  });
  $('ccSound').addEventListener('click', () => {
    sv.muted = !sv.muted;
    $('ccSound').textContent = sv.muted ? 'som desligado' : 'som ligado';
  });
  // The stage says when it is stopped: a browser may refuse to start a video
  // nobody clicked, and a frozen frame with no caption reads as "broken".
  const syncPaused = () => $('ccStage').classList.toggle('paused', sv.paused);
  sv.addEventListener('play', syncPaused);
  sv.addEventListener('pause', syncPaused);
  syncPaused();
  // play() right after assigning src can be dropped while the element is still
  // loading — ask again once there is something to play
  sv.addEventListener('canplay', () => {
    if (sv.paused && !sv.dataset.userPaused && !$('customPanel').classList.contains('hidden')) {
      sv.play().catch(() => {});
    }
  });
  sv.addEventListener('loadedmetadata', () => {
    if (sv.videoWidth && sv.videoHeight) {
      $('ccStage').style.aspectRatio = `${sv.videoWidth} / ${sv.videoHeight}`;
      customRev++;
    }
  });
  renderPresetRow();
}

// Writes the config back into the controls. `skip` is the control the user is
// holding — re-setting its value mid-drag would fight the pointer.
function syncCustomControls(skip) {
  const cfg = S.style.captionsCustom;
  for (const [k, c] of Object.entries(ccInputs)) {
    const it = c.item;
    const v = cfg[k];
    if (k !== skip) {
      if (it.type === 'toggle') c.input.checked = !!v;
      else if (it.type === 'range') c.input.value = it.pct ? Math.round(v * 100) : v;
      else c.input.value = v;
    }
    if (c.out) c.out.textContent = it.pct ? `${Math.round(v * 100)}%` : String(v);
    if (it.type === 'color') c.input.closest('.cc-ctl').style.setProperty('--cc-fill', v);
  }
  // the box colour and opacity mean nothing while the box is off
  for (const k of ['boxColor', 'boxOpacity']) {
    ccInputs[k].input.closest('.cc-ctl').classList.toggle('off', !cfg.box);
  }
}

/* ---- the six FIXED styles get three nudges of their own ----
 * Size, height and (where the style has ONE text colour) colour. They are applied
 * to the style as a whole — a wrapper around the real component in the render,
 * a transform on the demo band here — so the look itself stays what it is. Font
 * is deliberately not on the list: in Empilhado and Disperso the mix of faces IS
 * the style. Mirrors CAPTION_ORIGIN_Y / CaptionAdjust in Main.tsx.
 */
const ADJ_ORIGIN = {karaoke: 0.76, simples: 0.76, serifada: 0.76, classica: 0.75, stacked: 0.656, scatter: 0.72, minimal: 0.76, destaque: 0.76, tarja: 0.76, editorial: 0.76};
const ADJ_COLOR = {karaoke: '#ffffff', simples: '#f4f1e9', serifada: '#f4f1e9', classica: '#f4f1e9', minimal: '#ffffff'};
function normAdjust(a) {
  const o = a || {};
  return {
    scale: +numIn(o.scale, 0.6, 1.4, 1).toFixed(2),
    offsetY: +numIn(o.offsetY, -0.5, 0.2, 0).toFixed(3),
    color: normHex(o.color) || '',
  };
}
// what actually ships: nothing when untouched, and no colour for a style that
// would not paint it
function adjustPayload() {
  const id = S.style.captions;
  if (id === 'custom') return undefined;
  const A = S.style.captionsAdjust;
  const out = {};
  if (A.scale !== 1) out.scale = A.scale;
  if (A.offsetY !== 0) out.offsetY = A.offsetY;
  if (A.color && ADJ_COLOR[id] && A.color !== ADJ_COLOR[id]) out.color = A.color;
  return Object.keys(out).length ? out : undefined;
}
let adjInputs = null;

function ensureAdjustControls() {
  if (adjInputs) return;
  const box = el('div', 'cc-group', $('ccAdjust'));
  el('div', 'cc-group-title', box).textContent = 'Ajustes deste estilo';
  const body = el('div', 'cc-group-body', box);
  const mk = (cls, label, type) => {
    const rowEl = el('label', `cc-ctl ${cls}`, body);
    el('span', 'cc-label', rowEl).textContent = label;
    const input = el('input', '', rowEl);
    input.type = type;
    return {rowEl, input, out: type === 'range' ? el('span', 'cc-out', rowEl) : null};
  };
  const size = mk('range', 'Tamanho', 'range');
  size.input.min = 60; size.input.max = 140; size.input.step = 1;
  const pos = mk('range', 'Posição vertical', 'range');
  pos.input.min = 25; pos.input.max = 92; pos.input.step = 1;
  const color = mk('color', 'Cor do texto', 'color');
  const reset = el('button', 'btn ghost small cc-reset', body);
  reset.type = 'button';
  reset.textContent = 'Voltar ao padrão do estilo';
  adjInputs = {size, pos, color};

  const set = (patch) => {
    S.style.captionsAdjust = normAdjust({...S.style.captionsAdjust, ...patch});
    syncAdjustControls();
    applyAdjust();
  };
  size.input.addEventListener('input', () => set({scale: size.input.value / 100}));
  // the slider speaks in "where on the frame"; the data is an offset from the
  // style's own resting height
  pos.input.addEventListener('input', () =>
    set({offsetY: pos.input.value / 100 - (ADJ_ORIGIN[S.style.captions] || 0.76)}));
  color.input.addEventListener('input', () => set({color: color.input.value}));
  reset.addEventListener('click', () => set({scale: 1, offsetY: 0, color: ''}));
}

function syncAdjustControls() {
  if (!adjInputs) return;
  const id = S.style.captions;
  const A = S.style.captionsAdjust;
  const {size, pos, color} = adjInputs;
  size.input.value = Math.round(A.scale * 100);
  size.out.textContent = `${Math.round(A.scale * 100)}%`;
  const at = Math.round(((ADJ_ORIGIN[id] || 0.76) + A.offsetY) * 100);
  pos.input.value = at;
  pos.out.textContent = `${at}%`;
  const paints = !!ADJ_COLOR[id];
  color.rowEl.classList.toggle('off', !paints);
  const shown = A.color || ADJ_COLOR[id] || '#ffffff';
  color.input.value = shown;
  color.rowEl.style.setProperty('--cc-fill', shown);
}

// Live: only the band's transform and colour move, the demo is never rebuilt.
function applyAdjust() {
  const stage = $('ccStage');
  const band = stage.querySelector(':scope > .cc-band');
  if (!band) return;
  const A = S.style.captionsAdjust;
  band.style.transform = `translateY(${A.offsetY * stage.clientHeight}px) scale(${A.scale})`;
  const id = S.style.captions;
  if (A.color && ADJ_COLOR[id]) band.style.setProperty('--cap-color', A.color);
  else band.style.removeProperty('--cap-color');
}

// The real demo of a fixed style, parked on the stage at the height the render
// puts it — the same builders the option cards use, scaled by the stage width.
function buildFixedStage(stage, id) {
  const o = STYLE_CATALOG.captions.find((c) => c.id === id);
  if (!o) return null;
  const band = el('div', 'cc-band', stage);
  band.style.top = `${((ADJ_ORIGIN[id] || 0.76) - 0.15) * 100}%`;
  const step = o.demo ? CAP_BUILDERS[o.demo](band) : buildStaticDemo(band, o.stat);
  applyAdjust();
  return step;
}

// Shows the adjust panel for whatever caption style is picked and returns the
// stage's renderer (or null). Personalizada gets the full set of knobs and the
// user's real words; a fixed style gets its three nudges and its own demo.
function renderCustomPanel(show) {
  const panelEl = $('customPanel');
  panelEl.classList.toggle('hidden', !show);
  const sv = $('ccVideo');
  if (!show) {
    if (ccBuilt && !sv.paused) sv.pause();
    return null;
  }
  ensureCustomPanel();
  ensureAdjustControls();
  const custom = S.style.captions === 'custom';
  $('ccPresetsWrap').classList.toggle('hidden', !custom);
  $('ccControls').classList.toggle('hidden', !custom);
  $('ccAdjust').classList.toggle('hidden', custom);

  const rel = S.state.video || 'cut.mp4';
  const src = S.videoDuration > 0 ? `/media/${rel}?v=${(S.mtimes && S.mtimes.video) || 0}` : '';
  if (sv.dataset.src !== src) {
    sv.dataset.src = src;
    if (src) sv.src = src; else sv.removeAttribute('src');
  }
  if (src && sv.paused && !sv.dataset.userPaused) sv.play().catch(() => {});

  const stage = $('ccStage');
  stage.querySelectorAll(':scope > .cc-layer, :scope > .cc-band').forEach((n) => n.remove());
  if (custom) {
    syncCustomControls();
    $('ccStageNote').textContent = S.capWords.length
      ? 'seu vídeo, com as suas palavras'
      : 'texto de exemplo — as palavras reais entram quando a Fase 2 transcrever o corte';
    return buildCustomRenderer(stage, {
      words: () => S.capWords,
      time: () => sv.currentTime,
      placed: true,
    });
  }
  syncAdjustControls();
  $('ccStageNote').textContent = 'seu vídeo, com um texto de exemplo neste estilo';
  return buildFixedStage(stage, S.style.captions);
}

const LABEL_W = 48; // .track-label width (content x offset of lanes)
const MIN_SEG = 0.2; // s
const THUMB_EVERY = 2.0;

// ---------- state ----------
let S = {
  state: {}, // state.json
  rendered: [], // ranges as rendered (from edl.json) — the video's truth
  draft: [], // user-editable copy [{source,start,end,beat,removed,orig:{start,end}}]
  videoDuration: 0,
  fps: 24,
  captions: [], // grouped caption lines [{text,start,end}] (rendered space)
  capWords: [], // raw word-level captions — feeds the Personalizada stage
  editData: null, // edit-data.json content (phase 2)
  insertsDraft: [], // editable inserts [{kind,label,start,end,ref,orig}]
  wave: null,
  thumbCount: 0,
  tab: 1,
  pps: 10, // px per second (zoom)
  minPps: 4,
  selected: -1, // selected clip index (draft)
  lastSig: '', // change detection
  savedPending: false,
  notes: [], // correction markers [{id,start,end,text}] — draft-timeline seconds
  pendingIn: null, // an IN is open, waiting for its OUT
  editingNote: null, // id of the note the editor is bound to
  style: null, // current picks {edit, captions, elements:{…}, note}
  jcut: null, // jcut_timeline from edl.json — real output positions per take
  // A1/A2 live folded inside the audio track. They answer "where is the J-cut",
  // which is a question you ask once — so the default is closed, and the choice
  // is remembered rather than re-made every reload.
  jcutOpen: localStorage.getItem('edvid.jcutOpen') === '1',
};

function defaultStyle() {
  const elements = {};
  for (const e of STYLE_CATALOG.elements) elements[e.id] = !!e.def;
  return {
    edit: STYLE_CATALOG.edits[0].id,
    headline: STYLE_CATALOG.headlines[0].id,
    captions: STYLE_CATALOG.captions[0].id,
    accent: ACCENT_DEFAULT,
    captionsCustom: normCustom(null),
    captionsAdjust: normAdjust(null),
    elements,
    note: '',
  };
}

const fmt = (t) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};
const el = (tag, cls, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
};

// ---------- draft layout (output-timeline positions) ----------
/* Per-take J-cut geometry, in seconds. `lead` is how far the take's sound runs
 * ahead of its picture; `tail` is what was trimmed off its end. Both are fixed
 * frame counts, so they survive the user trimming a take in the UI. */
function jcutGeom(i) {
  const j = S.jcut && S.jcut[i];
  if (!j) return { lead: 0, tail: 0 };
  return {
    lead: Math.max(0, (j.video_start_in_output || 0) - (j.audio_start_in_output || 0)),
    tail: (j.tail_trim_frames || 0) / (S.fps || 30),
  };
}

/* The draft timeline has to model the J-cut, not just sum the ranges: a take's
 * picture is shorter than its range by the lead it gives up plus the tail it had
 * trimmed. Summing raw ranges made the ruler read 8.07s over a 7.60s render, and
 * every clip after the first sat late by the accumulated lead. Each item also
 * carries its AUDIO placement (aout/adur), which is what the A1/A2 lanes draw —
 * derived here so the lanes follow the user's trims instead of going stale. */
function draftLayout() {
  let t = 0;
  let at = 0;
  return S.draft.map((r, i) => {
    if (r.removed) return { ...r, out: t, dur: 0, aout: at, adur: 0 };
    const g = jcutGeom(i);
    const span = r.end - r.start;
    const adur = Math.max(0, span - g.tail);
    const dur = Math.max(0, adur - g.lead);
    const item = { ...r, out: t, dur, aout: Math.max(0, at - g.lead), adur, lead: g.lead };
    t += dur;
    at = item.aout + adur;
    return item;
  });
}
function renderedLayout() {
  // Under a J-cut the rendered positions come from render.py, not from summing
  // the ranges — the takes overlap in sound and the picture of each one starts
  // a few frames in. Summing here would place every clip after the first too late.
  if (S.jcut && S.jcut.length === S.rendered.length) {
    return S.rendered.map((r, i) => ({
      ...r,
      out: S.jcut[i].video_start_in_output,
      dur: S.jcut[i].video_duration,
    }));
  }
  let t = 0;
  return S.rendered.map((r) => {
    const dur = r.end - r.start;
    const item = { ...r, out: t, dur };
    t += dur;
    return item;
  });
}
const draftTotal = () => draftLayout().reduce((a, r) => a + r.dur, 0);

// draft time → rendered time (for scrubbing the old render while editing)
function draftToRendered(t) {
  const dl = draftLayout();
  const rl = renderedLayout();
  for (let i = dl.length - 1; i >= 0; i--) {
    const d = dl[i];
    if (d.removed || t < d.out) continue;
    const off = Math.min(t - d.out, (rl[i]?.dur ?? d.dur) - 0.02);
    return (rl[i]?.out ?? d.out) + Math.max(0, off);
  }
  return Math.min(t, S.videoDuration);
}
// rendered time → draft time (needle position during playback)
function renderedToDraft(t) {
  const dl = draftLayout();
  const rl = renderedLayout();
  for (let i = rl.length - 1; i >= 0; i--) {
    const r = rl[i];
    if (t < r.out) continue;
    if (dl[i]?.removed) return dl[i].out; // playing removed material → park at its slot
    const off = Math.min(t - r.out, dl[i]?.dur ?? r.dur);
    return (dl[i]?.out ?? r.out) + off;
  }
  return t;
}

// ---------- dirty tracking ----------
function edlDirty() {
  return S.draft.some((r) => r.removed || r.start !== r.orig.start || r.end !== r.orig.end);
}
function insertsDirty() {
  return S.insertsDraft.some((c) => c.start !== c.orig.start || c.end !== c.orig.end);
}
function dirtyCount() {
  let n = S.draft.filter((r) => r.removed || r.start !== r.orig.start || r.end !== r.orig.end).length;
  n += S.insertsDraft.filter((c) => c.start !== c.orig.start || c.end !== c.orig.end).length;
  n += S.notes.length; // each correction marker is an unsaved adjustment too
  return n;
}
function refreshHeader() {
  const n = dirtyCount();
  $('dirtyPill').classList.toggle('hidden', n === 0);
  $('dirtyCount').textContent = n;
  $('btnSave').classList.toggle('hidden', n === 0);
  $('btnDiscard').classList.toggle('hidden', n === 0);
  $('savedPill').classList.toggle('hidden', !(S.savedPending && n === 0));
}

// ---------- data loading ----------
async function poll() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    const sig = JSON.stringify([data.state, data.edl, data.mtimes, data.videoDuration]);
    if (sig !== S.lastSig) {
      const hadEdits = dirtyCount() > 0;
      if (!hadEdits) {
        S.lastSig = sig;
        await applyState(data);
      } else {
        toast('Novo estado disponível — salve ou descarte seus ajustes para atualizar', 4000);
      }
    }
  } catch (e) { /* server restarting; keep polling */ }
  setTimeout(poll, 2000);
}

async function applyState(data) {
  S.state = data.state || {};
  S.mtimes = data.mtimes || {};
  S.videoDuration = data.videoDuration || 0;
  S.fps = S.state.fps || 24;
  S.savedPending = !!data.hasPendingEdits;

  $('projectName').textContent = S.state.project || 'CRVID';
  $('stateMessage').textContent = S.state.message || '';

  const ranges = (data.edl && data.edl.ranges) || [];
  // J-cut timeline, written by render.py. Under a J-cut the picture of every take
  // after the first starts a few frames into itself, so the rendered clip is
  // SHORTER than end-start and the takes do not simply abut. Without this the
  // filmstrip and the needle drift a little further at each junction.
  S.jcut = (data.edl && data.edl.jcut_timeline) || null;
  S.rendered = ranges.map((r) => ({ source: r.source, start: +r.start, end: +r.end, beat: r.beat || '' }));
  S.draft = S.rendered.map((r) => ({ ...r, removed: false, orig: { start: r.start, end: r.end } }));
  S.selected = -1;

  // style picks: the skill's copy wins, so applying a change (or reopening the
  // session) shows what is actually rendered — not a stale local selection
  S.style = { ...defaultStyle(), ...(S.state.style || {}) };
  S.style.elements = { ...defaultStyle().elements, ...((S.state.style || {}).elements || {}) };
  S.style.captionsCustom = normCustom((S.state.style || {}).captionsCustom);
  S.style.captionsAdjust = normAdjust((S.state.style || {}).captionsAdjust);
  customRev++;
  $('setupNote').value = S.style.note || '';
  // the skill opened the gate → land the user on the Estilo tab
  if (S.state.awaitingStyle) S.tab = 'style';

  const hasVideo = S.videoDuration > 0;
  $('playerWrap').classList.toggle('hidden', !hasVideo);
  $('editorCol').classList.toggle('hidden', !hasVideo);

  if (hasVideo) {
    updateVideoSrc();
    loadWave();
    loadThumbsMeta();
  }

  // phase 2 data
  const tab2 = document.querySelector('[data-tab="2"]');
  tab2.disabled = (S.state.phase || 1) < 2;
  // Estilo opens when the catalog applies to this job: the skill asked for a
  // pick, or one is already recorded. Before that there is nothing to choose.
  const tabS = document.querySelector('[data-tab="style"]');
  tabS.disabled = !S.state.awaitingStyle && !S.state.style;
  if (tabS.disabled && S.tab === 'style') S.tab = 1;
  document.querySelectorAll('.tab').forEach((x) => {
    x.classList.toggle('active', String(x.dataset.tab) === String(S.tab));
  });
  S.captions = [];
  S.editData = null;
  // Word-level captions for the Personalizada stage. Unlike the caption TRACK
  // this is wanted before Fase 2 exists — the gate is where the look is picked —
  // so it also takes captions_preview.json, written ahead of the gate.
  S.capWords = [];
  for (const rel of [S.state.captions, 'remotion/public/captions.json', 'captions_preview.json']) {
    if (!rel) continue;
    try {
      const r = await fetch(`/media/${rel}?v=${Date.now()}`);
      const j = r.ok ? await r.json() : null;
      if (Array.isArray(j) && j.length) { S.capWords = j; break; }
    } catch (e) { /* absent yet */ }
  }
  S.insertsDraft = [];
  if ((S.state.phase || 1) >= 2) {
    if (S.state.captions) {
      try {
        const caps = await (await fetch(`/media/${S.state.captions}?v=${Date.now()}`)).json();
        S.captions = groupCaptions(caps);
      } catch (e) { /* absent yet */ }
    }
    if (S.state.editData) {
      try {
        S.editData = await (await fetch(`/media/${S.state.editData}?v=${Date.now()}`)).json();
        buildInsertsDraft();
      } catch (e) { /* absent yet */ }
    }
  }

  fitZoom();
  renderAll();
  renderSetup();
  refreshHeader();
}

// Fase 1 plays the clean cut; Fase 2 plays the Phase-2 render (state.finalVideo)
// when it exists, so captions/inserts are visible. Keeps the playback position.
function updateVideoSrc() {
  const rel = (S.tab === 2 && S.state.finalVideo) ? S.state.finalVideo : (S.state.video || 'cut.mp4');
  const vsrc = `/media/${rel}?v=${(S.mtimes && (S.mtimes.finalVideo || S.mtimes.video)) || 0}`;
  if (video.dataset.src === vsrc) return;
  const t = video.currentTime;
  const wasPlaying = !video.paused && !video.ended;
  video.dataset.src = vsrc;
  video.src = vsrc;
  video.currentTime = t;
  if (wasPlaying) video.play();
}

function groupCaptions(caps) {
  // mirror the template: lines of ≤3 words, break on punctuation
  const lines = [];
  let cur = [];
  for (const w of caps) {
    cur.push(w);
    if (cur.length >= 3 || /[.,!?…]$/.test(w.text)) { lines.push(cur); cur = []; }
  }
  if (cur.length) lines.push(cur);
  return lines.map((line) => ({
    text: line.map((w) => w.text.replace(/[.,!?…]+$/, '')).join(' '),
    start: line[0].startMs / 1000,
    end: line[line.length - 1].endMs / 1000,
  }));
}

function buildInsertsDraft() {
  const d = S.editData;
  const list = [];
  if (d.hook && d.hook.enabled) {
    list.push({ kind: 'hook', label: `HOOK — ${(d.hook.lines || []).join(' / ')}`, start: 0, end: d.hook.endSec || 4 });
  }
  (d.inserts || []).forEach((it, i) => {
    list.push({ kind: 'insert', label: (it.src || '').split('/').pop(), start: +it.start, end: +it.end, ref: i });
  });
  // split-layout images (CustomGraphics reads the same array) — they are images
  // like any other insert, so they belong on the image track, not in code
  (d.splitInserts || []).forEach((it, i) => {
    list.push({
      kind: 'split',
      label: it.label || (it.src || '').split('/').pop(),
      start: +it.start, end: +it.end, ref: i,
    });
  });
  // split-layout VIDEO bands — same seam and geometry as splitInserts, but the
  // band plays a clip (generated b-roll, screen capture). Its own array because
  // the renderer mounts it with a different component; on the timeline it is an
  // image-track element like any other.
  (d.splitVideos || []).forEach((it, i) => {
    list.push({
      kind: 'splitvideo',
      label: it.label || (it.src || '').split('/').pop(),
      start: +it.start, end: +it.end, ref: i,
    });
  });
  (d.behind || []).forEach((b, i) => {
    list.push({ kind: 'behind', label: `BEHIND ${b.kind === 'words' ? (b.words || []).map((w) => w.t).join(' ') : (b.src || '').split('/').pop()}`, start: +b.start, end: +b.start + +b.dur, ref: i });
  });
  // held single words in the caption's own visual language (a keyword the viewer
  // must type, an emphasis beat) — text, so they ride the text track next to the
  // hook rather than the image track
  (d.wordAccents || []).forEach((w, i) => {
    list.push({ kind: 'word', label: w.text, start: +w.start, end: +w.end, ref: i });
  });
  S.insertsDraft = list.map((c) => ({ ...c, orig: { start: c.start, end: c.end } }));
}

async function loadWave() {
  try {
    S.wave = await (await fetch('/gen/waveform.json')).json();
    drawWave();
  } catch (e) { S.wave = null; }
}
async function loadThumbsMeta() {
  try {
    const meta = await (await fetch('/gen/thumbs/meta.json')).json();
    S.thumbCount = meta.count || 0;
    renderClips();
  } catch (e) { S.thumbCount = 0; }
}

// ---------- zoom / layout ----------
function contentWidth() { return LABEL_W + Math.max(draftTotal(), S.videoDuration, 1) * S.pps + 14; }
function fitZoom() {
  const avail = panel.clientWidth - LABEL_W - 40;
  const total = Math.max(draftTotal(), S.videoDuration, 1);
  S.minPps = Math.max(1, avail / total);
  S.pps = S.minPps;
  $('zoom').value = 0;
}
const MAX_PPS = 200;

// Zoom keeping `t` (seconds) parked at `anchorX` (px from the panel's left edge).
function applyZoom(pps, t, anchorX) {
  S.pps = Math.min(MAX_PPS, Math.max(S.minPps, pps));
  const span = Math.log(MAX_PPS / S.minPps);
  $('zoom').value = span > 0 ? Math.round((100 * Math.log(S.pps / S.minPps)) / span) : 0;
  renderAll();
  panel.scrollLeft = Math.max(0, LABEL_W + t * S.pps - anchorX);
  drawRuler();
  drawWave();
  positionNeedle();
}

// Trackpad pinch arrives as a wheel event with ctrlKey set. Anchored on the
// pointer (a direct gesture zooms where the fingers are); the slider stays
// anchored on the needle.
panel.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return; // plain two-finger scrolling stays untouched
  e.preventDefault();
  const pr = panel.getBoundingClientRect();
  const anchorX = e.clientX - pr.left;
  const t = (panel.scrollLeft + anchorX - LABEL_W) / S.pps;
  applyZoom(S.pps * Math.exp(-e.deltaY * 0.01), Math.max(0, t), anchorX);
}, { passive: false });

function setZoom(v) { // slider 0..100 → minPps..200, anchored on the needle
  const t = renderedToDraft(video.currentTime || 0);
  // viewport x of the needle before the zoom; if it is off-screen, pull it to
  // the middle so zooming always lands on the playhead the user is looking at
  const xBefore = LABEL_W + t * S.pps - panel.scrollLeft;
  const visible = xBefore >= LABEL_W && xBefore <= panel.clientWidth;
  const anchor = visible ? xBefore : LABEL_W + (panel.clientWidth - LABEL_W) / 2;
  applyZoom(S.minPps * Math.pow(MAX_PPS / S.minPps, v / 100), t, anchor);
}

// Lanes are clipped at the gutter (and the divider is positioned) by a
// scroll-driven CSS timeline, so both stay pinned to scrollLeft with zero lag.
// All JS has to publish is the scroll RANGE, which only changes on zoom/resize.
function updateScrollRange() {
  const max = Math.max(0, panel.scrollWidth - panel.clientWidth);
  timelineEl.style.setProperty('--max-scroll', `${max}px`);
}

// ---------- rendering ----------
function renderAll() {
  timelineEl.style.width = `${contentWidth()}px`;
  renderClips();
  renderJcutAudio();
  renderChips();
  renderNotes();
  drawRuler();
  drawWave();
  updateScrollRange();
  positionNeedle();
}

// ---------- correction markers ----------
function renderNotes() {
  const lane = $('laneNotes');
  lane.innerHTML = '';
  for (const n of S.notes) {
    const chip = el('div', 'note-chip', lane);
    chip.style.left = `${n.start * S.pps}px`;
    chip.style.width = `${Math.max((n.end - n.start) * S.pps, 10)}px`;
    chip.textContent = n.text || '(sem descrição)';
    chip.title = `${fmt(n.start)} → ${fmt(n.end)}\n${n.text || ''}\n\nclique para editar`;
    chip.dataset.id = n.id;
  }
  if (S.pendingIn != null) {
    const p = el('div', 'note-pending', lane);
    p.style.left = `${S.pendingIn * S.pps}px`;
  }
  const btn = $('btnMark');
  btn.classList.toggle('armed', S.pendingIn != null);
  $('markText').textContent = S.pendingIn != null ? 'OUT' : 'IN';
}

function toggleMark() {
  const t = renderedToDraft(video.currentTime || 0);
  if (S.pendingIn == null) {
    S.pendingIn = t;
    renderNotes();
    toast('IN marcado — leve a agulha ao fim do trecho e marque o OUT', 2600);
    return;
  }
  const start = Math.min(S.pendingIn, t);
  const end = Math.max(S.pendingIn, t);
  if (end - start < 0.05) {
    toast('Trecho curto demais — afaste a agulha do IN', 2200);
    return;
  }
  S.pendingIn = null;
  const note = { id: `n${Date.now()}`, start, end, text: '' };
  S.notes.push(note);
  S.notes.sort((a, b) => a.start - b.start);
  renderNotes();
  openNoteEditor(note.id, true);
}

function openNoteEditor(id, isNew) {
  const n = S.notes.find((x) => x.id === id);
  if (!n) return;
  S.editingNote = id;
  $('noteRange').textContent = `${fmt(n.start)} → ${fmt(n.end)}`;
  $('noteText').value = n.text || '';
  $('noteDelete').classList.toggle('hidden', !!isNew);
  // centred over the timeline (where the user's eyes are), then clamped so a
  // short timeline panel cannot push the editor off-screen
  const ed = $('noteEditor');
  ed.classList.remove('hidden');
  const p = panel.getBoundingClientRect();
  const h = ed.offsetHeight;
  const w = ed.offsetWidth;
  const cy = Math.min(
    Math.max(p.top + p.height / 2, h / 2 + 12),
    window.innerHeight - h / 2 - 12,
  );
  const cx = Math.min(Math.max(p.left + p.width / 2, w / 2 + 12), window.innerWidth - w / 2 - 12);
  ed.style.left = `${cx}px`;
  ed.style.top = `${cy}px`;
  $('noteText').focus();
}

function closeNoteEditor() {
  // a brand-new marker with no text is not worth keeping
  const n = S.notes.find((x) => x.id === S.editingNote);
  if (n && !n.text.trim()) S.notes = S.notes.filter((x) => x.id !== n.id);
  S.editingNote = null;
  $('noteEditor').classList.add('hidden');
  renderNotes();
  refreshHeader();
}

// ---------- style setup ----------
const styleName = (group, id) => (STYLE_CATALOG[group].find((o) => o.id === id) || {}).name || '—';
// the accent is a free colour, not a named entry in a list — it names itself
const accentName = (hex) => String(hex || ACCENT_DEFAULT).toUpperCase();
const normHex = (v) => {
  let s = String(v || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join(''); // #abc → #aabbcc
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : null;
};

/* Which styles actually paint the accent. Kept as data because the honest UI
 * note depends on it: with `karaoke` + `outline` picked, nothing on screen uses
 * the colour, and saying so beats letting the user wonder why the previews did
 * not move. Mirrors the template — update both together. */
const ACCENT_USERS = {headlines: ['realce', 'misto', 'manchete', 'etiqueta', 'impacto'], captions: ['stacked', 'destaque', 'tarja', 'editorial']};
const ACCENT_DEFAULT = '#ff5200';

function applyAccent() {
  $('styleSetup').style.setProperty('--hl-accent', S.style.accent || ACCENT_DEFAULT);
  $('styleSetup').style.setProperty('--hl-ink', inkOn(S.style.accent || ACCENT_DEFAULT));
}

/* One spectral swatch (the OS picker) plus a hex field — no preset row. A grid of
 * canned colours competes with the style cards for attention and still never has
 * the brand colour the user actually wants. */
function renderAccents() {
  const host = $('optAccent');
  host.innerHTML = '';
  const cur = normHex(S.style.accent) || ACCENT_DEFAULT;

  const custom = el('label', 'swatch custom', host);
  custom.title = 'Escolher cor';
  custom.style.setProperty('--swatch-fill', cur);
  const inp = el('input', '', custom);
  inp.type = 'color';
  inp.value = cur;

  const field = el('div', 'hex-field', host);
  el('span', 'hex-hash', field).textContent = '#';
  const hex = el('input', 'hex-input', field);
  hex.type = 'text';
  hex.spellcheck = false;
  hex.maxLength = 7;
  hex.value = cur.slice(1).toUpperCase();
  hex.setAttribute('aria-label', 'Cor de destaque em hexadecimal');

  const commit = (v, {fromHexField} = {}) => {
    const n = normHex(v);
    if (!n) return false;
    S.style.accent = n;
    custom.style.setProperty('--swatch-fill', n);
    inp.value = n;
    if (!fromHexField) hex.value = n.slice(1).toUpperCase();
    applyAccent();   // live — no full rebuild, so dragging the picker stays smooth
    updateAccentNote();
    updateSummary();
    return true;
  };

  inp.addEventListener('input', () => commit(inp.value));
  // typing: accept as soon as it parses, but never fight the user mid-keystroke
  hex.addEventListener('input', () => {
    field.classList.toggle('bad', !normHex(hex.value) && hex.value.trim() !== '');
    commit(hex.value, {fromHexField: true});
  });
  // leaving an unparseable value snaps back rather than silently keeping the old
  // colour behind text that says something else
  hex.addEventListener('blur', () => {
    field.classList.remove('bad');
    hex.value = (normHex(S.style.accent) || ACCENT_DEFAULT).slice(1).toUpperCase();
  });
  hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') hex.blur(); });

  updateAccentNote();
}

const accentUsed = () =>
  ACCENT_USERS.headlines.includes(S.style.headline)
  || ACCENT_USERS.captions.includes(S.style.captions);

function updateAccentNote() {
  const where = [
    ACCENT_USERS.headlines.includes(S.style.headline) && 'na headline',
    ACCENT_USERS.captions.includes(S.style.captions) && 'na legenda',
  ].filter(Boolean);
  $('accentNote').textContent = where.length
    ? `aplicada ${where.join(' e ')}`
    : 'os estilos escolhidos não usam destaque';
}

/* Separate from renderSetup so the live colour drag can refresh it without
 * rebuilding every demo. Skipping it there left the footer naming the previous
 * colour while the previews already showed the new one. */
function updateSummary() {
  const on = STYLE_CATALOG.elements.filter((e) => S.style.elements[e.id]);
  const accentBit = accentUsed() ? ` · destaque ${accentName(S.style.accent)}` : '';
  $('setupSummary').textContent =
    `${styleName('edits', S.style.edit)} · headline ${styleName('headlines', S.style.headline)}` +
    ` · legenda ${styleName('captions', S.style.captions)}${accentBit} · ` +
    (on.length ? on.map((e) => e.name).join(', ') : 'sem elementos extras');
}

// The Estilo tab. It sits BETWEEN the phases and is always reachable once the
// catalog applies to this job: changing the caption style after Fase 2 exists,
// or ticking one more element and re-rendering, is normal editing — not a
// decision the user gets exactly one shot at.
let wasShowing = false; // gate was up on the previous render (for the re-fit)

function renderSetup() {
  const show = S.tab === 'style';
  $('styleSetup').classList.toggle('hidden', !show);
  const hasVideo = S.videoDuration > 0;
  $('stage').classList.toggle('hidden', show || !hasVideo);
  $('emptyState').classList.toggle('hidden', hasVideo || show);

  if (!show) {
    capAnims = []; // stop stepping demos that are not on screen
    renderCustomPanel(false);
    // the timeline was display:none while the tab was up, so its panel had no
    // width to fit against — re-fit once it is back on screen
    if (wasShowing && hasVideo) requestAnimationFrame(() => { fitZoom(); renderAll(); });
    wasShowing = false;
    return;
  }
  if (!wasShowing) $('styleSetup').scrollTop = 0; // open at the top, always
  wasShowing = true;

  $('setupGo').textContent = S.state.awaitingStyle
    ? 'Confirmar e iniciar a Fase 2'
    : 'Salvar e refazer a Fase 2';

  capAnims = [];
  const radios = (host, group, chosen) => {
    const opts = STYLE_CATALOG[group];
    host.innerHTML = '';
    for (const o of opts) {
      const card = el('div', `opt${o.id === chosen ? ' on' : ''}`, host);
      card.dataset.group = group;
      card.dataset.id = o.id;
      // headline previews are two short lines — they do not need the caption
      // box's height, and with four groups on one screen that height is scarce
      const kind = o.mock ? 'frame' : o.hl ? 'cap hlbox' : 'cap';
      const prev = el('div', `opt-preview ${kind}`, card);
      if (o.demo) capAnims.push(CAP_BUILDERS[o.demo](prev));
      else if (o.hl) buildHeadlineDemo(prev, o.hl);
      else if (o.stat) {
        const step = buildStaticDemo(prev, o.stat);
        if (step) capAnims.push(step);
      }
      else if (o.custom) capAnims.push(buildCustomRenderer(prev));
      else prev.innerHTML = o.mock || '';
      // Only the abstract mockups get a title. A card that renders the real
      // caption or the real headline is already labelled — by itself.
      // …and so does the adjustable one: its demo shows the current knobs, not
      // what the card IS.
      if (o.mock || o.custom) el('div', 'opt-name', card).textContent = o.name;
      el('div', 'opt-mark', card);
    }
    // the ghost only earns its space where there is a single option to explain
    if (opts.length < 2) el('div', 'opt ghost', host).textContent = 'mais estilos em breve';
  };
  // set BEFORE the demos are built: buildHeadlineDemo reads the accent through
  // var(), so the variable has to be in place when the previews first paint
  applyAccent();

  radios($('optEdit'), 'edits', S.style.edit);
  radios($('optHeadline'), 'headlines', S.style.headline);
  radios($('optCaptions'), 'captions', S.style.captions);
  const stageStep = renderCustomPanel(true);
  if (stageStep) capAnims.push(stageStep);
  renderAccents();

  const host = $('optElements');
  host.innerHTML = '';
  for (const e of STYLE_CATALOG.elements) {
    const on = !!S.style.elements[e.id];
    const row = el('div', `chk${on ? ' on' : ''}`, host);
    row.dataset.id = e.id;
    el('div', 'chk-box', row);
    el('div', 'chk-ico', row).innerHTML = e.icon || '';
    el('div', 'chk-name', row).textContent = e.name;
  }

  updateSummary();
}

$('styleSetup').addEventListener('click', (e) => {
  // the accent controls manage themselves (live, no rebuild) — keep the card
  // handler off them, or a click in the hex field would count as a style pick
  if (e.target.closest('#optAccent') || e.target.closest('#customPanel')) return;
  const opt = e.target.closest('.opt:not(.ghost)');
  if (opt) {
    const key = {edits: 'edit', headlines: 'headline', captions: 'captions'}[opt.dataset.group];
    S.style[key] = opt.dataset.id;
    renderSetup();
    return;
  }
  const chk = e.target.closest('.chk');
  if (chk) {
    S.style.elements[chk.dataset.id] = !S.style.elements[chk.dataset.id];
    renderSetup();
  }
});

$('setupGo').addEventListener('click', async () => {
  S.style.note = $('setupNote').value.trim();
  const rerender = !S.state.awaitingStyle;
  const payload = {
    // a save with Fase 2 already on disk is a RE-RENDER request, not a first
    // pick — the skill has to know which of the two it is looking at
    type: 'style-setup',
    rerender,
    edit: S.style.edit,
    editName: styleName('edits', S.style.edit),
    headline: S.style.headline,
    headlineName: styleName('headlines', S.style.headline),
    captions: S.style.captions,
    captionsName: styleName('captions', S.style.captions),
    accent: S.style.accent,
    accentName: accentName(S.style.accent),
    // whether the picked styles actually paint it — so the skill does not go
    // hunting for an accent in a look that has none
    accentUsed: accentUsed(),
    // only when Personalizada is the pick — otherwise it is noise the skill
    // would have to know to ignore
    captionsCustom: S.style.captions === 'custom' ? { ...S.style.captionsCustom } : undefined,
    // size / height / colour nudges on a fixed style — absent when untouched
    captionsAdjust: adjustPayload(),
    elements: { ...S.style.elements },
    elementNames: STYLE_CATALOG.elements
      .filter((e) => S.style.elements[e.id])
      .map((e) => e.name),
    note: S.style.note,
  };
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if ((await res.json()).ok) {
    S.savedPending = true;
    renderSetup();
    refreshHeader();
  } else {
    toast('Erro ao enviar — o servidor está de pé?', 4000);
  }
});

function renderClips() {
  laneVideo.innerHTML = '';
  const dl = draftLayout();
  const rl = renderedLayout();
  const editable = S.tab === 1;
  dl.forEach((r, i) => {
    if (r.removed && r.dur === 0) {
      // removed: show a slim ghost at its slot
      const g = el('div', 'clip removed', laneVideo);
      g.style.left = `${r.out * S.pps}px`;
      g.style.width = `${Math.max((r.orig.end - r.orig.start) * S.pps * 0.4, 34)}px`;
      g.dataset.i = i;
      g.title = 'clique e pressione delete para restaurar';
      return;
    }
    const c = el('div', 'clip', laneVideo);
    c.style.left = `${r.out * S.pps}px`;
    c.style.width = `${Math.max(r.dur * S.pps, 8)}px`;
    c.dataset.i = i;
    if (i === S.selected) c.classList.add('selected');
    if (r.start !== r.orig.start || r.end !== r.orig.end) c.classList.add('dirty');

    // filmstrip from the rendered cut
    if (S.thumbCount > 0 && rl[i]) {
      const strip = el('div', 'thumbs', c);
      const first = Math.floor(rl[i].out / THUMB_EVERY);
      const n = Math.ceil(rl[i].dur / THUMB_EVERY) + 1;
      for (let k = 0; k < n; k++) {
        const idx = first + k + 1; // ffmpeg %04d is 1-based
        if (idx > S.thumbCount) break;
        const img = el('img', '', strip);
        img.src = `/gen/thumbs/${String(idx).padStart(4, '0')}.jpg`;
        img.style.width = `${THUMB_EVERY * S.pps}px`;
        img.style.objectFit = 'cover';
      }
    }
    const lab = el('div', 'clip-label', c);
    lab.textContent = `${r.beat || r.source} `;
    const dur = el('div', 'clip-dur', c);
    dur.textContent = `${r.dur.toFixed(2)}s`;

    if (editable) {
      el('div', 'handle l', c).dataset.i = i;
      el('div', 'handle r', c).dataset.i = i;
    }
  });
}

/* J-cut audio lanes.
 * The point is legibility, not decoration: on one lane an overlap is invisible,
 * because two blocks that overlap in time just look like one continuous block.
 * Alternating takes across A1/A2 is what makes the "J" readable — exactly how it
 * reads in Premiere. The overlap itself gets a marker on the incoming block, so
 * the user can see how many frames of voice arrive before the picture.
 */
function renderJcutAudio() {
  const t1 = $('trkAudioA1'), t2 = $('trkAudioA2');
  const l1 = $('laneAudioA1'), l2 = $('laneAudioA2');
  const btn = $('jcutToggle');
  l1.innerHTML = ''; l2.innerHTML = '';

  const has = !!(S.jcut && S.jcut.length && S.tab !== 'style');
  // the caret only appears when there is a J-cut to expand; otherwise the chip
  // stays an ordinary track icon
  btn.classList.toggle('disclose', has);
  btn.disabled = !has;
  btn.setAttribute('aria-expanded', String(has && S.jcutOpen));
  btn.title = !has ? 'Áudio (mix)'
    : S.jcutOpen ? 'Áudio (mix) — recolher as faixas do J-cut (A1/A2)'
                 : 'Áudio (mix) — expandir as faixas do J-cut (A1/A2)';

  const on = has && S.jcutOpen;
  t1.classList.toggle('hidden', !on);
  t2.classList.toggle('hidden', !on);
  if (!on) return;

  // drawn off the DRAFT layout so the blocks move with the user's trims
  draftLayout().forEach((r, i) => {
    if (r.removed && r.adur === 0) return;
    const lane = i % 2 === 0 ? l1 : l2;
    const b = el('div', 'ablock', lane);
    b.style.left = `${r.aout * S.pps}px`;
    b.style.width = `${Math.max(r.adur * S.pps, 6)}px`;
    el('div', 'ablock-label', b).textContent = r.beat || r.source || '';

    // the lead: sound already playing while the previous take is still on screen
    if (r.lead > 1e-6) {
      const ov = el('div', 'ablock-lead', b);
      ov.style.width = `${r.lead * S.pps}px`;
    }
    const tf = (S.jcut[i] || {}).tail_trim_frames || 0;
    let tip = `${r.beat || r.source}\náudio ${r.adur.toFixed(2)}s`;
    if (r.lead > 1e-6) {
      tip += `\nJ-cut: ${Math.round(r.lead * S.fps)}f (${Math.round(r.lead * 1000)}ms) `
           + 'de voz antes da imagem';
    }
    if (tf) tip += `\ncauda aparada ${tf}f`;
    b.title = tip;
  });
}

function renderChips() {
  const phase2 = S.tab === 2;
  $('trkCaptions').classList.toggle('hidden', !phase2);
  insertTracksEl.classList.toggle('hidden', !phase2);
  insertTracksEl.innerHTML = '';
  if (!phase2) return;

  laneCaptions.innerHTML = '';
  for (const c of S.captions) {
    const start = renderedToDraft(c.start);
    const end = renderedToDraft(c.end);
    const chip = el('div', 'chip caption', laneCaptions);
    chip.style.left = `${start * S.pps}px`;
    chip.style.width = `${Math.max((end - start) * S.pps, 6)}px`;
    chip.textContent = c.text;
    chip.title = c.text;
  }

  // TEXT and IMAGE get their own tracks — a headline and a photo are different
  // kinds of edit, and mixing them on one lane hid the images entirely.
  const isText = (c) => c.kind === 'hook' || c.kind === 'word';
  const groups = [
    { icon: 'text', cls: 'teal', items: S.insertsDraft.map((c, i) => ({ c, i })).filter(({ c }) => isText(c)) },
    { icon: 'inserts', cls: 'orange', items: S.insertsDraft.map((c, i) => ({ c, i })).filter(({ c }) => !isText(c)) },
  ];

  for (const g of groups) {
    if (!g.items.length) continue;
    // overlapping elements stack onto extra lanes within the same group
    const order = [...g.items].sort((a, b) => a.c.start - b.c.start || a.c.end - b.c.end);
    const trackEnd = [];
    const assign = new Map();
    for (const { c, i } of order) {
      let t = trackEnd.findIndex((end) => c.start >= end - 1e-6);
      if (t < 0) { t = trackEnd.length; trackEnd.push(0); }
      trackEnd[t] = c.end;
      assign.set(i, t);
    }
    const lanes = [];
    for (let t = 0; t < Math.max(trackEnd.length, 1); t++) {
      const trk = el('div', 'track', insertTracksEl);
      const lab = el('div', 'track-label', trk);
      // only the first lane of a group carries the icon; the rest are continuations
      if (t === 0) el('span', `tl-chip ${g.cls}`, lab).innerHTML = ICON[g.icon];
      lanes.push(el('div', 'lane', trk));
    }
    for (const { c, i } of g.items) {
      const chip = el('div', `chip insert ${isText(c) ? 'hook' : ''}`, lanes[assign.get(i) ?? 0]);
      chip.style.left = `${c.start * S.pps}px`;
      chip.style.width = `${Math.max((c.end - c.start) * S.pps, 10)}px`;
      chip.textContent = c.label;
      chip.title = c.label;
      chip.dataset.i = i;
      if (c.start !== c.orig.start || c.end !== c.orig.end) chip.classList.add('dirty');
      el('div', 'handle l', chip).dataset.i = i;
      el('div', 'handle r', chip).dataset.i = i;
    }
  }

  // soundtrack → its own read-only track, one chip spanning the whole video
  const st = S.editData && S.editData.soundtrack;
  if (st && st.enabled) {
    const trk = el('div', 'track', insertTracksEl);
    el('span', 'tl-chip olive', el('div', 'track-label', trk)).innerHTML = ICON.music;
    const lane = el('div', 'lane', trk);
    const chip = el('div', 'chip music', lane);
    const dur = S.editData.durationSec || S.videoDuration || draftTotal();
    chip.style.left = '0px';
    chip.style.width = `${Math.max(dur * S.pps, 10)}px`;
    const name = (st.file || 'trilha.mp3').split('/').pop();
    const vol = st.volume != null ? `  ·  vol ${st.volume}` : '';
    chip.textContent = `${name}${vol}`;
    chip.title = chip.textContent;
  }
}

// ---------- canvases (viewport-sized, redrawn on scroll) ----------
function canvasSetup(cv, lane) {
  const dpr = window.devicePixelRatio || 1;
  const w = panel.clientWidth;
  const h = lane.clientHeight;
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  cv.style.position = 'absolute';
  // lanes start LABEL_W into the scrolled content — offset the viewport-sized
  // canvas so it covers exactly the visible strip of the lane
  const left = Math.max(0, panel.scrollLeft - LABEL_W);
  cv.style.left = `${left}px`;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, x0: left };
}

function drawRuler() {
  const { ctx, w, h, x0 } = canvasSetup(rulerCv, rulerCv.parentElement);
  const laneX0 = x0; // canvas positioned at scrollLeft within lane coords
  const t0 = laneX0 / S.pps;
  const t1 = (laneX0 + w) / S.pps;
  // tick step: nice value ≥ 60px apart
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  const step = steps.find((s) => s * S.pps >= 56) || 300;
  ctx.font = '600 9.5px Poppins, sans-serif';
  ctx.fillStyle = 'rgba(139,148,163,0.9)';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
    if (t < 0) continue;
    const x = t * S.pps - laneX0;
    ctx.beginPath();
    ctx.moveTo(x, h - 7);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillText(fmt(t), x + 3, h - 9);
    // minor ticks
    const minor = step / 5;
    for (let m = 1; m < 5; m++) {
      const xm = (t + m * minor) * S.pps - laneX0;
      ctx.beginPath();
      ctx.moveTo(xm, h - 3.5);
      ctx.lineTo(xm, h);
      ctx.stroke();
    }
  }
}

function drawWave() {
  if (!S.wave) return;
  const { ctx, w, h, x0 } = canvasSetup(waveCv, laneAudio);
  const mid = h / 2;
  ctx.strokeStyle = 'rgba(47,224,196,0.06)';
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
  ctx.fillStyle = 'rgba(47,224,196,0.75)';
  const pps = S.wave.peaksPerSec;
  for (let px = 0; px < w; px++) {
    const tDraft = (x0 + px) / S.pps;
    if (tDraft > draftTotal()) break;
    const tRend = draftToRendered(tDraft);
    const idx = Math.floor(tRend * pps);
    if (idx < 0 || idx >= S.wave.max.length) continue;
    const hi = (S.wave.max[idx] / 100) * (mid - 2);
    const lo = (S.wave.min[idx] / 100) * (mid - 2);
    ctx.fillRect(px, mid - hi, 1, Math.max(1, hi - lo));
  }
}

// Vertical sources get the split layout (player right, editor left) — stacked,
// a 9:16 clip is tiny above a full-width timeline. Driven off the decoded frame
// size, so it works for cut.mp4 and the Phase-2 render alike.
function applyOrientation() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  const portrait = h > w;
  if (portrait === document.body.classList.contains('portrait')) return;
  document.body.classList.toggle('portrait', portrait);
  // the timeline's width just changed — re-fit after layout settles
  requestAnimationFrame(() => { fitZoom(); renderAll(); });
}
video.addEventListener('loadedmetadata', applyOrientation);

// ---------- needle / playback sync ----------
function positionNeedle() {
  const tDraft = renderedToDraft(video.currentTime || 0);
  const x = LABEL_W + tDraft * S.pps;
  needle.style.left = `${x}px`;
  needle.style.visibility = x < panel.scrollLeft + LABEL_W ? 'hidden' : '';
  $('timeNow').textContent = fmt(tDraft);
  $('timeTotal').textContent = fmt(draftTotal() || S.videoDuration);
}
function rafLoop() {
  if (capAnims.length) {
    const now = performance.now() / 1000;
    for (const step of capAnims) step(now);
  }
  positionNeedle();
  if (!video.paused && !video.ended) {
    // keep needle visible
    const x = LABEL_W + renderedToDraft(video.currentTime) * S.pps;
    const right = panel.scrollLeft + panel.clientWidth;
    if (x > right - 80) panel.scrollLeft = x - panel.clientWidth * 0.25;
  }
  requestAnimationFrame(rafLoop);
}

function seekDraft(tDraft) {
  tDraft = Math.max(0, Math.min(tDraft, draftTotal() || S.videoDuration));
  video.currentTime = draftToRendered(tDraft);
  positionNeedle();
}

// ---------- interactions ----------
let drag = null; // {type:'scrub'|'trim'|'chip-trim'|'chip-move', ...}

panel.addEventListener('pointerdown', (e) => {
  // The gutter is chrome, not timeline. Without this guard a pointerdown on a
  // track icon fell through to the scrub branch below, which both yanked the
  // needle to 0 (the gutter is left of t=0, so it computes a negative time) and
  // called setPointerCapture on the panel — retargeting the following click and
  // swallowing it, so a real click on the A1/A2 disclosure never fired while a
  // programmatic .click() did.
  if (e.target.closest('.track-label') || e.target.closest('button')) return;

  const handle = e.target.closest('.handle');
  const clip = e.target.closest('.clip');
  const chip = e.target.closest('.chip.insert');

  if (handle && clip && S.tab === 1) {
    const i = +handle.dataset.i;
    drag = { type: 'trim', i, side: handle.classList.contains('l') ? 'l' : 'r', x0: e.clientX, r: { ...S.draft[i] } };
    try { panel.setPointerCapture(e.pointerId); } catch (err) { /* synthetic/touch */ }
    e.preventDefault();
    return;
  }
  if (handle && chip && S.tab === 2) {
    const i = +handle.dataset.i;
    drag = { type: 'chip-trim', i, side: handle.classList.contains('l') ? 'l' : 'r', x0: e.clientX, c: { ...S.insertsDraft[i] } };
    try { panel.setPointerCapture(e.pointerId); } catch (err) { /* synthetic/touch */ }
    e.preventDefault();
    return;
  }
  if (chip && S.tab === 2) {
    const i = +chip.dataset.i;
    drag = { type: 'chip-move', i, x0: e.clientX, c: { ...S.insertsDraft[i] } };
    try { panel.setPointerCapture(e.pointerId); } catch (err) { /* synthetic/touch */ }
    e.preventDefault();
    return;
  }
  if (clip) {
    S.selected = +clip.dataset.i;
    renderClips();
    return;
  }
  // background / ruler → scrub
  const rect = timelineEl.getBoundingClientRect();
  const t = (e.clientX - rect.left - LABEL_W) / S.pps;
  drag = { type: 'scrub' };
  seekDraft(t);
  try { panel.setPointerCapture(e.pointerId); } catch (err) { /* synthetic/touch */ }
});

panel.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (drag.type === 'scrub') {
    const rect = timelineEl.getBoundingClientRect();
    seekDraft((e.clientX - rect.left - LABEL_W) / S.pps);
    return;
  }
  const dt = (e.clientX - drag.x0) / S.pps;

  if (drag.type === 'trim') {
    const r = S.draft[drag.i];
    if (drag.side === 'l') {
      r.start = Math.min(Math.max(0, drag.r.start + dt), r.end - MIN_SEG);
    } else {
      r.end = Math.max(drag.r.end + dt, r.start + MIN_SEG);
      const srcDur = (S.state.sourceDurations || {})[r.source];
      if (srcDur) r.end = Math.min(r.end, srcDur);
    }
    renderClips();
    drawWave();
    refreshHeader();
    const d = drag.side === 'l' ? r.start - r.orig.start : r.end - r.orig.end;
    showTooltip(e, `${fmt(r.start)} → ${fmt(r.end)} <span class="delta">(${d >= 0 ? '+' : ''}${d.toFixed(2)}s)</span>`);
  } else if (drag.type === 'chip-trim') {
    const c = S.insertsDraft[drag.i];
    if (drag.side === 'l') c.start = Math.min(Math.max(0, drag.c.start + dt), c.end - 0.15);
    else c.end = Math.max(drag.c.end + dt, c.start + 0.15);
    renderChips();
    refreshHeader();
    showTooltip(e, `${fmt(c.start)} → ${fmt(c.end)}`);
  } else if (drag.type === 'chip-move') {
    const c = S.insertsDraft[drag.i];
    const dur = drag.c.end - drag.c.start;
    c.start = Math.max(0, drag.c.start + dt);
    c.end = c.start + dur;
    renderChips();
    refreshHeader();
    showTooltip(e, `${fmt(c.start)} → ${fmt(c.end)}`);
  }
});

['pointerup', 'pointercancel'].forEach((ev) =>
  panel.addEventListener(ev, () => { drag = null; hideTooltip(); })
);

// double-click a clip = reset it
laneVideo.addEventListener('dblclick', (e) => {
  const clip = e.target.closest('.clip');
  if (!clip) return;
  const r = S.draft[+clip.dataset.i];
  r.start = r.orig.start; r.end = r.orig.end; r.removed = false;
  renderAll(); refreshHeader();
});

// keyboard
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    toggleMark();
    return;
  }
  if (e.key === 'Escape' && !$('helpModal').classList.contains('hidden')) {
    toggleHelp(false);
    return;
  }
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
    e.preventDefault();
    toggleHelp($('helpModal').classList.contains('hidden'));
    return;
  }
  if (e.key === 'Escape' && S.pendingIn != null) {
    S.pendingIn = null;
    renderNotes();
    toast('IN cancelado', 1600);
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    video.paused ? video.play() : video.pause();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const step = e.shiftKey ? 1 : 1 / S.fps;
    seekDraft(renderedToDraft(video.currentTime) + (e.key === 'ArrowRight' ? step : -step));
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected >= 0 && S.tab === 1) {
    const r = S.draft[S.selected];
    r.removed = !r.removed;
    renderAll(); refreshHeader();
  }
});

// transport
$('btnPlay').innerHTML = ICON.play;
$('btnMute').innerHTML = ICON.vol;
$('btnPlay').addEventListener('click', () => {
  video.paused ? video.play() : video.pause();
});
video.addEventListener('play', () => { $('btnPlay').innerHTML = ICON.pause; });
video.addEventListener('pause', () => { $('btnPlay').innerHTML = ICON.play; });
video.addEventListener('ended', () => { $('btnPlay').innerHTML = ICON.play; });
$('btnMute').addEventListener('click', () => {
  video.muted = !video.muted;
  $('btnMute').innerHTML = video.muted ? ICON.mute : ICON.vol;
});
$('zoom').addEventListener('input', (e) => setZoom(+e.target.value));

// ---------- correction markers: button, chips, editor ----------
$('markIcon').innerHTML = ICON.flag;
$('btnMark').addEventListener('click', toggleMark);
$('laneNotes').addEventListener('click', (e) => {
  const chip = e.target.closest('.note-chip');
  if (chip) openNoteEditor(chip.dataset.id, false);
});
$('noteOk').addEventListener('click', () => {
  const n = S.notes.find((x) => x.id === S.editingNote);
  if (n) {
    n.text = $('noteText').value.trim();
    if (!n.text) { toast('Escreva o ajuste desejado', 2000); return; }
  }
  S.editingNote = null;
  $('noteEditor').classList.add('hidden');
  renderNotes();
  refreshHeader();
});
$('noteDelete').addEventListener('click', () => {
  S.notes = S.notes.filter((x) => x.id !== S.editingNote);
  S.editingNote = null;
  $('noteEditor').classList.add('hidden');
  renderNotes();
  refreshHeader();
});
$('noteClose').addEventListener('click', closeNoteEditor);

// ---------- help modal (the old footer hint strip) ----------
function toggleHelp(open) {
  $('helpModal').classList.toggle('hidden', !open);
  $('helpBackdrop').classList.toggle('hidden', !open);
}
$('btnHelp').addEventListener('click', () => toggleHelp($('helpModal').classList.contains('hidden')));
$('helpClose').addEventListener('click', () => toggleHelp(false));
$('helpBackdrop').addEventListener('click', () => toggleHelp(false));
$('noteText').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.stopPropagation(); closeNoteEditor(); }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('noteOk').click(); }
});
$('btnFit').addEventListener('click', () => { fitZoom(); renderAll(); });
panel.addEventListener('scroll', () => requestAnimationFrame(() => { drawRuler(); drawWave(); positionNeedle(); }));
// renderSetup too: the caption demos bake their scale from the box width, so a
// resize (or the short-pane media query kicking in) has to rebuild them
window.addEventListener('resize', () => { fitZoom(); renderAll(); renderSetup(); });

// tabs
document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    if (tab.disabled) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    S.tab = tab.dataset.tab === 'style' ? 'style' : +tab.dataset.tab;
    S.selected = -1;
    updateVideoSrc(); // Fase 2 plays the Phase-2 render when available
    renderAll();
    renderSetup();
  })
);

// ---------- save / discard ----------
$('btnSave').addEventListener('click', async () => {
  const payload = { type: 'timeline-edits' };
  if (edlDirty()) {
    payload.edl = {
      ranges: S.draft.filter((r) => !r.removed).map((r) => ({
        source: r.source, start: +r.start.toFixed(3), end: +r.end.toFixed(3), beat: r.beat,
      })),
      removed: S.draft.filter((r) => r.removed).map((r) => ({ source: r.source, beat: r.beat, start: r.orig.start, end: r.orig.end })),
      changes: S.draft.filter((r) => !r.removed && (r.start !== r.orig.start || r.end !== r.orig.end)).map((r) => ({
        source: r.source, beat: r.beat,
        from: { start: r.orig.start, end: r.orig.end },
        to: { start: +r.start.toFixed(3), end: +r.end.toFixed(3) },
      })),
    };
  }
  if (insertsDirty()) {
    payload.editData = {
      inserts: S.insertsDraft.filter((c) => c.kind === 'insert').map((c) => ({ ref: c.ref, start: +c.start.toFixed(3), end: +c.end.toFixed(3) })),
      splitInserts: S.insertsDraft.filter((c) => c.kind === 'split').map((c) => ({ ref: c.ref, label: c.label, start: +c.start.toFixed(3), end: +c.end.toFixed(3) })),
      splitVideos: S.insertsDraft.filter((c) => c.kind === 'splitvideo').map((c) => ({ ref: c.ref, label: c.label, start: +c.start.toFixed(3), end: +c.end.toFixed(3) })),
      hook: S.insertsDraft.filter((c) => c.kind === 'hook').map((c) => ({ endSec: +c.end.toFixed(3) }))[0] || null,
      behind: S.insertsDraft.filter((c) => c.kind === 'behind').map((c) => ({ ref: c.ref, start: +c.start.toFixed(3), dur: +(c.end - c.start).toFixed(3) })),
      wordAccents: S.insertsDraft.filter((c) => c.kind === 'word').map((c) => ({ ref: c.ref, text: c.label, start: +c.start.toFixed(3), end: +c.end.toFixed(3) })),
    };
  }
  if (S.notes.length) {
    // written in the draft timeline the user was actually looking at, plus the
    // rendered-timeline equivalent so the skill can find the spot in cut.mp4
    payload.notes = S.notes.map((n) => ({
      start: +n.start.toFixed(3),
      end: +n.end.toFixed(3),
      renderedStart: +draftToRendered(n.start).toFixed(3),
      renderedEnd: +draftToRendered(n.end).toFixed(3),
      phase: S.tab === 2 ? 2 : 1,
      text: n.text,
    }));
  }
  const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if ((await res.json()).ok) {
    S.savedPending = true;
    S.notes = [];
    S.pendingIn = null;
    S.draft.forEach((r) => { r.orig = { start: r.start, end: r.end }; if (r.removed) r.hardRemoved = true; });
    // keep visual state but clear dirty counters
    S.draft = S.draft.filter((r) => !r.removed);
    S.insertsDraft.forEach((c) => { c.orig = { start: c.start, end: c.end }; });
    renderAll(); refreshHeader();
  } else {
    toast('Erro ao salvar — o servidor está de pé?', 4000);
  }
});

$('btnDiscard').addEventListener('click', () => {
  S.draft = S.rendered.map((r) => ({ ...r, removed: false, orig: { start: r.start, end: r.end } }));
  buildInsertsDraft();
  S.notes = [];
  S.pendingIn = null;
  S.editingNote = null;
  $('noteEditor').classList.add('hidden');
  S.selected = -1;
  renderAll(); refreshHeader();
  toast('Ajustes descartados', 2000);
});

// ---------- ui helpers ----------
function showTooltip(e, html) {
  tooltip.innerHTML = html;
  tooltip.style.left = `${e.clientX + 14}px`;
  tooltip.style.top = `${e.clientY - 34}px`;
  tooltip.classList.remove('hidden');
}
function hideTooltip() { tooltip.classList.add('hidden'); }
let toastTimer = null;
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3000);
}

// ---------- boot ----------
document.querySelectorAll('.tl-chip[data-icon]').forEach((c) => {
  c.innerHTML = ICON[c.dataset.icon] || '';
});

// A1/A2 accordion, folded into the audio track
$('jcutToggle').addEventListener('click', () => {
  if (!(S.jcut && S.jcut.length)) return;
  S.jcutOpen = !S.jcutOpen;
  localStorage.setItem('edvid.jcutOpen', S.jcutOpen ? '1' : '0');
  renderJcutAudio();
  updateScrollRange();
  positionNeedle();
});

poll();
loadUserPresets();
rafLoop();
// the headline fit is MEASURED, so it is wrong until Poppins is actually
// loaded — rebuild once the fonts land
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (S.style) renderSetup(); });
}
