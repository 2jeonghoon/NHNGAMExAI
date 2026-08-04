"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadGameScripts, makeElement } = require("./helpers/load-game.js");

function enemyState(id, overrides = {}) {
  return {
    id,
    captured: false,
    crew: 8,
    defeated: false,
    distance: 2,
    hull: 24,
    intent: "attack",
    kind: "battle",
    maxCrew: 8,
    maxHull: 24,
    maxSails: 16,
    name: id,
    range: 2,
    sails: 16,
    shipImages: [`${id}.png`],
    ...overrides,
  };
}

function combatContext(enemies, canvasOverrides = {}) {
  const context2d = new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = () => {};
      return target[property];
    },
  });
  const canvas = {
    ...makeElement(),
    height: 700,
    width: 1200,
    getBoundingClientRect() {
      return { bottom: 700, height: 700, left: 0, right: 1200, top: 0, width: 1200 };
    },
    getContext() { return context2d; },
    ...canvasOverrides,
  };
  const context = loadGameScripts(["src/fleet-combat.js", "src/game.js"], { canvas });
  vm.runInContext(`
    run = makeTestRun({
      actIndex: 0,
      combat: {
        enemies: ${JSON.stringify(enemies)},
        focusedEnemyId: ${JSON.stringify(enemies[0]?.id || null)},
        turn: 1,
        wind: { direction: "순풍", speed: 2 },
      },
      crew: [],
      mapId: "calm",
    });
  `, context);
  return context;
}

function renderLayoutFor(count) {
  const enemies = Array.from({ length: count }, (_, index) => enemyState(`e${index}`));
  const context = combatContext(enemies);
  return JSON.parse(vm.runInContext("JSON.stringify(enemyRenderLayout())", context));
}

function isInsideCanvas(rect, width, height) {
  return rect.left >= 0 && rect.top >= 0 && rect.right <= width && rect.bottom <= height;
}

function anyOverlap(rects) {
  return rects.some((left, index) => rects.slice(index + 1).some((right) => (
    left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top
  )));
}

function dropTargetsFor(enemies) {
  const context = combatContext(enemies);
  return JSON.parse(vm.runInContext("JSON.stringify(combatDropTargets())", context));
}

for (const count of [1, 2, 3]) {
  test(`${count}척 적의 드롭 영역은 캔버스 안에서 서로 겹치지 않는다`, () => {
    const layout = renderLayoutFor(count);

    assert.equal(layout.length, count);
    layout.forEach(({ hitBox }) => assert.equal(isInsideCanvas(hitBox, 1200, 700), true));
    assert.equal(anyOverlap(layout.map((item) => item.hitBox)), false);
  });
}

test("격파되거나 나포된 적은 렌더링과 드롭 대상에서 제외된다", () => {
  const enemies = [
    enemyState("e0", { hull: 0 }),
    enemyState("e1", { captured: true }),
    enemyState("e2", { defeated: true }),
    enemyState("e3", { hull: 10 }),
  ];
  const context = combatContext(enemies);
  const layoutIds = JSON.parse(vm.runInContext("JSON.stringify(enemyRenderLayout().map(({ enemyId }) => enemyId))", context));
  const targetIds = dropTargetsFor(enemies)
    .filter((target) => target.type === "enemy")
    .map((target) => target.id);

  assert.deepEqual(layoutIds, ["e3"]);
  assert.deepEqual(targetIds, ["e3"]);
});

test("전투 드롭 대상은 적선과 아군선, 바다, 적 함대 영역을 모두 제공한다", () => {
  const targets = dropTargetsFor([enemyState("e0"), enemyState("e1")]);

  assert.deepEqual(targets.map(({ type, id }) => `${type}:${id}`), [
    "enemy:e0",
    "enemy:e1",
    "self:self",
    "sea:sea",
    "allEnemies:allEnemies",
  ]);
  targets.forEach(({ rect }) => assert.equal(isInsideCanvas(rect, 1200, 700), true));
});

test("각 적선은 개별 거리와 의도 및 포커스 상태로 렌더링된다", () => {
  const enemies = [
    enemyState("e0", { intent: "attack", range: 1 }),
    enemyState("e1", { intent: "approach", range: 2 }),
    enemyState("e2", { intent: "hold", range: 3 }),
  ];
  const context = combatContext(enemies);
  const hudCalls = vm.runInContext(`
    globalThis.enemyHudCalls = [];
    drawOcean = () => {};
    drawShip = () => {};
    drawCombatHud = () => {};
    getCrewPower = () => 0;
    combatTargetPreview = {
      currentTarget: { type: "enemy", id: "e1" },
      validTargets: [{ type: "enemy", id: "e1" }],
    };
    drawEnemyCombatHud = (layout, enemy, state) => enemyHudCalls.push({
      enemyId: enemy.id,
      focused: state.focused,
      hovered: state.hovered,
      intentIcon: state.intentIcon,
      intentLabel: state.intentLabel,
      range: state.range,
      validDrop: state.validDrop,
    });
    drawCombat(0);
    enemyHudCalls;
  `, context);

  assert.deepEqual(JSON.parse(JSON.stringify(hudCalls)), [
    { enemyId: "e0", focused: true, hovered: false, intentIcon: "✦", intentLabel: "포격", range: 1, validDrop: false },
    { enemyId: "e1", focused: false, hovered: true, intentIcon: "➤", intentLabel: "접근", range: 2, validDrop: true },
    { enemyId: "e2", focused: false, hovered: false, intentIcon: "◼", intentLabel: "대기", range: 3, validDrop: false },
  ]);
});

test("함대 전체 드롭은 모든 살아 있는 적선을 유효하고 선택된 대상으로 강조한다", () => {
  const context = combatContext([enemyState("e0"), enemyState("e1")]);
  const highlights = vm.runInContext(`
    globalThis.highlights = [];
    drawOcean = () => {};
    drawShip = () => {};
    drawCombatHud = () => {};
    getCrewPower = () => 0;
    combatTargetPreview = {
      currentTarget: { type: "allEnemies", id: "allEnemies" },
      validTargets: [{ type: "allEnemies", id: "allEnemies" }],
    };
    drawEnemyCombatHud = (_layout, enemy, state) => highlights.push({
      enemyId: enemy.id,
      hovered: state.hovered,
      validDrop: state.validDrop,
    });
    drawCombat(0);
    highlights;
  `, context);

  assert.deepEqual(JSON.parse(JSON.stringify(highlights)), [
    { enemyId: "e0", hovered: true, validDrop: true },
    { enemyId: "e1", hovered: true, validDrop: true },
  ]);
});

test("적선 HUD는 접안 판단에 필요한 돛 내구도를 표시한다", () => {
  const context = combatContext([enemyState("e0", { sails: 9, maxSails: 16 })]);
  const labels = vm.runInContext(`
    globalThis.hudLabels = [];
    ctx.fillText = (text) => hudLabels.push(text);
    const layout = enemyRenderLayout()[0];
    drawEnemyCombatHud(layout, findEnemy("e0"), {
      focused: false,
      hovered: false,
      intentIcon: "✦",
      intentLabel: "포격",
      range: 2,
      validDrop: false,
    });
    hudLabels;
  `, context);

  assert.equal(labels.includes("돛 9/16"), true);
});

test("함포 효과는 포커스와 무관하게 실제 공격 적선의 편성 좌표를 사용한다", () => {
  const context = combatContext([
    enemyState("e0"),
    enemyState("e1"),
    enemyState("e2"),
  ]);
  const anchors = JSON.parse(vm.runInContext(`JSON.stringify({
    enemyAttack: combatEffectAnchors({ source: "enemy", enemyId: "e1" }),
    playerAttack: combatEffectAnchors({ source: "player", enemyId: "e2" }),
  })`, context));

  assert.equal(anchors.enemyAttack.start.y, 380);
  assert.deepEqual(anchors.enemyAttack.end, { x: 322, y: 453 });
  assert.deepEqual(anchors.playerAttack.start, { x: 322, y: 453 });
  assert.equal(anchors.playerAttack.end.y, 540);
});

test("격침으로 함대가 재배치되어도 비행 중인 포탄의 목표 좌표는 바뀌지 않는다", () => {
  const context = combatContext([
    enemyState("e0"),
    enemyState("e1"),
    enemyState("e2"),
  ]);
  const result = JSON.parse(vm.runInContext(`
    const targetAnchor = combatEffectAnchors({ source: "player", enemyId: "e2" }).end;
    addCannonEffect("player", false, false, "e2", targetAnchor);
    const ball = visualEffects.find((effect) => effect.type === "ball");
    findEnemy("e2").hull = 0;
    findEnemy("e2").defeated = true;
    JSON.stringify({ anchor: ball.enemyAnchor, end: combatEffectAnchors(ball).end });
  `, context));

  assert.equal(result.anchor.y, 540);
  assert.equal(result.end.y, 540);
});

test("마지막 적을 격침한 포탄은 승리 전환 전까지 계속 렌더링된다", () => {
  const context = combatContext([enemyState("e0")]);
  const gradientCalls = vm.runInContext(`
    globalThis.effectGradientCalls = 0;
    drawOcean = () => {};
    drawShip = () => {};
    drawCombatHud = () => {};
    getCrewPower = () => 0;
    ctx.createLinearGradient = () => {
      effectGradientCalls += 1;
      return { addColorStop() {} };
    };
    const targetAnchor = combatEffectAnchors({ source: "player", enemyId: "e0" }).end;
    visualEffects = [{
      type: "ball",
      source: "player",
      enemyId: "e0",
      enemyAnchor: targetAnchor,
      progress: 0.2,
      speed: 0.01,
      offset: 0,
      missed: false,
      missOffset: 0,
      hit: false,
    }];
    findEnemy("e0").hull = 0;
    findEnemy("e0").defeated = true;
    drawCombat(0);
    effectGradientCalls;
  `, context);

  assert.equal(gradientCalls, 1);
});

test("CSS로 축소된 캔버스의 client 좌표를 실제 캔버스 좌표로 변환해 적을 찾는다", () => {
  const context = combatContext([enemyState("e0")], {
    getBoundingClientRect() {
      return { bottom: 400, height: 350, left: 100, right: 700, top: 50, width: 600 };
    },
  });
  const result = JSON.parse(vm.runInContext(`JSON.stringify({
    point: canvasPointFromClient(550, 275),
    target: combatDropTargetAtClientPoint(550, 275),
  })`, context));

  assert.deepEqual(result.point, { x: 900, y: 450 });
  assert.equal(result.target.type, "enemy");
  assert.equal(result.target.id, "e0");
});

test("단일 보스는 체력 단계 이미지와 기존 보스 배율을 유지한다", () => {
  const boss = enemyState("boss", {
    hull: 18,
    kind: "boss",
    maxHull: 60,
    shipImages: ["phase-1.png", "phase-2.png", "phase-3.png"],
  });
  const context = combatContext([boss]);
  const enemyShipCall = vm.runInContext(`
    globalThis.shipCalls = [];
    drawOcean = () => {};
    drawShip = (...args) => shipCalls.push(args);
    drawCombatHud = () => {};
    drawEnemyCombatHud = () => {};
    getCrewPower = () => 0;
    drawCombat(0);
    shipCalls[1];
  `, context);

  assert.equal(enemyShipCall[2], 1.7);
  assert.equal(enemyShipCall[5], "phase-3.png");
});
