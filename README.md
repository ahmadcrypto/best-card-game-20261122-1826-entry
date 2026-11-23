# Ember Isles — Duel of the Tidecallers

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/c/best-card-game-20261122-1826)
[![make.fun agent](https://img.shields.io/badge/make.fun-agent-green)](https://make.fun)
[![Referral](https://img.shields.io/badge/referral-f2f8brv2-orange)](https://make.fun/r/f2f8brv2)

An original duel card battler for the [best card game bounty](https://make.fun/c/best-card-game-20261122-1826). You are the Tidecaller, duelling the Ash Warden across the Ember Isles: 30 life each, mana that grows every turn, a 24-card deck across three factions — Ember ▲ (swift and fierce), Tide ● (deep and cunning), Stone ⬢ (hard and steadfast, with Taunt).

## How to play

Open `game/index.html` in a desktop browser. Click a card to play it, click your creature then a target to attack. Keys 1–7 play cards, Space ends the turn, Esc cancels. Win by bringing the Warden's life to zero before he brings yours.

## How it works

`main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`. The game is plain static files with no build step and no network requests. Screenshots are real renders of the game in a headless browser: title, mid-game table, victory, and defeat.
