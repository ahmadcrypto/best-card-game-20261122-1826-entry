// Ember Isles — game engine: pure state machine, no DOM here.
// Two sides ('you' and 'foe'), 30 life each. Mana grows 1 per turn to a max of 10.
// Creatures wait one turn (summoning daze) before they can attack.
import { buildDeck, cardDef, makeCardInstance, makeRng, shuffle } from './cards.js';

export const MAX_LIFE = 30;
export const MAX_MANA = 10;
export const MAX_HAND = 10;
export const MAX_BOARD = 7;

export function newSide(seed) {
  return {
    life: MAX_LIFE,
    mana: 0,
    maxMana: 0,
    deck: shuffle(buildDeck(), makeRng(seed)),
    hand: [],
    board: [],
    fatigue: 0,
  };
}

export function newGame(seed = 1) {
  const game = {
    seed,
    rng: makeRng(seed),
    you: newSide(seed + 11),
    foe: newSide(seed + 77),
    turn: 'you',
    turnCount: 1,
    phase: 'title', // title | playing | won | lost
    log: [],
    winner: null,
  };
  drawCards(game, 'you', 4);
  drawCards(game, 'foe', 4);
  startTurn(game, 'you');
  game.phase = 'playing';
  return game;
}

export function drawCards(game, side, n) {
  const s = game[side];
  for (let i = 0; i < n; i++) {
    if (s.hand.length >= MAX_HAND) return;
    if (s.deck.length === 0) {
      s.fatigue += 1;
      s.life -= s.fatigue;
      pushLog(game, `${side === 'you' ? 'You' : 'Ash Warden'} take ${s.fatigue} fatigue damage (empty deck).`);
      checkEnd(game);
      return;
    }
    s.hand.push(makeCardInstance(s.deck.pop()));
  }
}

export function startTurn(game, side) {
  const s = game[side];
  s.maxMana = Math.min(MAX_MANA, s.maxMana + 1);
  s.mana = s.maxMana;
  for (const c of s.board) {
    c.canAttack = !c.frozen;
    c.justPlayed = false;
    if (c.frozen) c.frozen = false;
  }
  if (game.turnCount > 1 || side === 'foe') drawCards(game, side, 1);
}

export function endTurn(game) {
  if (game.phase !== 'playing' || game.turn !== 'you') return false;
  game.turn = 'foe';
  startTurn(game, 'foe');
  pushLog(game, 'Ash Warden takes the turn.');
  return true;
}

export function startPlayerTurn(game) {
  game.turn = 'you';
  game.turnCount += 1;
  startTurn(game, 'you');
  pushLog(game, `Turn ${game.turnCount} — your move.`);
}

export function playableCards(game, side) {
  return game[side].hand.filter((c) => cardDef(c.defId).cost <= game[side].mana);
}

export function playCard(game, side, handIndex, target) {
  const s = game[side];
  const card = s.hand[handIndex];
  if (!card || game.phase !== 'playing' || game.turn !== side) return { ok: false, reason: 'not your turn' };
  const def = cardDef(card.defId);
  if (def.cost > s.mana) return { ok: false, reason: 'not enough mana' };

  if (def.kind === 'creature') {
    if (s.board.length >= MAX_BOARD) return { ok: false, reason: 'board is full' };
    s.hand.splice(handIndex, 1);
    s.mana -= def.cost;
    const placed = { ...card, canAttack: false, justPlayed: true };
    s.board.push(placed);
    pushLog(game, `${side === 'you' ? 'You play' : 'Ash Warden plays'} ${def.name}.`);
    return { ok: true };
  }

  // Spells
  const effect = def.effect;
  if (effect.target === 'any' && !target) return { ok: false, reason: 'choose a target' };
  if (effect.target === 'enemy-creature' && (!target || target.side === side)) return { ok: false, reason: 'choose an enemy creature' };
  if (effect.target === 'ally-creature' && (!target || target.side !== side)) return { ok: false, reason: 'choose one of your creatures' };
  s.hand.splice(handIndex, 1);
  s.mana -= def.cost;
  resolveSpell(game, side, def, target);
  return { ok: true };
}

function resolveSpell(game, side, def, target) {
  const foeSide = side === 'you' ? 'foe' : 'you';
  const who = side === 'you' ? 'You cast' : 'Ash Warden casts';
  switch (def.effect.type) {
    case 'damage': {
      pushLog(game, `${who} ${def.name}.`);
      if (target.side === 'face') damageSide(game, target.face, def.effect.amount);
      else damageCreature(game, target.side, target.uid, def.effect.amount);
      break;
    }
    case 'sweep': {
      pushLog(game, `${who} ${def.name} — flames sweep the enemy board.`);
      for (const c of game[foeSide].board.slice()) damageCreature(game, foeSide, c.uid, def.effect.amount);
      break;
    }
    case 'heal': {
      game[side].life = Math.min(MAX_LIFE, game[side].life + def.effect.amount);
      pushLog(game, `${who} ${def.name} — +${def.effect.amount} life.`);
      break;
    }
    case 'draw': {
      pushLog(game, `${who} ${def.name} — draws ${def.effect.amount}.`);
      drawCards(game, side, def.effect.amount);
      break;
    }
    case 'freeze': {
      const c = game[foeSide].board.find((x) => x.uid === target.uid);
      if (c) { c.frozen = true; c.canAttack = false; pushLog(game, `${who} ${def.name} — ${cardDef(c.defId).name} is frozen.`); }
      break;
    }
    case 'buff': {
      const c = game[side].board.find((x) => x.uid === target.uid);
      if (c) {
        c.health += def.effect.amount; c.maxHealth += def.effect.amount;
        pushLog(game, `${who} ${def.name} — ${cardDef(c.defId).name} gains +${def.effect.amount} health.`);
      }
      break;
    }
  }
  checkEnd(game);
}

export function attack(game, side, attackerUid, target) {
  const s = game[side];
  const foeSide = side === 'you' ? 'foe' : 'you';
  const attacker = s.board.find((c) => c.uid === attackerUid);
  if (!attacker || game.phase !== 'playing' || game.turn !== side) return { ok: false, reason: 'not your turn' };
  if (!attacker.canAttack || attacker.frozen) return { ok: false, reason: 'creature cannot attack yet' };
  const foeTaunts = game[foeSide].board.filter((c) => cardDef(c.defId).taunt);
  if (target.side === 'face' && foeTaunts.length > 0) return { ok: false, reason: 'a Taunt creature blocks the way' };
  if (target.side === 'creature' && foeTaunts.length > 0 && !foeTaunts.some((c) => c.uid === target.uid)) {
    return { ok: false, reason: 'you must attack a Taunt creature first' };
  }
  attacker.canAttack = false;
  const name = cardDef(attacker.defId).name;
  if (target.side === 'face') {
    damageSide(game, foeSide, attacker.attack);
    pushLog(game, `${name} strikes ${foeSide === 'foe' ? 'the Ash Warden' : 'you'} for ${attacker.attack}.`);
  } else {
    const defender = game[foeSide].board.find((c) => c.uid === target.uid);
    if (!defender) return { ok: false, reason: 'target is gone' };
    const defName = cardDef(defender.defId).name;
    damageCreature(game, foeSide, defender.uid, attacker.attack);
    damageCreature(game, side, attacker.uid, defender.attack);
    pushLog(game, `${name} fights ${defName} (${attacker.attack} vs ${defender.attack}).`);
  }
  checkEnd(game);
  return { ok: true };
}

function damageCreature(game, side, uid, amount) {
  const c = game[side].board.find((x) => x.uid === uid);
  if (!c) return;
  c.health -= amount;
  if (c.health <= 0) {
    game[side].board = game[side].board.filter((x) => x.uid !== uid);
    pushLog(game, `${cardDef(c.defId).name} is destroyed.`);
  }
}

function damageSide(game, side, amount) {
  game[side].life -= amount;
  checkEnd(game);
}

export function checkEnd(game) {
  if (game.phase !== 'playing') return;
  if (game.foe.life <= 0 && game.you.life <= 0) {
    game.phase = game.you.life >= game.foe.life ? 'won' : 'lost';
    game.winner = game.phase === 'won' ? 'you' : 'foe';
  } else if (game.foe.life <= 0) {
    game.phase = 'won'; game.winner = 'you';
  } else if (game.you.life <= 0) {
    game.phase = 'lost'; game.winner = 'foe';
  }
  if (game.phase === 'won') pushLog(game, 'Victory! The Ash Warden falls.');
  if (game.phase === 'lost') pushLog(game, 'Defeat. The tide goes out.');
}

export function pushLog(game, text) {
  game.log.unshift(text);
  if (game.log.length > 3) game.log.length = 3;
}
