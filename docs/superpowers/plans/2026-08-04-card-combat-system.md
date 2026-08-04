# Card Combat System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six fixed combat commands with a 49-card, three-energy deck system featuring captain-exclusive cards, target-specific drag play, route-scaled multi-ship encounters, card rewards/removal, and energy relic/crew synergies while preserving captain skills as once-per-combat actions.

**Architecture:** Keep the existing dependency-free browser game and Canvas renderer, but extract immutable card data, pure deck operations, and fleet formation rules into focused global-script modules loaded before `game.js`. `game.js` remains the orchestration layer for mutable voyage state, effects, rewards, DOM, input, audio, and Canvas rendering. Tests load real scripts into Node `vm` contexts and exercise pure modules before integration paths.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Canvas 2D, Pointer Events, Node.js built-in `node:test`, `assert`, and `vm`; no package manager or external runtime dependency.

## Global Constraints

- The approved design is `docs/superpowers/specs/2026-08-04-card-combat-system-design.md` and is authoritative for Korean copy and numeric balance.
- The global catalog contains exactly 49 unique cards: 21 common-pool cards plus 7 exclusive cards for each of 4 captains.
- Every voyage starts with exactly 10 cards: `fire ×3`, `chain ×2`, `approach ×2`, `retreat ×1`, `repair ×1`, `board ×1`.
- A player turn starts with 3 energy and 5 cards; maximum persistent energy is 4 and hand size is capped at 8.
- Unplayed cards discard at end of turn; the discard pile reshuffles only when draw pile is empty; exhausted cards never reshuffle during that combat.
- Captain skills remain separate, cost 0 energy, do not end the turn, and are usable once per combat.
- Card target types are exactly `enemy`, `self`, `sea`, and `allEnemies`.
- Calm regular/elite/boss encounters stay at 1 enemy; Storm regular/elite encounters use 1–2/2 enemies; Abyss regular/elite encounters use 2/2–3 enemies; every boss remains 1 enemy.
- Two-ship stat scale is 0.65 and reward scale is 1.25; three-ship stat scale is 0.50 and reward scale is 1.50.
- Use Pointer Events for mouse/touch drag and preserve keyboard access with `1`–`8`, arrow/Tab target movement, Enter, Escape, `Q`, and `E`.
- Honor `prefers-reduced-motion: reduce` and keep the layout usable at 320px.
- Do not overwrite the existing tooltip work or selected-captain ship-preview fix already present in the dirty working tree.
- Each implementation task follows RED → GREEN → regression verification and commits only its own files.

---

## File Structure

- Create `src/card-definitions.js`: immutable 49-card catalog, starter deck, rarity weights, lookup and captain reward-pool helpers.
- Create `src/card-engine.js`: DOM-free card-instance, pile, draw, discard, exhaust, energy, turn, and temporary-cost operations.
- Create `src/fleet-combat.js`: DOM-free route formation counts/scales, living-target queries, attack budgets, and enemy layout slots.
- Modify `src/game.js`: integrate deck/fleet state, execute card effects, preserve captain skills, add rewards/removal, render UI, handle drag/keyboard, and orchestrate multi-enemy turns.
- Modify `src/analytics.js`: record card, energy, turn, enemy-count, defeated/captured, and final-deck fields while preserving old records.
- Modify `index.html`: load new scripts before `game.js` and add a deck inspection trigger in the ship panel.
- Modify `styles.css`: hand/cards, energy controls, target states, drag/fly/return animation, responsive/reduced-motion rules.
- Modify `README.md`: replace fixed-command controls with card controls and describe route fleet counts.
- Create `tests/helpers/load-game.js`: reusable VM/DOM/Canvas harness for real browser scripts.
- Create `tests/card-definitions.test.js`: catalog counts, metadata, starter deck, captain filtering.
- Create `tests/card-engine.test.js`: deterministic pile, draw, energy, end-turn, exhaust, cost-modifier behavior.
- Create `tests/fleet-combat.test.js`: route counts, formation scaling, attack budgets, living enemies, layout slots.
- Create `tests/card-combat.test.js`: public card legality/effects, target routing, end-turn enemy timing.
- Create `tests/captain-card-combat.test.js`: captain-exclusive effects, captain skills, energy cards.
- Create `tests/card-progression.test.js`: reward candidates, skip/acquire, deck view/removal price/minimum.
- Create `tests/card-ui.test.js`: semantic hand controls, pointer drag state, keyboard target flow, animation completion idempotency.
- Modify `tests/ship-preview.test.js`: use the shared harness without changing its assertions.

---

### Task 1: Shared Test Harness and 49-Card Catalog

**Files:**
- Create: `src/card-definitions.js`
- Create: `tests/helpers/load-game.js`
- Create: `tests/card-definitions.test.js`
- Modify: `tests/ship-preview.test.js:1-74`
- Modify: `index.html:187-188`

**Interfaces:**
- Produces global `CardDefinitions` with:
  - `CARD_DEFINITIONS: Readonly<Record<string, CardDefinition>>`
  - `STARTER_DECK: ReadonlyArray<string>`
  - `CARD_RARITY_WEIGHTS: { normal: 0.55, rare: 0.30, epic: 0.15 }`
  - `getCard(cardId: string): CardDefinition | null`
  - `getRewardPool(captainId: string): CardDefinition[]`
- `CardDefinition` fields: `{ id, name, family, cost, rarity, captainId, targetType, exhaust, effect, description }`.
- Produces these test-only helpers from `tests/helpers/load-game.js`:
  - `loadGameScripts(files: string[], overrides?: object): vm.Context`
  - `runGame(source: string, overrides?: object): unknown`
  - `read(context: vm.Context, expression: string): unknown`
  - `makeElement(): ElementStub`
  - `installGameFixtures(context: vm.Context): void`, defining deterministic fixture factories such as `makeTestRun()` and `enemyState()` inside the VM context.

- [ ] **Step 1: Write catalog and harness tests that fail before the module exists**

```js
test("카드 카탈로그는 공용 21종과 선장별 7종으로 구성된다", () => {
  const context = loadGameScripts(["src/card-definitions.js"]);
  const summary = vm.runInContext(`(() => {
    const cards = Object.values(CardDefinitions.CARD_DEFINITIONS);
    return {
      total: cards.length,
      ids: new Set(cards.map((card) => card.id)).size,
      common: cards.filter((card) => !card.captainId).length,
      captainCounts: Object.fromEntries(["gunner", "navigator", "mystic", "revenant"].map(
        (id) => [id, cards.filter((card) => card.captainId === id).length],
      )),
    };
  })()`, context);
  assert.deepEqual(summary, {
    total: 49,
    ids: 49,
    common: 21,
    captainCounts: { gunner: 7, navigator: 7, mystic: 7, revenant: 7 },
  });
});

test("시작 덱은 합의된 10장이다", () => {
  assert.deepEqual(readStarterDeck(), [
    "fire", "fire", "fire", "chain", "chain",
    "approach", "approach", "retreat", "repair", "board",
  ]);
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --test tests/card-definitions.test.js tests/ship-preview.test.js`

Expected: FAIL because `src/card-definitions.js` and `tests/helpers/load-game.js` do not exist.

- [ ] **Step 3: Implement immutable card definitions and load order**

Implement `runGame()` as `loadGameScripts([...browser scripts], overrides)` followed by `vm.runInContext(source, context)`, and implement `read()` as a thin `vm.runInContext()` wrapper. Keep fixture factories test-only; production scripts must not branch on test mode.

Use these exact IDs so later effect dispatch and analytics remain stable:

```js
const PUBLIC_CARD_IDS = [
  "fire", "aimed_fire", "rapid_fire",
  "chain", "heavy_chain", "entangling_chain",
  "approach", "tailwind_charge", "ram",
  "retreat", "hard_turn", "smoke_sail",
  "repair", "rigging_repair", "overhaul",
  "board", "grappling_hook", "desperate_board",
  "barrage_fire", "chain_rain", "fireship",
];
const CAPTAIN_CARD_IDS = {
  gunner: ["gunner_steady_aim", "gunner_shrapnel", "gunner_double_broadside", "gunner_powder_shift", "gunner_overcharge", "gunner_magazine_open", "gunner_fleet_broadside"],
  navigator: ["navigator_read_wind", "navigator_raise_sails", "navigator_crosswind_turn", "navigator_wave_ride", "navigator_tailwind_route", "navigator_reposition", "navigator_storm_corridor"],
  mystic: ["mystic_abyss_mark", "mystic_cursed_tide", "mystic_fear_whisper", "mystic_dark_prophecy", "mystic_blood_pact", "mystic_open_abyss", "mystic_abyss_chorus"],
  revenant: ["revenant_dead_nails", "revenant_ghost_deckhand", "revenant_soul_drain", "revenant_sinking_memory", "revenant_death_delay", "revenant_return_abyss", "revenant_ghost_fleet"],
};
```

Populate every definition with the exact Korean name, cost, rarity, numeric description, captain restriction, exhaustion flag, and target type from the approved spec. Use effect IDs equal to the stable card IDs. Freeze the returned arrays/objects and return copies from `getRewardPool()`.

Load scripts in this order:

```html
<script defer src="./src/analytics.js?v=20260804a"></script>
<script defer src="./src/card-definitions.js?v=20260804a"></script>
<script defer src="./src/game.js?v=20260804a"></script>
```

- [ ] **Step 4: Run catalog and existing preview tests and confirm GREEN**

Run: `node --test tests/card-definitions.test.js tests/ship-preview.test.js`

Expected: 49 unique definitions, 21 public cards, 7 cards per captain, starter deck exact, and ship-preview regression PASS.

- [ ] **Step 5: Commit only Task 1 files**

```bash
git add index.html src/card-definitions.js tests/helpers/load-game.js tests/card-definitions.test.js tests/ship-preview.test.js
git commit -m "feat(cards): add immutable card catalog"
```

---

### Task 2: Pure Deck and Energy Engine

**Files:**
- Create: `src/card-engine.js`
- Create: `tests/card-engine.test.js`
- Modify: `index.html:187-190`

**Interfaces:**
- Consumes `CardDefinitions.getCard(cardId)`.
- Produces global `CardEngine`:
  - `createState(cardIds, randomFn, options): CardState`
  - `drawCards(state, count, randomFn): CardInstance[]`
  - `startPlayerTurn(state, modifiers, randomFn): void`
  - `canPay(state, instanceId): boolean`
  - `spendForCard(state, instanceId): number`
  - `finishCard(state, instanceId, exhaust): void`
  - `endPlayerTurn(state): void`
  - `setTurnCostDelta(state, instanceId, delta): void`
- `CardInstance`: `{ instanceId: string, cardId: string, costDelta: number }`.
- `CardState`: `{ drawPile, hand, discardPile, exhaustPile, energy, maxEnergy, handSize, handLimit, turn, nextInstanceId }`.

- [ ] **Step 1: Write deterministic deck-engine tests**

```js
test("턴 종료는 손패를 버리고 다음 턴에 에너지와 손패를 채운다", () => {
  const state = CardEngine.createState(CardDefinitions.STARTER_DECK, () => 0, {
    maxEnergy: 3, handSize: 5, handLimit: 8,
  });
  assert.equal(state.hand.length, 5);
  assert.equal(state.energy, 3);
  CardEngine.endPlayerTurn(state);
  assert.equal(state.hand.length, 0);
  assert.equal(state.discardPile.length, 5);
  CardEngine.startPlayerTurn(state, {}, () => 0);
  assert.equal(state.turn, 2);
  assert.equal(state.energy, 3);
  assert.equal(state.hand.length, 5);
});

test("소멸 카드는 재순환하지 않고 손패는 8장을 넘지 않는다", () => {
  const state = makeTenCardState();
  const first = state.hand[0];
  CardEngine.finishCard(state, first.instanceId, true);
  CardEngine.drawCards(state, 20, () => 0);
  assert.equal(state.exhaustPile.some((card) => card.instanceId === first.instanceId), true);
  assert.equal(state.hand.length, 8);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/card-engine.test.js`

Expected: FAIL because `CardEngine` is not defined.

- [ ] **Step 3: Implement mutation helpers with deterministic shuffling**

```js
function effectiveCost(instance) {
  const definition = CardDefinitions.getCard(instance.cardId);
  return Math.max(0, (definition?.cost || 0) + instance.costDelta);
}

function drawCards(state, count, randomFn = Math.random) {
  const drawn = [];
  while (drawn.length < count && state.hand.length < state.handLimit) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      state.drawPile = shuffleInstances(state.discardPile.splice(0), randomFn);
    }
    const card = state.drawPile.pop();
    card.costDelta = 0;
    state.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}
```

`spendForCard()` must return the amount spent and make no change if energy is insufficient. `finishCard()` must locate the exact instance in hand and move it once. `endPlayerTurn()` resets all temporary cost deltas before discarding.

Add `<script defer src="./src/card-engine.js?v=20260804a"></script>` after `card-definitions.js` and before `game.js`.

- [ ] **Step 4: Run deck tests and syntax checks**

Run: `node --test tests/card-engine.test.js && node --check src/card-engine.js && git diff --check`

Expected: all deck tests PASS and both checks exit 0.

- [ ] **Step 5: Commit Task 2**

```bash
git add index.html src/card-engine.js tests/card-engine.test.js
git commit -m "feat(cards): add deck and energy engine"
```

---

### Task 3: Route-Scaled Fleet Primitives

**Files:**
- Create: `src/fleet-combat.js`
- Create: `tests/fleet-combat.test.js`
- Modify: `index.html:187-191`

**Interfaces:**
- Produces global `FleetCombat`:
  - `enemyCount(mapId, kind, actIndex, randomFn): number`
  - `statScale(count): number`
  - `rewardScale(count): number`
  - `attackBudget(mapId, livingCount): number`
  - `livingEnemies(enemies): Enemy[]`
  - `isDefeated(enemies): boolean`
  - `layoutSlots(count): Array<{ x, y, scale }>`
- Boss count is always 1. Elite fleets consist of one elite flagship plus regular escorts.

- [ ] **Step 1: Write boundary-driven formation tests**

```js
test("항로와 노드별 적 수가 승인 범위를 따른다", () => {
  assert.equal(FleetCombat.enemyCount("calm", "battle", 2, () => 0), 1);
  assert.equal(FleetCombat.enemyCount("storm", "battle", 0, () => 0.39), 2);
  assert.equal(FleetCombat.enemyCount("storm", "battle", 0, () => 0.41), 1);
  assert.equal(FleetCombat.enemyCount("storm", "battle", 2, () => 0.59), 2);
  assert.equal(FleetCombat.enemyCount("abyss", "battle", 0, () => 0.99), 2);
  assert.equal(FleetCombat.enemyCount("abyss", "elite", 2, () => 0.49), 3);
  assert.equal(FleetCombat.enemyCount("abyss", "boss", 2, () => 0), 1);
});

test("편성 배율과 공격 예산을 제한한다", () => {
  assert.equal(FleetCombat.statScale(2), 0.65);
  assert.equal(FleetCombat.statScale(3), 0.5);
  assert.equal(FleetCombat.rewardScale(2), 1.25);
  assert.equal(FleetCombat.attackBudget("storm", 3), 1);
  assert.equal(FleetCombat.attackBudget("abyss", 3), 2);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/fleet-combat.test.js`

Expected: FAIL because `FleetCombat` does not exist.

- [ ] **Step 3: Implement route tables and pure helpers**

```js
const FORMATIONS = Object.freeze({
  calm: { battle: () => 1, elite: () => 1, boss: () => 1 },
  storm: {
    battle: (act, roll) => roll < (act === 0 ? 0.4 : 0.6) ? 2 : 1,
    elite: () => 2,
    boss: () => 1,
  },
  abyss: {
    battle: () => 2,
    elite: (_act, roll) => roll < 0.5 ? 3 : 2,
    boss: () => 1,
  },
});
```

Return fixed Canvas slots for 1, 2, and 3 enemies so rendering and drop hitboxes share one layout source. Use unique non-overlapping coordinates within the existing 1200×700 canvas.

- [ ] **Step 4: Run fleet tests and checks**

Run: `node --test tests/fleet-combat.test.js && node --check src/fleet-combat.js && git diff --check`

Expected: all fleet tests PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add index.html src/fleet-combat.js tests/fleet-combat.test.js
git commit -m "feat(combat): add route fleet formation rules"
```

---

### Task 4: Multi-Enemy Combat State and Enemy Turns

**Files:**
- Modify: `src/game.js:1015-1600`
- Create: `tests/fleet-integration.test.js`

**Interfaces:**
- Consumes `FleetCombat.enemyCount`, `statScale`, `rewardScale`, `attackBudget`, `livingEnemies`, and `isDefeated`.
- Produces combat state `{ enemies, focusedEnemyId, attackCursor, capturedCount, rewardGold, rewardInfamy }`.
- Produces `focusedEnemy()`, `findEnemy(enemyId)`, `enemyRange(enemyId)`, `setEnemyRange(enemyId, value)`, `startEnemyTurn()`, and `finishEnemyTurn()` in `game.js`.

- [ ] **Step 1: Write failing integration tests for squads, unique ships, and attack limits**

At the top of `tests/fleet-integration.test.js`, define local `runDeterministicEnemyTurn(options)` using `runGame()` and `read()` from the shared harness.

```js
test("심연 3척 정예전은 정예함 하나와 호위함 둘을 만든다", () => {
  const result = runGame(`
    run = makeTestRun({ mapId: "abyss", actIndex: 1 });
    Math.random = () => 0.1;
    startCombat("elite");
    ({ count: run.combat.enemies.length,
       eliteCount: run.combat.enemies.filter((enemy) => enemy.kind === "elite").length,
       uniqueNames: new Set(run.combat.enemies.map((enemy) => enemy.name)).size });
  `);
  assert.deepEqual(result, { count: 3, eliteCount: 1, uniqueNames: 3 });
});

test("폭풍 함대는 적 턴에 한 척만 직접 공격한다", () => {
  const result = runDeterministicEnemyTurn({ mapId: "storm", enemies: 2 });
  assert.equal(result.directAttackCount, 1);
  assert.equal(result.actions.length, 2);
});
```

- [ ] **Step 2: Run and confirm RED against the current single `combat.enemy` model**

Run: `node --test tests/fleet-integration.test.js`

Expected: FAIL because `run.combat.enemies` and fleet turns do not exist.

- [ ] **Step 3: Replace the single enemy with an array while retaining length-one boss behavior**

```js
run.combat = {
  enemies,
  focusedEnemyId: enemies[0].id,
  attackCursor: 0,
  capturedCount: 0,
  rewardGold: Math.round(baseGold * FleetCombat.rewardScale(enemies.length)),
  rewardInfamy: Math.round(baseInfamy * FleetCombat.rewardScale(enemies.length)),
  // existing wind, turn, evasion, skillReady, lock, log fields
};
```

Refactor every `run.combat.enemy` read through `focusedEnemy()` or an explicit loop. Give each enemy its own `range`, `intent`, `intentReady`, `captured`, and `defeated` state. A boarding success removes only the target from living enemies. Victory runs once when `FleetCombat.isDefeated(enemies)` becomes true. Add capture bonus per captured ship before the final route/artifact multiplier.

Enemy turn algorithm:

```js
const living = FleetCombat.livingEnemies(combat.enemies);
let attacksLeft = FleetCombat.attackBudget(run.mapId, living.length);
for (const enemy of rotateFromCursor(living, combat.attackCursor)) {
  const action = attacksLeft > 0 && canDirectAttack(enemy)
    ? performEnemyAttack(enemy)
    : performEnemyManeuverOrPrepare(enemy);
  if (action.directAttack) attacksLeft -= 1;
}
combat.attackCursor = (combat.attackCursor + 1) % Math.max(1, living.length);
```

- [ ] **Step 4: Run fleet integration plus existing tests**

Run: `node --test tests/fleet-combat.test.js tests/fleet-integration.test.js tests/ship-preview.test.js && node --check src/game.js`

Expected: fleet tests and ship preview PASS; syntax exits 0.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/game.js tests/fleet-integration.test.js
git commit -m "feat(combat): support multi-ship encounters"
```

---

### Task 5: Public Card Execution and Turn Timing

**Files:**
- Modify: `src/game.js:1252-1600`
- Create: `tests/card-combat.test.js`

**Interfaces:**
- Consumes `CardEngine`, `CardDefinitions`, and multi-enemy helpers from Task 4.
- Produces:
  - `cardUseError(instanceId, target): string | null`
  - `validTargets(instanceId): Array<{ type, id }>`
  - `playCard(instanceId, target): boolean`
  - `executePublicCard(cardId, target): CardResolution`
  - `endPlayerTurn(): void`
- `CardResolution`: `{ damageByEnemy, playerDamage, moraleDelta, cardsDrawn, combatEnded }`.

- [ ] **Step 1: Write failing tests for legality, one-turn/many-card flow, and all 21 public cards**

At the top of `tests/card-combat.test.js`, define local helpers `combatWithHand()`, `playNamed()`, `cardError()`, and `endTurn()` on top of the shared VM harness. Each helper must call the real `game.js` entry point rather than reimplementing card rules.

```js
test("카드 세 장을 사용해도 적은 턴 종료 전 행동하지 않는다", () => {
  const context = combatWithHand(["fire", "chain", "retreat"], 3);
  playNamed(context, "fire", "enemy-0");
  playNamed(context, "chain", "enemy-0");
  playNamed(context, "retreat", "sea");
  assert.equal(read(context, "run.combat.enemyActions"), 0);
  endTurn(context);
  assert.equal(read(context, "run.combat.enemyActions"), 1);
});

test("돛 0이면 접근·회피를 포인터와 키보드 경로 모두 거부한다", () => {
  const context = combatWithHand(["approach", "retreat"], 3, { sails: 0 });
  assert.match(cardError(context, "approach", "enemy-0"), /돛/);
  assert.match(cardError(context, "retreat", "sea"), /돛/);
  assert.equal(playNamed(context, "approach", "enemy-0"), false);
  assert.equal(read(context, "run.combat.cardState.energy"), 3);
});
```

Add table-driven assertions for every public ID, exact cost, target type, exhaustion, and numeric outcome from the spec, including `barrage_fire`, `chain_rain`, and `fireship` against three living enemies.

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/card-combat.test.js`

Expected: FAIL because `playCard()` and card-state integration do not exist.

- [ ] **Step 3: Initialize combat card state and dispatch public effects**

At voyage start set `run.deck = [...CardDefinitions.STARTER_DECK]` and `run.cardRemovals = 0`. At combat start call `CardEngine.createState(run.deck, Math.random, energyOptions())`.

The execution order must be atomic:

```js
function playCard(instanceId, target) {
  const error = cardUseError(instanceId, target);
  if (error) return false;
  const instance = findHandInstance(instanceId);
  const card = CardDefinitions.getCard(instance.cardId);
  CardEngine.spendForCard(run.combat.cardState, instanceId);
  const resolution = executePublicCard(card.id, target);
  CardEngine.finishCard(run.combat.cardState, instanceId, card.exhaust);
  applyResolution(resolution);
  recordCardUse(card, resolution);
  finishCardResolution();
  return true;
}
```

Do not call `enemyTurn()` from `playCard()`. Only `endPlayerTurn()` may schedule the fleet turn. For `allEnemies`, calculate all outcomes first, apply them in one batch, and call defeat/reward checks once.

- [ ] **Step 4: Run card and fleet regression tests**

Run: `node --test tests/card-engine.test.js tests/fleet-integration.test.js tests/card-combat.test.js && node --check src/game.js`

Expected: public card effects and turn timing PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add src/game.js tests/card-combat.test.js
git commit -m "feat(cards): execute public combat cards"
```

---

### Task 6: Captain Cards, Captain Skills, and Energy Synergies

**Files:**
- Modify: `src/game.js:240-390, 550-675, 1252-1600`
- Create: `tests/captain-card-combat.test.js`

**Interfaces:**
- Produces `executeCaptainCard(cardId, target)`, `captainSkillError(target)`, `useCaptainSkill(target)`, `getBoatswainModifiers()`, and `getEnergyModifiers()`.
- Adds crew role ID `boatswain` (갑판장) and trait IDs `frugal` and `rallying`.
- Adds artifact IDs `navigatorHourglass`, `brassCapacitor`, `smugglerPulley`, and `tyrantFleetSeal`.

- [ ] **Step 1: Write failing table-driven tests for all 28 captain cards and energy effects**

At the top of `tests/captain-card-combat.test.js`, define local helpers `combatForCaptain()`, `calculateEnergy()`, `crew()`, and `useSkill()` using the shared VM harness and real game entry points.

```js
test("다른 선장의 전용 카드는 실행할 수 없다", () => {
  const context = combatForCaptain("navigator", ["gunner_magazine_open"]);
  assert.match(cardError(context, "gunner_magazine_open", "enemy-0"), /선장 전용/);
});

test("에너지 유물과 갑판장의 최대 에너지는 4로 제한된다", () => {
  const modifiers = calculateEnergy({
    artifacts: ["tyrantFleetSeal"],
    crew: [crew("boatswain", "legendary")],
  });
  assert.equal(modifiers.maxEnergy, 4);
  assert.equal(modifiers.handSize, 4);
  assert.equal(modifiers.openingDrawBonus, 1);
});

test("선장 기술은 에너지를 쓰지 않고 두 번째 사용을 거부한다", () => {
  const context = combatForCaptain("gunner", ["fire"]);
  const before = read(context, "run.combat.cardState.energy");
  assert.equal(useSkill(context, "enemy-0"), true);
  assert.equal(read(context, "run.combat.cardState.energy"), before);
  assert.equal(useSkill(context, "enemy-0"), false);
});
```

Assert exact AoE values for the four captain fleet cards, morale/hull costs, exhaust behavior, navigator all-range effects, and Mystic/Revenant recovery caps.

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/captain-card-combat.test.js`

Expected: FAIL because exclusive effect dispatch and energy content are absent.

- [ ] **Step 3: Implement captain dispatch and capped energy hooks**

Use the strongest boatswain rarity only:

```js
function getBoatswainModifiers() {
  const boatswains = run.crew.filter((member) => member.roleId === "boatswain");
  const tier = Math.max(-1, ...boatswains.map((member) => RARITIES[member.rarityId]?.crewTier ?? 0));
  if (tier < 0) return { maxEnergy: 0, turnEnergy: {}, openingDraw: 0 };
  return [
    { maxEnergy: 0, turnEnergy: { 1: 1 }, openingDraw: 0 },
    { maxEnergy: 0, turnEnergy: { 1: 1 }, openingDraw: 1 },
    { maxEnergy: 0, turnEnergy: { 1: 1, 2: 1 }, openingDraw: 0 },
    { maxEnergy: 1, turnEnergy: {}, openingDraw: 1 },
  ][tier];
}
```

Implement `frugal` once per combat and `rallying` once per combat. Track per-turn `smugglerPulleyUsed`, per-combat trait-use flags, and turn number for `brassCapacitor`. Clamp persistent `maxEnergy` to 4; temporary bonuses may exceed it.

- [ ] **Step 4: Run captain, public card, and fleet tests**

Run: `node --test tests/captain-card-combat.test.js tests/card-combat.test.js tests/fleet-integration.test.js && node --check src/game.js`

Expected: all captain cards, skills, relics, role, and traits PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/game.js tests/captain-card-combat.test.js
git commit -m "feat(cards): add captain decks and energy synergies"
```

---

### Task 7: Card Rewards, Deck Inspection, and Paid Removal

**Files:**
- Modify: `index.html:66-184`
- Modify: `src/game.js:1-30, 700-900, 1599-1705, 1918-2005`
- Create: `tests/card-progression.test.js`

**Interfaces:**
- Produces `drawCardChoices(captainId, count, randomFn)`, `showCardReward(afterChoice)`, `acquireCard(cardId)`, `showDeck()`, `cardRemovalPrice()`, `showCardRemoval()`, and `removeCard(instanceOrIndex)`.
- Adds `#deckButton` with live text `덱 N장`.

- [ ] **Step 1: Write reward and removal tests**

At the top of `tests/card-progression.test.js`, define local helpers `deterministicChoices()`, `cardRemovalPriceFor()`, and `canRemoveFromDeck()` using the shared VM harness and real progression functions.

```js
test("보상 세 장은 중복이 없고 현재 선장 카드만 포함한다", () => {
  const choices = deterministicChoices("navigator", 3);
  assert.equal(new Set(choices.map((card) => card.id)).size, choices.length);
  assert.equal(choices.every((card) => !card.captainId || card.captainId === "navigator"), true);
});

test("카드 제거 비용은 12부터 8씩 오르고 덱 5장에서 중단된다", () => {
  assert.equal(cardRemovalPriceFor(0), 12);
  assert.equal(cardRemovalPriceFor(1), 20);
  assert.equal(cardRemovalPriceFor(2), 28);
  assert.equal(canRemoveFromDeck(new Array(5).fill("fire")), false);
});
```

Test victory sequence `stats → card choice/skip → artifact for elite/boss → return/act completion`, and verify one reward per fleet rather than per enemy.

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/card-progression.test.js`

Expected: FAIL because progression helpers do not exist.

- [ ] **Step 3: Implement weighted candidates and modal flows**

Use `CardDefinitions.CARD_RARITY_WEIGHTS`, select a rarity from remaining candidates, renormalize after filtering, and remove selected candidates so the three options are unique. Duplicate ownership does not exclude a candidate.

```js
function cardRemovalPrice() {
  return 12 + run.cardRemovals * 8;
}

function canRemoveCard() {
  return run.deck.length > 5 && run.gold >= cardRemovalPrice();
}
```

The deck button is always available during a voyage for inspection, but removal controls appear only inside the port removal service or an explicit event. Confirm before mutation, charge once, increment `run.cardRemovals`, update HUD, analytics, and log.

- [ ] **Step 4: Run progression and reward regressions**

Run: `node --test tests/card-progression.test.js tests/card-definitions.test.js tests/fleet-integration.test.js && node --check src/game.js`

Expected: reward and deck-management tests PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add index.html src/game.js tests/card-progression.test.js
git commit -m "feat(cards): add card rewards and deck removal"
```

---

### Task 8: Multi-Enemy Canvas Rendering and Target Geometry

**Files:**
- Modify: `src/game.js:2522-2715`
- Create: `tests/combat-rendering.test.js`

**Interfaces:**
- Consumes `FleetCombat.layoutSlots(count)`.
- Produces `enemyRenderLayout(): Array<{ enemyId, x, y, scale, hitBox }>` and `combatDropTargets(): Array<DropTarget>`.
- `DropTarget`: `{ type: "enemy"|"self"|"sea"|"allEnemies", id: string, rect: { left, top, right, bottom } }` in canvas CSS coordinates.

- [ ] **Step 1: Write rendering-layout tests without pixel snapshots**

At the top of `tests/combat-rendering.test.js`, define local helpers `renderLayoutFor()`, `isInsideCanvas()`, `anyOverlap()`, and `dropTargetsFor()` using the shared Canvas stubs and real render-layout functions.

```js
test("세 적의 HUD와 드롭 영역은 캔버스 안에서 겹치지 않는다", () => {
  const layout = renderLayoutFor(3);
  assert.equal(layout.length, 3);
  layout.forEach(({ hitBox }) => assert.equal(isInsideCanvas(hitBox, 1200, 700), true));
  assert.equal(anyOverlap(layout.map((item) => item.hitBox)), false);
});

test("격파된 적은 드롭 대상에서 제외된다", () => {
  const targets = dropTargetsFor([
    enemyState("e0", { hull: 0 }),
    enemyState("e1", { hull: 10 }),
  ]);
  assert.deepEqual(targets.filter((target) => target.type === "enemy").map((target) => target.id), ["e1"]);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/combat-rendering.test.js`

Expected: FAIL because multi-enemy layout helpers do not exist.

- [ ] **Step 3: Render each living enemy and its intent from shared layout data**

Refactor `drawCombat()` to loop over `enemyRenderLayout()`. Draw a compact HUD, individual range, intent icon/text, and focus/valid-drop highlight for each ship. Boss length-one rendering must retain its current image phase logic and scale. Convert pointer client coordinates to canvas coordinates using `getBoundingClientRect()` ratios before hit testing.

- [ ] **Step 4: Run layout and ship-image tests**

Run: `node --test tests/combat-rendering.test.js tests/ship-preview.test.js && node --check src/game.js`

Expected: layout and existing image regression PASS.

- [ ] **Step 5: Commit Task 8**

```bash
git add src/game.js tests/combat-rendering.test.js
git commit -m "feat(combat): render enemy fleets and intents"
```

---

### Task 9: Bottom Hand UI, Drag/Drop, Animation, and Keyboard Targeting

**Files:**
- Modify: `src/game.js:1563-1600, 2746-2770`
- Modify: `styles.css:300-360, 1180-1470`
- Create: `tests/card-ui.test.js`

**Interfaces:**
- Consumes `validTargets`, `playCard`, `combatDropTargets`, and `CardEngine` state.
- Produces `renderCombatHand()`, `beginCardDrag(event, instanceId)`, `updateCardDrag(event)`, `finishCardDrag(event)`, `cancelCardDrag(reason)`, `selectCardByIndex(index)`, `moveTargetFocus(direction)`, and `confirmKeyboardCard()`.
- Drag state: `{ instanceId, pointerId, originRect, currentTarget, executionToken, phase }` where phase is `idle|dragging|flying|returning`.

- [ ] **Step 1: Write DOM-stub tests for semantic cards and input state**

At the top of `tests/card-ui.test.js`, define local helpers `renderHandWith()` and `enemyCenter()` using the shared DOM/Canvas stubs. The returned controller may expose test-driver methods, but all state transitions must go through the production pointer/keyboard handlers.

```js
test("유효한 적 드롭은 한 번만 카드를 실행한다", () => {
  const ui = renderHandWith(["fire"], { enemies: 2, energy: 3 });
  ui.pointerDown(0, { pointerId: 7 });
  ui.pointerMove(enemyCenter("enemy-1"));
  ui.pointerUp(enemyCenter("enemy-1"));
  ui.finishAnimationTwice();
  assert.equal(ui.playCalls.length, 1);
  assert.equal(ui.playCalls[0].target.id, "enemy-1");
});

test("잘못된 드롭은 손패와 에너지를 보존한다", () => {
  const ui = renderHandWith(["repair"], { energy: 3 });
  ui.dragTo(enemyCenter("enemy-0"));
  assert.equal(ui.energy, 3);
  assert.deepEqual(ui.handCardIds, ["repair"]);
  assert.equal(ui.dragPhase, "returning");
});
```

Test number selection, target cycling, Enter confirmation, Escape cancellation, `Q`, `E`, disabled reason text, pointer cancellation, combat lock, and reduced-motion class selection.

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/card-ui.test.js`

Expected: FAIL because hand and drag controllers do not exist.

- [ ] **Step 3: Build the approved bottom-hand DOM and Pointer Events controller**

```js
cardButton.addEventListener("pointerdown", (event) => beginCardDrag(event, instance.instanceId));
cardButton.addEventListener("pointermove", updateCardDrag);
cardButton.addEventListener("pointerup", finishCardDrag);
cardButton.addEventListener("pointercancel", () => cancelCardDrag("pointercancel"));
```

Use `setPointerCapture()`. During drag, set `data-target-valid` only on targets returned by `validTargets()`. On valid release, add `.is-flying`, wait for `animationend` with a 300ms fallback timeout, then call one token-guarded execution. On invalid release, add `.is-returning` and do not mutate combat state.

Use real buttons for cards, captain skill, turn end, deck/discard/exhaust counts, and visible disabled-reason text. Cards show cost, name, family, numeric description, rarity, and `소멸` when applicable.

- [ ] **Step 4: Add responsive and reduced-motion CSS, then run tests**

```css
@media (prefers-reduced-motion: reduce) {
  .combat-card,
  .combat-card.is-dragging,
  .combat-card.is-flying,
  .combat-card.is-returning {
    animation: none;
    transition-duration: 1ms;
    transform: none;
  }
}

@media (max-width: 620px) {
  .combat-hand { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .combat-hand .combat-card:last-child:nth-child(odd) { grid-column: 1 / -1; }
}
```

Run: `node --test tests/card-ui.test.js tests/card-combat.test.js tests/combat-rendering.test.js && node --check src/game.js && git diff --check`

Expected: all UI/unit tests PASS and checks exit 0.

- [ ] **Step 5: Commit Task 9**

```bash
git add src/game.js styles.css tests/card-ui.test.js
git commit -m "feat(cards): add animated drag-to-target hand UI"
```

---

### Task 10: Analytics, Documentation, and Full Browser Verification

**Files:**
- Modify: `src/analytics.js:11-240`
- Modify: `src/game.js:1430-1450, 1599-1642, 2050-2285`
- Modify: `README.md:19-91`
- Create: `tests/analytics-cards.test.js`

**Interfaces:**
- Extends Analytics with:
  - `recordCardUse(cardId, family, energy, targetCount)`
  - `recordCardAcquired(cardId)`
  - `recordCardRemoved(cardId)`
  - `recordPlayerTurn()`
  - `recordFleet(enemyCount, defeatedCount, capturedCount)`
- `endRun(summary)` accepts `finalDeck: string[]`.
- Old records with none of these fields remain readable by `getSummary()` and stats UI.

- [ ] **Step 1: Write backward-compatibility and new-field tests**

At the top of `tests/analytics-cards.test.js`, define local `seedRuns()` and `makeSummary()` helpers around the analytics storage stub from `loadGameScripts()`.

```js
test("이전 분석 기록과 카드 기록을 함께 요약한다", () => {
  seedRuns([{ captainId: "gunner", actionCounts: { fire: 2 } }]);
  Analytics.startRun("navigator", "storm");
  Analytics.recordCardUse("barrage_fire", "fire", 2, 2);
  Analytics.recordCardAcquired("navigator_storm_corridor");
  Analytics.recordFleet(2, 2, 1);
  Analytics.endRun(makeSummary({ finalDeck: ["fire", "barrage_fire"] }));
  const runs = Analytics.getAllRuns();
  assert.equal(runs.length, 2);
  assert.equal(runs[1].cardUses.barrage_fire, 1);
  assert.deepEqual(runs[1].finalDeck, ["fire", "barrage_fire"]);
  assert.equal(Analytics.getSummary().actionTotals.fire, 3);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/analytics-cards.test.js`

Expected: FAIL because card/fleet analytics methods are missing.

- [ ] **Step 3: Add optional analytics fields and update README controls**

Initialize new runs with empty serializable fields, guard every read with fallbacks, and map card families back into existing `actionCounts`. Record one fleet encounter per combat and update captured totals by count rather than boolean.

README must document:

```markdown
- 카드 선택: `1`~`8`, 대상 이동: 방향키/Tab, 사용: `Enter`, 취소: `Escape`
- 선장 기술: `Q`, 턴 종료: `E`
- 마우스·터치에서는 카드를 함선 또는 바다의 강조된 대상 영역으로 드래그합니다.
- 폭풍의 사각지대 일반·정예전은 최대 2척, 심연의 마지막 항로는 최대 3척이 등장하며 보스는 1척입니다.
```

- [ ] **Step 4: Run the complete automated suite**

Run: `node --test tests/*.test.js && node --check src/analytics.js && node --check src/card-definitions.js && node --check src/card-engine.js && node --check src/fleet-combat.js && node --check src/game.js && git diff --check`

Expected: every test passes, every syntax check exits 0, and `git diff --check` has no output.

- [ ] **Step 5: Verify the real game in a browser at desktop and 320px**

Run: `python3 -m http.server 5192`

Verify all of these in the in-app browser:

1. Start Calm and confirm one enemy, 5-card hand, energy 3, and captain skill separate.
2. Play three 1-cost cards by dragging to `enemy`, `self`, and `sea` targets; confirm no enemy action before `턴 종료`.
3. End turn and confirm exactly the allowed enemy fleet actions, energy reset, discard, and five-card redraw.
4. Use an `allEnemies` card in a forced Storm/Abyss test state and confirm every living enemy is hit once.
5. Attempt an invalid drop and confirm the card returns without spending energy.
6. Use `1`–`8`, target navigation, Enter, Escape, `Q`, and `E`.
7. Win a battle, acquire/skip a card, then verify elite/boss artifact sequencing.
8. Inspect the deck, buy one removal at port, verify price 12→20 and minimum size 5.
9. Confirm Storm/Abyss fleet layouts, individual ranges, intents, focus, no duplicate ships, and single-ship bosses.
10. At 320px confirm two-column cards and no clipped tooltips, controls, ships, or targets.
11. Emulate reduced motion and confirm no flight/return animation while effects still resolve once.
12. Confirm browser console has no errors.

- [ ] **Step 6: Commit Task 10 after fresh verification**

```bash
git add README.md src/analytics.js src/game.js tests/analytics-cards.test.js
git commit -m "feat(cards): record and document card combat runs"
```

---

## Final Review Gate

- Run `node --test tests/*.test.js` and report the exact pass/fail count.
- Run all five `node --check` commands and `git diff --check` again after the final commit.
- Use `superpowers:requesting-code-review` for a read-only review against the approved spec.
- Fix every Critical or Important finding with a new RED/GREEN cycle.
- Use `superpowers:verification-before-completion` before claiming completion.
- Then use `superpowers:finishing-a-development-branch` to choose merge/PR/keep/discard with the user.
