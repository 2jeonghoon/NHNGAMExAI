"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read, runGame } = require("./helpers/load-game.js");

const fleetContext = loadGameScripts(["src/fleet-combat.js"]);
const fleetCombat = read(fleetContext, "FleetCombat");

function runFleetGame(source, overrides = {}) {
  return runGame(source, { FleetCombat: fleetCombat, ...overrides });
}

function runDeterministicEnemyTurn({ mapId, enemies }) {
  return runFleetGame(`
    run = makeTestRun({
      mapId: ${JSON.stringify(mapId)},
      actIndex: 1,
      crew: [],
      artifacts: [],
      logs: [],
      cannons: 6,
      repairKits: 2,
      infamy: 0,
    });
    Math.random = () => 0.1;
    startCombat(${JSON.stringify(enemies === 1 ? "battle" : "elite")});
    if (run.combat.enemies.length !== ${enemies}) {
      throw new Error(\`expected ${enemies} enemies, got \${run.combat.enemies.length}\`);
    }
    run.combat.enemies.forEach((enemy) => { enemy.range = 2; });
    const actions = startEnemyTurn();
    ({
      actions,
      directAttackCount: actions.filter((action) => action.directAttack).length,
    });
  `);
}

test("심연 3척 정예전은 정예함 하나와 호위함 둘을 만든다", () => {
  const result = runFleetGame(`
    run = makeTestRun({ mapId: "abyss", actIndex: 1, artifacts: [], crew: [], logs: [], repairKits: 2, infamy: 0, cannons: 6 });
    Math.random = () => 0.1;
    startCombat("elite");
    ({ count: run.combat.enemies.length,
       eliteCount: run.combat.enemies.filter((enemy) => enemy.kind === "elite").length,
       uniqueNames: new Set(run.combat.enemies.map((enemy) => enemy.name)).size,
       uniqueImages: new Set(run.combat.enemies.map((enemy) => enemy.shipImages[0])).size });
  `);

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    { count: 3, eliteCount: 1, uniqueNames: 3, uniqueImages: 3 },
  );
});

test("다중 편성은 함선 능력치와 전투 전체 보상을 편성 크기로 조정한다", () => {
  const result = runFleetGame(`
    run = makeTestRun({ mapId: "storm", actIndex: 0, artifacts: [], crew: [], logs: [], repairKits: 2, infamy: 0, cannons: 6 });
    Math.random = () => 0.1;
    startCombat("elite");
    ({
      enemyStats: run.combat.enemies.map(({ hull, sails, crew, damage }) => ({ hull, sails, crew, damage })),
      rewardGold: run.combat.rewardGold,
      rewardInfamy: run.combat.rewardInfamy,
    });
  `);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    enemyStats: [
      { hull: 26, sails: 13, crew: 10, damage: 5 },
      { hull: 16, sails: 10, crew: 7, damage: 3 },
    ],
    rewardGold: 25,
    rewardInfamy: 19,
  });
});

test("보스전은 항로와 무관하게 한 척으로 유지된다", () => {
  const result = runFleetGame(`
    run = makeTestRun({ mapId: "abyss", actIndex: 2, artifacts: [], crew: [], logs: [], repairKits: 2, infamy: 0, cannons: 6 });
    Math.random = () => 0.1;
    startCombat("boss");
    ({ count: run.combat.enemies.length, kind: run.combat.enemies[0].kind });
  `);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), { count: 1, kind: "boss" });
});

test("폭풍 함대는 적 턴에 한 척만 직접 공격한다", () => {
  const result = runDeterministicEnemyTurn({ mapId: "storm", enemies: 2 });
  assert.equal(result.directAttackCount, 1);
  assert.equal(result.actions.length, 2);
});

test("심연 함대는 적 턴에 최대 두 척만 직접 공격한다", () => {
  const result = runDeterministicEnemyTurn({ mapId: "abyss", enemies: 3 });
  assert.equal(result.directAttackCount, 2);
  assert.equal(result.actions.length, 3);
});

test("한 척을 나포해도 남은 적이 있으면 승리를 예약하지 않는다", () => {
  const result = runFleetGame(`
    run = makeTestRun({
      mapId: "storm", actIndex: 0, artifacts: [], crew: [], logs: [],
      repairKits: 2, infamy: 0, cannons: 6,
    });
    Math.random = () => 0.1;
    startCombat("elite");
    const scheduledCallbacks = [];
    setTimeout = (callback) => scheduledCallbacks.push(callback);
    const target = focusedEnemy();
    target.range = 1;
    target.sails = 0;
    combatAction("board");
    ({
      capturedCount: run.combat.capturedCount,
      livingIds: FleetCombat.livingEnemies(run.combat.enemies).map((enemy) => enemy.id),
      focusedEnemyId: focusedEnemy().id,
      victoryScheduled: run.combat.victoryScheduled,
      victoryCallbackCount: scheduledCallbacks.filter((callback) => callback === winCombat).length,
    });
  `);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    capturedCount: 1,
    livingIds: ["enemy-1"],
    focusedEnemyId: "enemy-1",
    victoryScheduled: false,
    victoryCallbackCount: 0,
  });
});

test("마지막 적을 나포하면 승리를 정확히 한 번만 예약한다", () => {
  const result = runFleetGame(`
    run = makeTestRun({
      mapId: "storm", actIndex: 0, artifacts: [], crew: [], logs: [],
      repairKits: 2, infamy: 0, cannons: 6,
    });
    Math.random = () => 0.1;
    startCombat("elite");
    const scheduledCallbacks = [];
    setTimeout = (callback) => scheduledCallbacks.push(callback);
    let target = focusedEnemy();
    target.range = 1;
    target.sails = 0;
    combatAction("board");
    run.combat.locked = false;
    target = focusedEnemy();
    target.range = 1;
    target.sails = 0;
    combatAction("board");
    run.combat.locked = false;
    combatAction("fire");
    ({
      capturedCount: run.combat.capturedCount,
      fleetDefeated: FleetCombat.isDefeated(run.combat.enemies),
      victoryScheduled: run.combat.victoryScheduled,
      victoryCallbackCount: scheduledCallbacks.filter((callback) => callback === winCombat).length,
    });
  `);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    capturedCount: 2,
    fleetDefeated: true,
    victoryScheduled: true,
    victoryCallbackCount: 1,
  });
});

test("함선별 나포 보너스는 항로와 유물 배율 전에 합산한다", () => {
  const result = runFleetGame(`
    run = makeTestRun({
      mapId: "storm", actIndex: 0, enemyMultiplier: 1, rewardMultiplier: 2,
      artifacts: [{ id: "kingsRansom" }, { id: "map" }], crew: [], logs: [],
      repairKits: 2, infamy: 0, cannons: 6, gold: 0,
    });
    Math.random = () => 0.1;
    startCombat("elite");
    run.combat.capturedCount = 2;
    run.combat.enemies.forEach((enemy) => { enemy.captured = true; });
    winCombat();
    ({ gold: run.gold, infamy: run.infamy });
  `);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), { gold: 160, infamy: 87 });
});

test("연속 적 턴의 직접 공격자는 함대 순서대로 순환한다", () => {
  const result = runFleetGame(`
    run = makeTestRun({
      mapId: "storm", actIndex: 0, artifacts: [], crew: [], logs: [],
      repairKits: 2, infamy: 0, cannons: 6, hull: 100, maxHull: 100,
    });
    Math.random = () => 0.1;
    startCombat("elite");
    run.combat.enemies.forEach((enemy) => { enemy.range = 2; });
    Math.random = () => 0.9;
    const firstActions = startEnemyTurn();
    const secondActions = startEnemyTurn();
    [firstActions, secondActions].map((actions) => (
      actions.find((action) => action.directAttack).enemyId
    ));
  `);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), ["enemy-0", "enemy-1"]);
});

test("첫 적 행동으로 사기가 0이 되면 남은 함대 행동을 즉시 중단한다", () => {
  const result = runFleetGame(`
    run = makeTestRun({
      mapId: "abyss", actIndex: 1, artifacts: [], crew: [], logs: [], repairKits: 2,
      infamy: 0, cannons: 6, hull: 100, maxHull: 100, morale: 2, safetyNetCharges: 0,
    });
    Math.random = () => 0.1;
    startCombat("elite");
    run.morale = 2;
    run.combat.enemies.forEach((enemy) => { enemy.range = 2; enemy.damage = 1; });
    const actions = startEnemyTurn();
    ({ actions: actions.length, mode: run.mode, deathCause: run.deathCause });
  `);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { actions: 1, mode: "gameover", deathCause: "morale" });
});

test("구사일생이 첫 선체 치명타를 막으면 남은 함대 행동을 계속한다", () => {
  const result = runFleetGame(`
    run = makeTestRun({
      mapId: "abyss", actIndex: 1, artifacts: [], crew: [], logs: [], repairKits: 2,
      infamy: 0, cannons: 6, hull: 1, maxHull: 100, morale: 50, safetyNetCharges: 1,
    });
    Math.random = () => 0.1;
    startCombat("elite");
    run.hull = 1;
    run.morale = 50;
    run.safetyNetCharges = 1;
    run.combat.enemies.forEach((enemy) => { enemy.range = 2; enemy.damage = 1; });
    const actions = startEnemyTurn();
    ({ actions: actions.length, safetyNetCharges: run.safetyNetCharges, deathCause: run.deathCause || null });
  `);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { actions: 2, safetyNetCharges: 0, deathCause: "hull" });
});
