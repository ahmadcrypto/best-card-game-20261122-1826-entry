// Ember Isles — DOM rendering: turns game state into visible cards, boards and bars.
import { FACTIONS, cardDef } from './cards.js';
import { playableCards } from './engine.js';

export function makeCardElement(card, opts = {}) {
  const def = cardDef(card.defId);
  const faction = FACTIONS[def.faction];
  const el = document.createElement('div');
  el.className = `card faction-${def.faction}`;
  el.dataset.uid = card.uid;
  el.dataset.defId = def.id;
  if (opts.playable) el.classList.add('playable');
  if (opts.selected) el.classList.add('selected');
  if (opts.unaffordable) el.classList.add('unaffordable');
  if (card.frozen) el.classList.add('frozen');
  if (opts.sleeping) el.classList.add('sleeping');
  if (opts.canAttack) el.classList.add('can-attack');
  if (opts.targetable) el.classList.add('targetable');

  const cost = document.createElement('div');
  cost.className = 'cost';
  cost.textContent = def.cost;
  el.appendChild(cost);

  const factionBar = document.createElement('div');
  factionBar.className = 'faction';
  factionBar.textContent = `${faction.glyph} ${faction.label}`;
  el.appendChild(factionBar);

  const art = document.createElement('div');
  art.className = 'art';
  art.textContent = def.art;
  el.appendChild(art);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = def.name;
  el.appendChild(name);

  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = def.text;
  el.appendChild(text);

  if (def.kind === 'creature') {
    const stats = document.createElement('div');
    stats.className = 'stats';
    const atk = document.createElement('div');
    atk.className = 'atk';
    atk.textContent = card.attack;
    const hp = document.createElement('div');
    hp.className = 'hp';
    const hpSpan = document.createElement('span');
    hpSpan.textContent = card.health;
    hp.appendChild(hpSpan);
    stats.appendChild(atk);
    stats.appendChild(hp);
    el.appendChild(stats);
    if (def.taunt) {
      const badge = document.createElement('div');
      badge.className = 'taunt-badge';
      badge.textContent = '⬢ TAUNT';
      el.appendChild(badge);
    }
  } else {
    const tag = document.createElement('div');
    tag.className = 'spell-tag';
    tag.textContent = '✦ Spell';
    el.appendChild(tag);
  }
  return el;
}

export function makeCardBack() {
  const el = document.createElement('div');
  el.className = 'card card-back';
  el.style.cssText = 'background:linear-gradient(160deg,#3d130a,#7a2e1d);border-color:#d4af37;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#ffd97a;';
  const gem = document.createElement('div');
  gem.style.cssText = 'font-size:40px;';
  gem.textContent = '◆';
  const label = document.createElement('div');
  label.style.cssText = 'font-size:10px;letter-spacing:2px;text-align:center;';
  label.textContent = 'EMBER ISLES';
  el.append(gem, label);
  return el;
}

export function renderBoard(game, ui) {
  renderSide(game, ui, 'foe');
  renderSide(game, ui, 'you');
  renderHand(game, ui);
  renderBars(game, ui);
  ui.logEl.textContent = game.log[0] ?? '';
  ui.bannerEl.textContent =
    game.phase === 'won' ? 'Victory!' :
    game.phase === 'lost' ? 'Defeat' :
    game.turn === 'you' ? 'Your turn' : 'Ash Warden thinking…';
  ui.endTurnBtn.disabled = game.turn !== 'you' || game.phase !== 'playing';
  // Pulse End Turn when the player has nothing left to do this turn.
  const nothingLeft =
    game.phase === 'playing' && game.turn === 'you' &&
    playableCards(game, 'you').length === 0 &&
    !game.you.board.some((c) => c.canAttack && !c.frozen);
  ui.endTurnBtn.classList.toggle('ready', nothingLeft);
}

function renderSide(game, ui, side) {
  const row = side === 'foe' ? ui.foeRow : ui.youRow;
  row.replaceChildren();
  const board = game[side].board;
  if (board.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-slot';
    empty.textContent = side === 'foe' ? '— no creatures guarding the Warden —' : '— your side of the table is empty —';
    row.appendChild(empty);
    return;
  }
  for (const card of board) {
    const isFoe = side === 'foe';
    const canAttack = !isFoe && card.canAttack && !card.frozen && game.turn === 'you' && game.phase === 'playing';
    const targetable = isFoe && ui.attackerUid !== null;
    const el = makeCardElement(card, {
      sleeping: !isFoe && !card.canAttack && game.phase === 'playing',
      canAttack,
      targetable,
    });
    el.addEventListener('click', () => ui.onBoardClick(side, card.uid));
    row.appendChild(el);
  }
}

function renderHand(game, ui) {
  ui.handEl.replaceChildren();
  game.you.hand.forEach((card, index) => {
    const def = cardDef(card.defId);
    const affordable = def.cost <= game.you.mana && game.turn === 'you' && game.phase === 'playing';
    const el = makeCardElement(card, {
      playable: affordable,
      selected: ui.selectedHand === index,
      unaffordable: !affordable,
    });
    el.style.transform = `rotate(${(index - (game.you.hand.length - 1) / 2) * 2.2}deg)`;
    el.addEventListener('click', () => ui.onHandClick(index));
    ui.handEl.appendChild(el);
  });
}

function renderBars(game, ui) {
  ui.foeLifeFill.style.width = `${Math.max(0, game.foe.life) / 30 * 100}%`;
  ui.foeLifeText.textContent = `${Math.max(0, game.foe.life)} / 30`;
  ui.youLifeFill.style.width = `${Math.max(0, game.you.life) / 30 * 100}%`;
  ui.youLifeText.textContent = `${Math.max(0, game.you.life)} / 30`;
  ui.manaEl.textContent = `◆ ${game.you.mana} / ${game.you.maxMana}`;
  ui.youDeckCount.textContent = game.you.deck.length;
  ui.foeDeckCount.textContent = game.foe.deck.length;
  ui.foeHandCount.textContent = `Hand × ${game.foe.hand.length}`;
}
