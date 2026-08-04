"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

function loadFleetCombat() {
  const context = loadGameScripts(["src/fleet-combat.js"]);
  return read(context, "FleetCombat");
}

test("항로와 노드별 적 수가 승인 범위를 따른다", () => {
  const FleetCombat = loadFleetCombat();

  assert.equal(FleetCombat.enemyCount("calm", "battle", 2, () => 0), 1);
  assert.equal(FleetCombat.enemyCount("storm", "battle", 0, () => 0.39), 2);
  assert.equal(FleetCombat.enemyCount("storm", "battle", 0, () => 0.41), 1);
  assert.equal(FleetCombat.enemyCount("storm", "battle", 2, () => 0.59), 2);
  assert.equal(FleetCombat.enemyCount("abyss", "battle", 0, () => 0.99), 2);
  assert.equal(FleetCombat.enemyCount("abyss", "elite", 2, () => 0.49), 3);
  assert.equal(FleetCombat.enemyCount("abyss", "boss", 2, () => 0), 1);
});

test("편성 배율과 공격 예산을 제한한다", () => {
  const FleetCombat = loadFleetCombat();

  assert.equal(FleetCombat.statScale(1), 1);
  assert.equal(FleetCombat.statScale(2), 0.65);
  assert.equal(FleetCombat.statScale(3), 0.5);
  assert.equal(FleetCombat.rewardScale(1), 1);
  assert.equal(FleetCombat.rewardScale(2), 1.25);
  assert.equal(FleetCombat.rewardScale(3), 1.5);
  assert.equal(FleetCombat.attackBudget("storm", 3), 1);
  assert.equal(FleetCombat.attackBudget("abyss", 3), 2);
  assert.equal(FleetCombat.attackBudget("abyss", 1), 1);
  assert.equal(FleetCombat.attackBudget("storm", 0), 0);
});

test("격파 또는 나포된 함선은 살아 있는 대상에서 제외한다", () => {
  const FleetCombat = loadFleetCombat();
  const active = { id: "active", defeated: false, captured: false };
  const enemies = [
    active,
    { id: "defeated", defeated: true, captured: false },
    { id: "captured", defeated: false, captured: true },
  ];

  assert.deepEqual(Array.from(FleetCombat.livingEnemies(enemies)), [active]);
  assert.equal(FleetCombat.isDefeated(enemies), false);
  active.defeated = true;
  assert.equal(FleetCombat.isDefeated(enemies), true);
});

test("편성 슬롯은 함대 크기별로 고정되고 캔버스 안에서 겹치지 않는다", () => {
  const FleetCombat = loadFleetCombat();
  const expected = {
    1: [{ x: 900, y: 450, scale: 1.42 }],
    2: [{ x: 750, y: 360, scale: 0.95 }, { x: 1040, y: 500, scale: 0.95 }],
    3: [
      { x: 740, y: 275, scale: 0.72 },
      { x: 1045, y: 380, scale: 0.72 },
      { x: 780, y: 540, scale: 0.72 },
    ],
  };

  for (const count of [1, 2, 3]) {
    const slots = FleetCombat.layoutSlots(count);
    assert.deepEqual(JSON.parse(JSON.stringify(slots)), expected[count]);
    assert.equal(new Set(slots.map(({ x, y }) => `${x}:${y}`)).size, count);
    slots.forEach(({ x, y }) => {
      assert.equal(x >= 0 && x <= 1200 && y >= 0 && y <= 700, true);
    });
  }
});
