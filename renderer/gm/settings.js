// GM panel static configuration.
// Edit colours or add entries here to customise defaults app-wide.
// This file is loaded before gm.js and exposes globals used by the GM renderer.

// ---------------------------------------------------------------------------
// Pathfinder 1e – all standard conditions
// ---------------------------------------------------------------------------
const PF1E_CONDITIONS = [
  { name: 'Blinded',        color: '#555555' },
  { name: 'Confused',       color: '#cc44cc' },
  { name: 'Cowering',       color: '#777788' },
  { name: 'Dazed',          color: '#8888bb' },
  { name: 'Dazzled',        color: '#ffcc44' },
  { name: 'Dead',           color: '#221111' },
  { name: 'Deafened',       color: '#888888' },
  { name: 'Dying',          color: '#cc2222' },
  { name: 'Energy Drained', color: '#553355' },
  { name: 'Entangled',      color: '#228822' },
  { name: 'Exhausted',      color: '#884422' },
  { name: 'Fascinated',     color: '#2266cc' },
  { name: 'Fatigued',       color: '#996644' },
  { name: 'Flat-Footed',    color: '#6666aa' },
  { name: 'Frightened',     color: '#cc6633' },
  { name: 'Grappled',       color: '#448844' },
  { name: 'Helpless',       color: '#664444' },
  { name: 'Incorporeal',    color: '#aaaacc' },
  { name: 'Invisible',      color: '#cccccc' },
  { name: 'Nauseated',      color: '#88aa22' },
  { name: 'Panicked',       color: '#cc3311' },
  { name: 'Paralyzed',      color: '#6633aa' },
  { name: 'Petrified',      color: '#888866' },
  { name: 'Pinned',         color: '#559944' },
  { name: 'Prone',          color: '#997766' },
  { name: 'Shaken',         color: '#cc8833' },
  { name: 'Sickened',       color: '#669933' },
  { name: 'Staggered',      color: '#cc7733' },
  { name: 'Stunned',        color: '#8833cc' },
  { name: 'Unconscious',    color: '#333355' },
];

// ---------------------------------------------------------------------------
// Initiative HUD defaults
// ---------------------------------------------------------------------------
const DEFAULT_HUD_FONT_SIZE = 24;
