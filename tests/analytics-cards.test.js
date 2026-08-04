"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGameScripts, read } = require("./helpers/load-game.js");

let storedRuns = [];
const context = loadGameScripts(["src/analytics.js"], {
  localStorage: {
    getItem() { return JSON.stringify(storedRuns); },
    removeItem() { storedRuns = []; },
    setItem(_key, value) { storedRuns = JSON.parse(value); },
  },
});
const Analytics = read(context, "Analytics");

function seedRuns(runs) {
  storedRuns = JSON.parse(JSON.stringify(runs));
}

function makeSummary(overrides = {}) {
  return {
    victory: false,
    deathCause: "hull",
    act: 1,
    infamy: 20,
    gold: 8,
    hull: 0,
    maxHull: 42,
    crew: 2,
    artifacts: 1,
    travelCount: 4,
    ...overrides,
  };
}

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
  assert.deepEqual(Array.from(runs[1].finalDeck), ["fire", "barrage_fire"]);
  assert.equal(Analytics.getSummary().actionTotals.fire, 3);
});

test("카드 진행과 에너지, 대상, 턴, 함대 결과를 직렬화한다", () => {
  seedRuns([]);
  Analytics.startRun("mystic", "abyss");
  Analytics.recordCardUse("mystic_open_abyss", "fire", 3, 1);
  Analytics.recordCardUse("mystic_abyss_chorus", "fire", 3, 3);
  Analytics.recordCardAcquired("mystic_open_abyss");
  Analytics.recordCardRemoved("fire");
  Analytics.recordCombatStart();
  Analytics.recordPlayerTurn();
  Analytics.recordPlayerTurn();
  Analytics.recordFleet(3, 2, 1);
  Analytics.endRun(makeSummary());

  const run = Analytics.getAllRuns()[0];
  assert.deepEqual({ ...run.cardUses }, { mystic_open_abyss: 1, mystic_abyss_chorus: 1 });
  assert.deepEqual(Array.from(run.cardsAcquired), ["mystic_open_abyss"]);
  assert.deepEqual(Array.from(run.cardsRemoved), ["fire"]);
  assert.equal(run.energySpent, 6);
  assert.equal(run.cardTargetCount, 4);
  assert.equal(run.playerTurns, 2);
  assert.deepEqual(Array.from(run.playerTurnsByCombat), [2]);
  assert.equal(run.eventCounts["card_acquired:mystic_open_abyss"], undefined);
  assert.equal(run.eventCounts["card_removed:fire"], undefined);
  assert.deepEqual(Array.from(run.fleets, (fleet) => ({ ...fleet })), [
    { enemyCount: 3, defeatedCount: 2, capturedCount: 1 },
  ]);
});

function makeCombatContext(cardIds = ["fire"]) {
  const game = loadGameScripts([
    "src/analytics.js",
    "src/card-definitions.js",
    "src/card-engine.js",
    "src/fleet-combat.js",
    "src/game.js",
  ]);
  read(game, `
    run = makeTestRun({
      mapId: "calm", captainId: "gunner", artifacts: [], crew: [], logs: [],
      cannons: 6, repairKits: 2, hull: 50, maxHull: 100, sails: 10,
      maxSails: 20, morale: 20, safetyNetCharges: 0,
      deck: ${JSON.stringify(cardIds)}, cardRemovals: 0,
    });
    Math.random = () => 0;
    startCombat("battle");
    run.combat.enemies[0].hull = 100;
    run.combat.enemies[0].maxHull = 100;
    run.combat.enemies[0].sails = 30;
    run.combat.enemies[0].maxSails = 30;
    run.combat.enemies[0].crew = 20;
    run.combat.enemies[0].maxCrew = 20;
    run.combat.cardState = CardEngine.createState(run.deck, () => 0, {
      maxEnergy: 3, handSize: ${cardIds.length}, handLimit: 8,
    });
  `);
  return game;
}

test("실제 카드 사용과 시작한 플레이어 턴이 분석 인자를 기록한다", () => {
  const game = makeCombatContext(["aimed_fire"]);
  const result = JSON.parse(read(game, `JSON.stringify((() => {
    const recorded = { cards: [], turns: 0 };
    Analytics.recordCardUse = (...args) => recorded.cards.push(args);
    Analytics.recordPlayerTurn = () => { recorded.turns += 1; };
    startCombat("battle");
    const instance = run.combat.cardState.hand[0];
    instance.costDelta = -1;
    playCard(instance.instanceId, "enemy-0");
    return recorded;
  })())`));

  assert.deepEqual(result, { cards: [["aimed_fire", null, 1, 1]], turns: 1 });
});

test("광역 카드가 빗나간 적은 적중 대상 수에 포함하지 않는다", () => {
  const game = makeCombatContext(["barrage_fire"]);
  const result = JSON.parse(read(game, `JSON.stringify((() => {
    let recorded = null;
    Analytics.recordCardUse = (...args) => { recorded = args; };
    Math.random = () => 0.99;
    const instance = run.combat.cardState.hand[0];
    playCard(instance.instanceId, "allEnemies");
    return recorded;
  })())`));

  assert.deepEqual(result, ["barrage_fire", null, 2, 0]);
});

test("전투 결과는 함대당 한 번 기록하고 항해 종료 덱을 넘긴다", () => {
  const game = makeCombatContext(["fire", "chain", "repair", "retreat", "board"]);
  const result = JSON.parse(read(game, `JSON.stringify((() => {
    const recorded = { combatEnds: [], fleets: [], finalDeck: null };
    Analytics.recordCombatEnd = (...args) => recorded.combatEnds.push(args);
    Analytics.recordFleet = (...args) => recorded.fleets.push(args);
    Analytics.endRun = (summary) => { recorded.finalDeck = summary.finalDeck; };
    run.combat.enemies[0].captured = true;
    run.combat.capturedCount = 1;
    run.combat.enemies[0].hull = 0;
    winCombat();
    finishRun("테스트 종료", false);
    return recorded;
  })())`));

  assert.deepEqual(result.combatEnds, [[true, 1]]);
  assert.deepEqual(result.fleets, [[1, 0, 1]]);
  assert.deepEqual(result.finalDeck, ["fire", "chain", "repair", "retreat", "board"]);
});
