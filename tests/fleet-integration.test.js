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
