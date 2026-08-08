"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

function loadGame() {
  return loadGameScripts(["src/analytics.js", "src/card-definitions.js", "src/fleet-combat.js", "src/game.js"]);
}

function setupCombat(context, overrides = "") {
  read(context, `
    Math.random = () => 0;
    run = makeTestRun({ mode: "combat", captainId: "gunner", actIndex: 0, hull: 40, maxHull: 40, crew: [], logs: [], artifacts: [] });
    run.combat = {
      enemies: [enemyState({ range: 2, damage: 10 })],
      evasion: 0,
      block: 0,
      nextEnemyAttackReduction: 0,
      ${overrides}
    };
  `);
}

test("방어막은 적 공격 피해를 먼저 흡수하고 남은 만큼만 선체에 적용한다", () => {
  const context = loadGame();
  setupCombat(context, "block: 6,");
  read(context, `
    performEnemyAttack(run.combat.enemies[0]);
  `);
  const hull = JSON.parse(read(context, "JSON.stringify(run.hull)"));
  const block = JSON.parse(read(context, "JSON.stringify(run.combat.block)"));

  assert.equal(hull, 36, "피해 10 중 6은 흡수되고 4만 선체에 적용되어야 한다");
  assert.equal(block, 0, "흡수에 사용된 방어막은 소모되어야 한다");
});

test("방어막이 피해보다 많으면 초과분이 남고 선체는 그대로다", () => {
  const context = loadGame();
  setupCombat(context, "block: 20,");
  read(context, `
    performEnemyAttack(run.combat.enemies[0]);
  `);
  const hull = JSON.parse(read(context, "JSON.stringify(run.hull)"));
  const block = JSON.parse(read(context, "JSON.stringify(run.combat.block)"));

  assert.equal(hull, 40, "피해 10보다 방어막 20이 많으므로 선체는 그대로여야 한다");
  assert.equal(block, 10, "방어막 20 중 10만 소모되고 10이 남아야 한다");
});

test("방어막 없이 맞으면 기존처럼 전액 선체 피해로 들어간다", () => {
  const context = loadGame();
  setupCombat(context);
  read(context, `
    performEnemyAttack(run.combat.enemies[0]);
  `);
  const hull = JSON.parse(read(context, "JSON.stringify(run.hull)"));

  assert.equal(hull, 30, "방어막이 없으면 피해 10이 전부 선체에 들어가야 한다");
});

test("방벽 전개 카드는 방어막을 8 얻고, 중복 사용 시 누적된다", () => {
  const context = loadGame();
  setupCombat(context);
  read(context, `
    executePublicCard("brace_hull", { type: "self", id: "self" });
    executePublicCard("brace_hull", { type: "self", id: "self" });
  `);
  const block = JSON.parse(read(context, "JSON.stringify(run.combat.block)"));

  assert.equal(block, 16, "카드를 두 번 쓰면 방어막이 8씩 누적되어 16이어야 한다");
});

test("적 턴이 끝나면 남은 방어막은 사용 여부와 관계없이 초기화된다", () => {
  const context = loadGame();
  setupCombat(context, "block: 20, attackCursor: 0, pendingEnemyTurn: { actions: [] }, turn: 1, enemyActions: 0,");
  read(context, `finishEnemyTurn();`);
  const block = JSON.parse(read(context, "JSON.stringify(run.combat.block)"));

  assert.equal(block, 0, "한 턴만 지속되므로 다음 플레이어 턴으로 남은 방어막이 이월되면 안 된다");
});
