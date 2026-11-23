// Ember Isles — bootstrap, input (mouse + keyboard) and screenshot states.
// Real play starts from the title overlay. ?shot=title|play|win|loss renders a
// fixed, deterministic state for screenshots (no randomness in shot mode).
import { cardDef, makeCardInstance } from './cards.js';
import { attack, endTurn, newGame, playCard } from './engine.js';
import { renderBoard } from './render.js';
import { runAiTurn } from './ai.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') ?? 7) || 7;

const game = newGame(seed);

const ui = {
  foeRow: document.getElementById('foe-row'),
  youRow: document.getElementById('you-row'),
  handEl: document.getElementById('hand'),
  logEl: document.getElementById('log'),
  bannerEl: document.getElementById('turn-banner'),
  endTurnBtn: document.getElementById('end-turn'),
  foeLifeFill: document.getElementById('foe-life-fill'),
  foeLifeText: document.getElementById('foe-life-text'),
  youLifeFill: document.getElementById('you-life-fill'),
  youLifeText: document.getElementById('you-life-text'),
  manaEl: document.getElementById('mana-display'),
  youDeckCount: document.getElementById('you-deck-count'),
  foeDeckCount: document.getElementById('foe-deck-count'),
  foeHandCount: document.getElementById('foe-hand-count'),
  selectedHand: null,
  attackerUid: null,
  onHandClick,
  onBoardClick,
};

const overlay = document.getElementById('overlay');
const panel = document.getElementById('panel');
const startBtn = document.getElementById('start-btn');

function refresh() {
  renderBoard(game, ui);
  if (game.phase === 'won' || game.phase === 'lost') showEndPanel();
}

function clearSelection() {
  ui.selectedHand = null;
  ui.attackerUid = null;
}

function onHandClick(index) {
  if (game.phase !== 'playing' || game.turn !== 'you') return;
  const card = game.you.hand[index];
  if (!card) return;
  const def = cardDef(card.defId);
  if (def.cost > game.you.mana) return;
  if (ui.selectedHand === index) { clearSelection(); refresh(); return; }
  if (def.kind === 'spell' && def.effect.target !== 'none') {
    ui.selectedHand = index;
    ui.attackerUid = null;
    game.log.unshift(`Choose a target for ${def.name}.`);
    refresh();
    return;
  }
  const res = playCard(game, 'you', index, null);
  if (res.ok) { clearSelection(); refresh(); }
}

function onBoardClick(side, uid) {
  if (game.phase !== 'playing' || game.turn !== 'you') return;
  // A spell is waiting for a target.
  if (ui.selectedHand !== null) {
    const card = game.you.hand[ui.selectedHand];
    const def = cardDef(card.defId);
    let target = null;
    if (def.effect.target === 'any') {
      target = side === 'foe' ? { side: 'foe', uid } : null;
      if (!target) { clearSelection(); refresh(); return; }
    } else if (def.effect.target === 'enemy-creature') {
      if (side !== 'foe') return;
      target = { side: 'foe', uid };
    } else if (def.effect.target === 'ally-creature') {
      if (side !== 'you') return;
      target = { side: 'you', uid };
    }
    const res = playCard(game, 'you', ui.selectedHand, target);
    if (res.ok) clearSelection();
    refresh();
    return;
  }
  // Attack flow: pick one of your ready creatures, then a target.
  if (side === 'you') {
    const c = game.you.board.find((x) => x.uid === uid);
    if (c && c.canAttack && !c.frozen) {
      ui.attackerUid = ui.attackerUid === uid ? null : uid;
      game.log.unshift(ui.attackerUid ? 'Choose a target to attack.' : 'Attacker cleared.');
    }
    refresh();
    return;
  }
  if (side === 'foe' && ui.attackerUid !== null) {
    const res = attack(game, 'you', ui.attackerUid, { side: 'creature', uid });
    if (res.ok) clearSelection();
    refresh();
  }
}

function attackFace() {
  if (game.phase !== 'playing' || game.turn !== 'you') return;
  if (ui.selectedHand !== null) {
    const card = game.you.hand[ui.selectedHand];
    const def = cardDef(card.defId);
    if (def.kind === 'spell' && def.effect.target === 'any') {
      const res = playCard(game, 'you', ui.selectedHand, { side: 'face', face: 'foe' });
      if (res.ok) clearSelection();
      refresh();
      return;
    }
  }
  if (ui.attackerUid !== null) {
    const res = attack(game, 'you', ui.attackerUid, { side: 'face', face: 'foe' });
    if (res.ok) clearSelection();
    refresh();
  }
}

document.getElementById('foe-portrait').addEventListener('click', attackFace);
document.getElementById('foe-name').addEventListener('click', attackFace);
document.getElementById('foe-life-text').addEventListener('click', attackFace);

ui.endTurnBtn.addEventListener('click', async () => {
  if (game.phase !== 'playing' || game.turn !== 'you') return;
  clearSelection();
  if (endTurn(game)) {
    refresh();
    await runAiTurn(game, refresh, seed);
    refresh();
  }
});

startBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
});

document.addEventListener('keydown', async (event) => {
  if (overlay.classList.contains('hidden') === false) {
    if (event.key === 'Enter') overlay.classList.add('hidden');
    return;
  }
  if (event.key >= '1' && event.key <= '7') {
    onHandClick(Number(event.key) - 1);
  } else if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    ui.endTurnBtn.click();
  } else if (event.key === 'Escape') {
    clearSelection();
    refresh();
  }
});

function showEndPanel() {
  const won = game.phase === 'won';
  panel.innerHTML = '';
  const title = document.createElement('div');
  title.className = `end-title ${won ? 'win' : 'lose'}`;
  title.textContent = won ? 'VICTORY' : 'DEFEAT';
  const score = document.createElement('div');
  score.className = 'end-score';
  score.innerHTML = won
    ? `The Ash Warden falls. The isles are yours.<br>Final life — You ${Math.max(0, game.you.life)} · Warden ${Math.max(0, game.foe.life)} · Turn ${game.turnCount}`
    : `The tide goes out. The Warden keeps the isles — this time.<br>Final life — You ${Math.max(0, game.you.life)} · Warden ${Math.max(0, game.foe.life)} · Turn ${game.turnCount}`;
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = 'Play Again';
  again.addEventListener('click', () => location.reload());
  panel.append(title, score, again);
  overlay.classList.remove('hidden');
}

// ---- Deterministic screenshot states (?shot=...) ----
function placeOnBoard(side, defId, attack, health, canAttack) {
  const c = makeCardInstance(defId);
  if (attack !== undefined) c.attack = attack;
  if (health !== undefined) { c.health = health; c.maxHealth = health; }
  c.canAttack = !!canAttack;
  c.justPlayed = false;
  game[side].board.push(c);
  return c;
}

function setHand(side, defIds) {
  game[side].hand = defIds.map((id) => makeCardInstance(id));
}

function buildShotState(which) {
  if (which === 'title') return; // fresh game behind the title overlay
  overlay.classList.add('hidden');
  if (which === 'play') {
    game.you.life = 24; game.foe.life = 19;
    game.you.maxMana = 7; game.you.mana = 6;
    game.foe.maxMana = 6; game.foe.mana = 2;
    game.turn = 'you'; game.turnCount = 7;
    game.you.board = []; game.foe.board = [];
    placeOnBoard('you', 'flame-drake', 5, 4, true);
    placeOnBoard('you', 'coral-guard', 2, 4, true);
    placeOnBoard('you', 'pebble-golem', 1, 5, true);
    placeOnBoard('foe', 'ash-imp', 3, 2, false);
    placeOnBoard('foe', 'deep-leviathan', 6, 6, false);
    placeOnBoard('foe', 'mossback-turtle', 2, 6, false);
    setHand('you', ['ash-imp', 'spark-bolt', 'healing-rain', 'deep-leviathan', 'stonewall']);
    setHand('foe', ['cinder-pup', 'flame-drake', 'frozen-current']);
    game.you.deck = game.you.deck.slice(0, 13);
    game.foe.deck = game.foe.deck.slice(0, 15);
    game.log.unshift('Flame Drake scorches the Warden for 5.');
    game.log.unshift('Coral Guard holds the line.');
    return;
  }
  if (which === 'win' || which === 'loss') {
    game.you.board = []; game.foe.board = [];
    placeOnBoard('you', 'ember-phoenix', 7, 6, false);
    placeOnBoard('you', 'mountain-colossus', 8, 8, false);
    placeOnBoard('foe', 'cinder-pup', 2, 1, false);
    setHand('you', ['spark-bolt', 'healing-rain']);
    setHand('foe', ['ash-imp']);
    game.you.deck = game.you.deck.slice(0, 9);
    game.foe.deck = game.foe.deck.slice(0, 11);
    if (which === 'win') {
      game.you.life = 12; game.foe.life = 0;
      game.phase = 'won'; game.winner = 'you';
      game.log.unshift('Victory! The Ash Warden falls.');
    } else {
      game.you.life = 0; game.foe.life = 8;
      game.phase = 'lost'; game.winner = 'foe';
      game.log.unshift('Defeat. The tide goes out.');
    }
    game.turnCount = 11;
  }
}

buildShotState(shot ?? 'title');
refresh();
if (shot === 'win' || shot === 'loss') showEndPanel();
