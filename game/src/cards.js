// Ember Isles — card catalogue. All names, art glyphs and numbers are original.
// Three factions, told apart by colour AND shape:
//   Ember (red, ▲ flame) — fast, aggressive.   Tide (blue, ● drop) — tricky, control.
//   Stone (green, ⬢ hex) — tough, taunt.
export const FACTIONS = {
  ember: { label: 'Ember', glyph: '▲', shape: 'flame' },
  tide: { label: 'Tide', glyph: '●', shape: 'drop' },
  stone: { label: 'Stone', glyph: '⬢', shape: 'hex' },
};

// kind: 'creature' | 'spell'
// spell effect: { type: 'damage'|'heal'|'draw'|'freeze'|'buff'|'sweep', amount, target: 'any'|'enemy-creature'|'ally-creature'|'face'|'none' }
export const CARD_DEFS = [
  { id: 'cinder-pup', name: 'Cinder Pup', faction: 'ember', kind: 'creature', cost: 1, attack: 2, health: 1, art: '🐺', text: 'A spark that bites.' },
  { id: 'ash-imp', name: 'Ash Imp', faction: 'ember', kind: 'creature', cost: 2, attack: 3, health: 2, art: '😈', text: 'Laughs as it burns.' },
  { id: 'flame-drake', name: 'Flame Drake', faction: 'ember', kind: 'creature', cost: 4, attack: 5, health: 4, art: '🐉', text: 'Its shadow is smoke.' },
  { id: 'ember-phoenix', name: 'Ember Phoenix', faction: 'ember', kind: 'creature', cost: 6, attack: 7, health: 6, art: '🦅', text: 'Rises brighter each time.' },
  { id: 'tide-sprite', name: 'Tide Sprite', faction: 'tide', kind: 'creature', cost: 1, attack: 1, health: 2, art: '🧚', text: 'Rides the smallest wave.' },
  { id: 'coral-guard', name: 'Coral Guard', faction: 'tide', kind: 'creature', cost: 2, attack: 2, health: 4, art: '🪸', text: 'Sharp as the reef.' },
  { id: 'deep-leviathan', name: 'Deep Leviathan', faction: 'tide', kind: 'creature', cost: 5, attack: 6, health: 6, art: '🐋', text: 'The sea has a temper.' },
  { id: 'pebble-golem', name: 'Pebble Golem', faction: 'stone', kind: 'creature', cost: 2, attack: 1, health: 5, art: '🗿', text: 'Taunt. It does not move.', taunt: true },
  { id: 'mossback-turtle', name: 'Mossback Turtle', faction: 'stone', kind: 'creature', cost: 3, attack: 2, health: 6, art: '🐢', text: 'Taunt. Older than the isles.', taunt: true },
  { id: 'mountain-colossus', name: 'Mountain Colossus', faction: 'stone', kind: 'creature', cost: 7, attack: 8, health: 8, art: '⛰️', text: 'Taunt. The isle itself, awake.', taunt: true },
  { id: 'spark-bolt', name: 'Spark Bolt', faction: 'ember', kind: 'spell', cost: 2, art: '⚡', text: 'Deal 3 damage to anything.', effect: { type: 'damage', amount: 3, target: 'any' } },
  { id: 'wildfire', name: 'Wildfire', faction: 'ember', kind: 'spell', cost: 4, art: '🔥', text: 'Deal 2 damage to all enemy creatures.', effect: { type: 'sweep', amount: 2, target: 'none' } },
  { id: 'healing-rain', name: 'Healing Rain', faction: 'tide', kind: 'spell', cost: 2, art: '🌧️', text: 'Restore 5 life to yourself.', effect: { type: 'heal', amount: 5, target: 'none' } },
  { id: 'frozen-current', name: 'Frozen Current', faction: 'tide', kind: 'spell', cost: 3, art: '❄️', text: 'Freeze an enemy creature: it cannot attack next turn.', effect: { type: 'freeze', amount: 1, target: 'enemy-creature' } },
  { id: 'deep-draw', name: 'Deep Draw', faction: 'tide', kind: 'spell', cost: 2, art: '📜', text: 'Draw 2 cards.', effect: { type: 'draw', amount: 2, target: 'none' } },
  { id: 'stonewall', name: 'Stonewall', faction: 'stone', kind: 'spell', cost: 1, art: '🧱', text: 'Give one of your creatures +0/+3.', effect: { type: 'buff', amount: 3, target: 'ally-creature' } },
];

export function cardDef(id) {
  return CARD_DEFS.find((c) => c.id === id);
}

// A 24-card deck: two copies of the workhorse cards, one of the big finishers.
const DECK_RECIPE = [
  ['cinder-pup', 2], ['ash-imp', 2], ['flame-drake', 2], ['ember-phoenix', 1],
  ['tide-sprite', 2], ['coral-guard', 2], ['deep-leviathan', 1],
  ['pebble-golem', 2], ['mossback-turtle', 2], ['mountain-colossus', 1],
  ['spark-bolt', 2], ['wildfire', 1], ['healing-rain', 1],
  ['frozen-current', 1], ['deep-draw', 1], ['stonewall', 1],
];

export function buildDeck() {
  const deck = [];
  for (const [id, n] of DECK_RECIPE) for (let i = 0; i < n; i++) deck.push(id);
  return deck;
}

// Small deterministic RNG (mulberry32) so screenshot states are reproducible.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(array, rng) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let uidCounter = 1;
export function makeCardInstance(defId) {
  const def = cardDef(defId);
  return {
    uid: uidCounter++,
    defId,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    canAttack: false,
    frozen: false,
    justPlayed: true,
  };
}
