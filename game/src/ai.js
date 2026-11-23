// Ember Isles — the Ash Warden: a simple, readable AI opponent.
// Each AI step returns after a short delay so the player can follow the play.
// Heuristics: play the strongest affordable card first, spend leftover mana on
// cheap spells, then attack taunts first, then the weakest enemy creature,
// and go face when the board is clear or the kill is in hand.
import { cardDef, makeRng } from './cards.js';
import { attack, playCard, playableCards, startPlayerTurn } from './engine.js';

function scoreCard(game, card) {
  const def = cardDef(card.defId);
  if (def.kind === 'creature') return def.cost * 2 + def.attack + def.health * 0.5;
  if (def.effect.type === 'damage') return 4;
  if (def.effect.type === 'sweep') return game.you.board.length >= 2 ? 6 : 1;
  if (def.effect.type === 'heal') return game.foe.life <= 18 ? 5 : 0.5;
  if (def.effect.type === 'draw') return 3;
  if (def.effect.type === 'freeze') return game.you.board.length > 0 ? 4 : 0.5;
  if (def.effect.type === 'buff') return game.foe.board.length > 0 ? 3 : 0.5;
  return 1;
}

function pickSpellTarget(game, card) {
  const def = cardDef(card.defId);
  const t = def.effect.target;
  if (t === 'any') {
    // Bolt the face when lethal, otherwise the biggest enemy creature.
    const faceLethal = game.you.life <= def.effect.amount;
    if (faceLethal) return { side: 'face', face: 'you' };
    const biggest = game.you.board.slice().sort((a, b) => b.attack + b.health - (a.attack + a.health))[0];
    if (biggest) return { side: 'creature', uid: biggest.uid };
    return { side: 'face', face: 'you' };
  }
  if (t === 'enemy-creature') {
    const target = game.you.board.slice().sort((a, b) => b.attack - a.attack)[0];
    return target ? { side: 'creature', uid: target.uid } : null;
  }
  if (t === 'ally-creature') {
    const target = game.foe.board.slice().sort((a, b) => b.health - a.health)[0];
    return target ? { side: 'creature', uid: target.uid } : null;
  }
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runAiTurn(game, onUpdate, rngSeed = 99) {
  const rng = makeRng(rngSeed + game.turnCount);
  await sleep(650);

  // 1. Play cards, strongest first, until nothing affordable is worth it.
  for (;;) {
    if (game.phase !== 'playing' || game.turn !== 'foe') return;
    const playable = playableCards(game, 'foe')
      .map((card) => ({ card, score: scoreCard(game, card) }))
      .filter((x) => x.score >= 1)
      .sort((a, b) => b.score - a.score);
    if (playable.length === 0) break;
    const pick = playable[0];
    const handIndex = game.foe.hand.indexOf(pick.card);
    let target = null;
    const def = cardDef(pick.card.defId);
    if (def.kind === 'spell' && def.effect.target !== 'none') {
      target = pickSpellTarget(game, pick.card);
      if (!target) break;
      // Spell targets live on the player's side; tag the side for the engine.
      if (def.effect.target === 'enemy-creature' || def.effect.target === 'any') {
        target = target.side === 'face' ? target : { ...target, side: 'you' };
      }
    }
    const res = playCard(game, 'foe', handIndex, target);
    if (!res.ok) break;
    onUpdate();
    await sleep(550);
  }

  // 2. Attack with every ready creature.
  for (const attacker of game.foe.board.slice()) {
    if (game.phase !== 'playing' || game.turn !== 'foe') return;
    if (!attacker.canAttack || attacker.frozen) continue;
    await sleep(450);
    const taunts = game.you.board.filter((c) => cardDef(c.defId).taunt);
    let target;
    if (taunts.length > 0) {
      target = { side: 'creature', uid: taunts[0].uid };
    } else if (game.you.life <= attacker.attack) {
      target = { side: 'face', face: 'you' };
    } else if (game.you.board.length > 0 && rng() < 0.55) {
      const prey = game.you.board.slice().sort((a, b) => a.health - b.health)[0];
      target = { side: 'creature', uid: prey.uid };
    } else {
      target = { side: 'face', face: 'you' };
    }
    // Attack targets: creatures are on the player's side here.
    if (target.side === 'creature') target = { ...target, side: 'you' };
    attack(game, 'foe', attacker.uid, target);
    onUpdate();
  }

  await sleep(500);
  if (game.phase === 'playing' && game.turn === 'foe') {
    startPlayerTurn(game);
    onUpdate();
  }
}
