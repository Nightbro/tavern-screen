// HUD configuration — conditions list and defaults.
// Used by HudBase (status picker) and concrete HUD classes (getDefaults).

export const DEFAULT_HUD_FONT_SIZE = 24;

export const DND5E_CONDITIONS = [
  { name: 'Blinded',       color: '#555555', desc: 'Attacks have disadvantage.\nFail sight-based Perception checks.\nAttacks against you have advantage.' },
  { name: 'Charmed',       color: '#ff88cc', desc: "Can't attack or target charmer with harmful spells.\nCharmer has advantage on social ability checks against you." },
  { name: 'Deafened',      color: '#888888', desc: 'Fail hearing-based Perception checks.' },
  { name: 'Frightened',    color: '#cc6633', desc: 'Attacks and ability checks have disadvantage while source is in line of sight.\nCannot move toward the fear source.' },
  { name: 'Grappled',      color: '#448844', desc: 'Speed becomes 0.\nEscape: contested Str (Athletics) or Dex (Acrobatics) vs grappler\'s Str (Athletics).' },
  { name: 'Incapacitated', color: '#8888bb', desc: 'No actions or reactions.\nLose concentration.' },
  { name: 'Invisible',     color: '#ccccee', desc: 'Cannot be seen without magic or special senses.\nAttack rolls have advantage.\nAttack rolls against you have disadvantage.' },
  { name: 'Paralyzed',     color: '#6633aa', desc: 'Incapacitated. No movement or speech.\nFail DEX and STR saves.\nAttacks from ≤5 ft auto-crit.\nAttacks against you have advantage.' },
  { name: 'Petrified',     color: '#888866', desc: 'Incapacitated. No movement or speech.\nResistance to all damage. Immune to new poisons/diseases.\nFail DEX and STR saves.\nAttacks against you have advantage.' },
  { name: 'Poisoned',      color: '#669933', desc: 'Attacks have disadvantage.\nAbility checks have disadvantage.' },
  { name: 'Prone',         color: '#997766', desc: 'Must crawl (costs 1 extra ft) or teleport.\nAttacks have disadvantage.\nAttacks from ≤5 ft have advantage; otherwise disadvantage.' },
  { name: 'Restrained',    color: '#cc4444', desc: 'Speed 0.\nAttacks have disadvantage.\nAttacks against you have advantage.\nDEX saves have disadvantage.' },
  { name: 'Stunned',       color: '#8833cc', desc: 'Incapacitated. No movement, faltering speech.\nFail DEX and STR saves.\nAttacks against you have advantage.' },
  { name: 'Unconscious',   color: '#333366', desc: 'Incapacitated. No movement or speech. Fall prone.\nFail DEX and STR saves.\nAttacks from ≤5 ft auto-crit.\nAttacks against you have advantage.' },
];

export const PF1E_CONDITIONS = [
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
