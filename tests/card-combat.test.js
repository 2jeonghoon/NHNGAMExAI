"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

function combatWithHand(cardIds, energy = 3, overrides = {}) {
  const context = loadGameScripts([
    "src/analytics.js",
    "src/card-definitions.js",
    "src/card-engine.js",
    "src/fleet-combat.js",
    "src/game.js",
  ]);
  const enemyCount = overrides.enemyCount || 1;
  const deck = cardIds.length === 1 && ["rapid_fire", "tailwind_charge", "hard_turn"].includes(cardIds[0])
    ? [cardIds[0], "fire"]
    : cardIds;
  read(context, `
    run = makeTestRun({
      mapId: ${JSON.stringify(enemyCount === 3 ? "abyss" : "calm")},
      actIndex: 0,
      captainId: "gunner",
      artifacts: [],
      crew: [],
      logs: [],
      cannons: 6,
      repairKits: ${overrides.repairKits ?? 2},
      hull: ${overrides.hull ?? 50},
      maxHull: ${overrides.maxHull ?? 100},
      sails: ${overrides.sails ?? 10},
      maxSails: ${overrides.maxSails ?? 20},
      morale: ${overrides.morale ?? 20},
      safetyNetCharges: 0,
      deck: ${JSON.stringify(deck)},
      cardRemovals: 0,
    });
    Math.random = () => 0;
    startCombat(${JSON.stringify(enemyCount === 3 ? "elite" : "battle")});
    run.combat.enemies.forEach((enemy) => {
      enemy.hull = 100;
      enemy.maxHull = 100;
      enemy.sails = 30;
      enemy.maxSails = 30;
      enemy.crew = 20;
      enemy.maxCrew = 20;
      enemy.range = ${overrides.range ?? 2};
      enemy.damage = 1;
    });
    run.combat.wind = { direction: ${JSON.stringify(overrides.wind || "측풍")}, speed: 1 };
    run.combat.cardState = CardEngine.createState(run.deck, () => 0, {
      maxEnergy: ${energy},
      handSize: ${cardIds.length},
      handLimit: 8,
    });
  `);
  return context;
}

function playNamed(context, cardId, target) {
  return read(context, `(() => {
    const instance = run.combat.cardState.hand.find((candidate) => candidate.cardId === ${JSON.stringify(cardId)});
    return playCard(instance.instanceId, ${JSON.stringify(target)});
  })()`);
}

function cardError(context, cardId, target) {
  return read(context, `(() => {
    const instance = run.combat.cardState.hand.find((candidate) => candidate.cardId === ${JSON.stringify(cardId)});
    return cardUseError(instance.instanceId, ${JSON.stringify(target)});
  })()`);
}

function endTurn(context) {
  return read(context, "endPlayerTurn()");
}

function snapshot(context) {
  return JSON.parse(read(context, `JSON.stringify({
    energy: run.combat.cardState.energy,
    hand: run.combat.cardState.hand.map((card) => card.cardId),
    discard: run.combat.cardState.discardPile.map((card) => card.cardId),
    exhaust: run.combat.cardState.exhaustPile.map((card) => card.cardId),
    enemies: run.combat.enemies.map(({ id, hull, sails, crew, range, captured, defeated, movementBlocked }) => (
      { id, hull, sails, crew, range, captured, defeated, movementBlocked: Boolean(movementBlocked) }
    )),
    hull: run.hull,
    sails: run.sails,
    morale: run.morale,
    repairKits: run.repairKits,
    evasion: run.combat.evasion,
    enemyActions: run.combat.enemyActions,
  })`));
}

test("카드 세 장을 사용해도 적은 턴 종료 전 행동하지 않는다", () => {
  const context = combatWithHand(["fire", "chain", "retreat"], 3);
  playNamed(context, "fire", "enemy-0");
  playNamed(context, "chain", "enemy-0");
  playNamed(context, "retreat", "sea");
  assert.equal(read(context, "run.combat.enemyActions"), 0);
  read(context, "setTimeout = (callback) => callback()");
  endTurn(context);
  assert.equal(read(context, "run.combat.enemyActions"), 1);
  assert.equal(read(context, "run.combat.cardState.turn"), 2);
});

test("선장 기술은 회피와 에너지를 보존하고 턴을 끝내지 않아 카드를 계속 사용할 수 있다", () => {
  const context = combatWithHand(["retreat", "fire"], 3);
  read(context, `
    scheduledEnemyTurns = 0;
    setTimeout = (callback) => { if (callback === startEnemyTurn) scheduledEnemyTurns += 1; };
  `);
  assert.equal(playNamed(context, "retreat", "sea"), true);
  assert.equal(read(context, "run.combat.evasion"), 0.2);
  assert.equal(read(context, "run.combat.cardState.energy"), 2);

  read(context, 'combatAction("skill")');
  assert.equal(read(context, "run.combat.cardState.energy"), 2);
  assert.equal(read(context, "run.combat.evasion"), 0.2);
  assert.equal(read(context, "run.combat.enemyActions"), 0);
  assert.equal(read(context, "scheduledEnemyTurns"), 0);
  assert.equal(read(context, "run.combat.locked"), false);
  assert.equal(read(context, "run.combat.skillReady"), false);
  assert.equal(read(context, "run.combat.enemies[0].hull"), 80);

  read(context, 'combatAction("skill")');
  assert.equal(read(context, "run.combat.enemies[0].hull"), 80);
  assert.equal(playNamed(context, "fire", "enemy-0"), true);
  assert.equal(read(context, "run.combat.cardState.energy"), 1);
  assert.equal(read(context, "run.combat.enemies[0].hull"), 72);
});

test("모달이 열린 동안 선장 기술은 준비 상태와 전투 수치를 바꾸지 않는다", () => {
  const context = combatWithHand(["retreat"], 3);
  assert.equal(playNamed(context, "retreat", "sea"), true);
  read(context, "ui.modalLayer.hidden = false");
  const before = snapshot(context);
  read(context, 'combatAction("skill")');
  assert.deepEqual(snapshot(context), before);
  assert.equal(read(context, "run.combat.skillReady"), true);
});

test("돛 0이면 접근·회피를 포인터와 키보드 경로 모두 거부한다", () => {
  const context = combatWithHand(["approach", "retreat"], 3, { sails: 0 });
  assert.match(cardError(context, "approach", "enemy-0"), /돛/);
  assert.match(cardError(context, "retreat", "sea"), /돛/);
  assert.equal(playNamed(context, "approach", "enemy-0"), false);
  assert.equal(read(context, "run.combat.cardState.energy"), 3);
});

test("유효 대상과 실제 실행은 같은 중앙 조건 검사를 사용한다", () => {
  const context = combatWithHand(["approach", "repair", "fire", "fireship"], 4, { sails: 0 });
  const targets = JSON.parse(read(context, `JSON.stringify(Object.fromEntries(
    run.combat.cardState.hand.map((instance) => [instance.cardId, validTargets(instance.instanceId)]),
  ))`));
  assert.deepEqual(targets.approach, []);
  assert.deepEqual(targets.repair, [{ type: "self", id: "self" }]);
  assert.deepEqual(targets.fire, [{ type: "enemy", id: "enemy-0" }]);
  assert.deepEqual(targets.fireship, [{ type: "allEnemies", id: "allEnemies" }]);
});

test("기존 포격은 피해 굴림 뒤에 선원 피해를 판정한다", () => {
  const context = combatWithHand(["fire"], 3);
  read(context, `
    randomValues = [0.1, 0.9, 0];
    Math.random = () => randomValues.shift() ?? 0;
  `);
  assert.equal(playNamed(context, "fire", "enemy-0"), true);
  assert.equal(read(context, "run.combat.enemies[0].hull"), 88);
  assert.equal(read(context, "run.combat.enemies[0].crew"), 19);
});

test("기존 접안 실패는 선체·사기 피해와 선원 손실 판정을 보존한다", () => {
  const context = combatWithHand(["board"], 3, { range: 1 });
  read(context, `
    run.combat.enemies[0].sails = 10;
    run.crew = [
      { name: "갑판원 A", roleId: "cook", rarityId: "normal", power: 0, trait: { id: "none" } },
      { name: "갑판원 B", roleId: "cook", rarityId: "normal", power: 0, trait: { id: "none" } },
    ];
    updateHud = () => {};
    randomValues = [0.9, 0, 0, 0];
    Math.random = () => randomValues.shift() ?? 0;
  `);
  assert.equal(playNamed(context, "board", "enemy-0"), true);
  assert.deepEqual(JSON.parse(read(context, "JSON.stringify({ hull: run.hull, morale: run.morale, crew: run.crew.map((member) => member.name) })")), {
    hull: 45,
    morale: 14,
    crew: ["갑판원 B"],
  });
});

test("모달이 열린 동안 카드 실행은 손패·에너지·전투 수치를 바꾸지 않는다", () => {
  const context = combatWithHand(["fire"], 3);
  read(context, "ui.modalLayer.hidden = false");
  const before = snapshot(context);
  assert.match(cardError(context, "fire", "enemy-0"), /지금|모달/);
  assert.equal(playNamed(context, "fire", "enemy-0"), false);
  assert.deepEqual(snapshot(context), before);
});

test("명중·접안 변형 카드는 명시된 확률 보정을 경계 굴림에 적용한다", () => {
  const aimed = combatWithHand(["aimed_fire"], 3);
  read(aimed, "randomValues = [0.9, 0]; Math.random = () => randomValues.shift() ?? 0");
  playNamed(aimed, "aimed_fire", "enemy-0");
  assert.equal(read(aimed, "run.combat.enemies[0].hull"), 86);

  const barrage = combatWithHand(["barrage_fire"], 3);
  read(barrage, "Math.random = () => 0.75");
  playNamed(barrage, "barrage_fire", "allEnemies");
  assert.equal(read(barrage, "run.combat.enemies[0].hull"), 100);

  const rain = combatWithHand(["chain_rain"], 3);
  read(rain, "Math.random = () => 0.65");
  playNamed(rain, "chain_rain", "allEnemies");
  assert.equal(read(rain, "run.combat.enemies[0].sails"), 30);

  const desperate = combatWithHand(["desperate_board"], 3, { range: 1 });
  read(desperate, "randomValues = [0.17, 0]; Math.random = () => randomValues.shift() ?? 0");
  playNamed(desperate, "desperate_board", "enemy-0");
  assert.equal(read(desperate, "run.combat.enemies[0].captured"), false);
  assert.equal(read(desperate, "run.hull"), 45);
});

test("사슬 폭우는 기존 사슬탄 분석 계열로 기록한다", () => {
  const context = combatWithHand(["chain_rain"], 3);
  read(context, "recordedAction = null; Analytics.addAction = (action) => { recordedAction = action; }");
  playNamed(context, "chain_rain", "allEnemies");
  assert.equal(read(context, "recordedAction"), "chain");
});

const publicCards = [
  { id: "fire", cost: 1, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 92 } },
  { id: "aimed_fire", cost: 2, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 86 } },
  { id: "rapid_fire", cost: 0, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 95, handIncludes: "fire" } },
  { id: "chain", cost: 1, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemySails: 24 } },
  { id: "heavy_chain", cost: 2, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemySails: 16 } },
  { id: "entangling_chain", cost: 1, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemySails: 27, movementBlocked: true } },
  { id: "approach", cost: 1, targetType: "sea", target: "enemy-0", exhaust: false,
    want: { enemyRange: 1, evasion: 0.08 } },
  { id: "tailwind_charge", cost: 0, targetType: "sea", target: "enemy-0", exhaust: false,
    overrides: { wind: "순풍" }, want: { enemyRange: 1, handIncludes: "fire" } },
  { id: "ram", cost: 2, targetType: "sea", target: "enemy-0", exhaust: false,
    want: { enemyHull: 92, enemyRange: 1, playerHull: 47 } },
  { id: "retreat", cost: 1, targetType: "sea", target: "sea", exhaust: false,
    want: { enemyRange: 3, evasion: 0.2 } },
  { id: "hard_turn", cost: 0, targetType: "sea", target: "sea", exhaust: false,
    want: { evasion: 0.15, handIncludes: "fire" } },
  { id: "smoke_sail", cost: 2, targetType: "sea", target: "sea", exhaust: false,
    want: { enemyRange: 3, evasion: 0.5 } },
  { id: "repair", cost: 1, targetType: "self", target: "self", exhaust: false,
    want: { playerHull: 57, playerSails: 13, repairKits: 1 } },
  { id: "rigging_repair", cost: 0, targetType: "self", target: "self", exhaust: false,
    want: { playerSails: 14 } },
  { id: "overhaul", cost: 2, targetType: "self", target: "self", exhaust: false,
    want: { playerHull: 64, playerSails: 16, repairKits: 1 } },
  { id: "board", cost: 2, targetType: "enemy", target: "enemy-0", exhaust: false,
    overrides: { range: 1 }, prepare: "run.combat.enemies[0].sails = 10",
    want: { captured: true, enemyHull: 0 } },
  { id: "grappling_hook", cost: 1, targetType: "enemy", target: "enemy-0", exhaust: false,
    overrides: { range: 1 }, want: { enemySails: 25 } },
  { id: "desperate_board", cost: 3, targetType: "enemy", target: "enemy-0", exhaust: false,
    overrides: { range: 1 }, want: { captured: true, enemyHull: 0 } },
  { id: "barrage_fire", cost: 2, targetType: "allEnemies", target: "allEnemies", exhaust: false,
    overrides: { enemyCount: 3 }, want: { allEnemyHull: 95 } },
  { id: "chain_rain", cost: 2, targetType: "allEnemies", target: "allEnemies", exhaust: false,
    overrides: { enemyCount: 3 }, want: { allEnemySails: 25 } },
  { id: "fireship", cost: 3, targetType: "allEnemies", target: "allEnemies", exhaust: true,
    overrides: { enemyCount: 3 }, want: { allEnemyHull: 90, allEnemySails: 25, morale: 16 } },
];

for (const row of publicCards) {
  test(`${row.id} 비용·대상·소멸과 수치 효과가 정의와 일치한다`, () => {
    const context = combatWithHand([row.id], Math.max(3, row.cost), row.overrides);
    if (row.prepare) read(context, row.prepare);
    const definition = JSON.parse(read(context, `JSON.stringify(CardDefinitions.getCard(${JSON.stringify(row.id)}))`));
    assert.equal(definition.cost, row.cost);
    assert.equal(definition.targetType, row.targetType);
    assert.equal(definition.exhaust, row.exhaust);

    assert.equal(playNamed(context, row.id, row.target), true);
    const actual = snapshot(context);
    assert.equal(actual.energy, Math.max(3, row.cost) - row.cost);
    assert.equal(actual.discard.includes(row.id), !row.exhaust);
    assert.equal(actual.exhaust.includes(row.id), row.exhaust);
    if (row.want.enemyHull !== undefined) assert.equal(actual.enemies[0].hull, row.want.enemyHull);
    if (row.want.enemySails !== undefined) assert.equal(actual.enemies[0].sails, row.want.enemySails);
    if (row.want.enemyRange !== undefined) assert.equal(actual.enemies[0].range, row.want.enemyRange);
    if (row.want.movementBlocked !== undefined) assert.equal(actual.enemies[0].movementBlocked, row.want.movementBlocked);
    if (row.want.playerHull !== undefined) assert.equal(actual.hull, row.want.playerHull);
    if (row.want.playerSails !== undefined) assert.equal(actual.sails, row.want.playerSails);
    if (row.want.repairKits !== undefined) assert.equal(actual.repairKits, row.want.repairKits);
    if (row.want.evasion !== undefined) assert.equal(actual.evasion, row.want.evasion);
    if (row.want.captured !== undefined) assert.equal(actual.enemies[0].captured, row.want.captured);
    if (row.want.handIncludes) assert.equal(actual.hand.includes(row.want.handIncludes), true);
    if (row.want.allEnemyHull !== undefined) assert.deepEqual(actual.enemies.map((enemy) => enemy.hull), [row.want.allEnemyHull, row.want.allEnemyHull, row.want.allEnemyHull]);
    if (row.want.allEnemySails !== undefined) assert.deepEqual(actual.enemies.map((enemy) => enemy.sails), [row.want.allEnemySails, row.want.allEnemySails, row.want.allEnemySails]);
    if (row.want.morale !== undefined) assert.equal(actual.morale, row.want.morale);
  });
}

test("광역 격파는 세 적의 결과를 함께 적용하고 승리를 한 번만 예약한다", () => {
  const context = combatWithHand(["fireship"], 3, { enemyCount: 3 });
  read(context, `
    run.combat.enemies.forEach((enemy) => { enemy.hull = 10; enemy.sails = 5; });
    scheduledVictories = 0;
    setTimeout = (callback) => { if (callback === winCombat) scheduledVictories += 1; };
  `);
  assert.equal(playNamed(context, "fireship", "allEnemies"), true);
  assert.deepEqual(JSON.parse(read(context, "JSON.stringify(run.combat.enemies.map((enemy) => enemy.defeated))")), [true, true, true]);
  assert.equal(read(context, "scheduledVictories"), 1);
  assert.equal(read(context, "run.combat.enemyActions"), 0);
});

test("항해와 전투 시작은 독립 덱과 카드 상태를 초기화한다", () => {
  const context = loadGameScripts([
    "src/analytics.js", "src/card-definitions.js", "src/card-engine.js", "src/fleet-combat.js", "src/game.js",
  ]);
  const result = JSON.parse(read(context, `JSON.stringify((() => {
    updateHud = () => {};
    beginAct = () => {};
    logEvent = () => {};
    startVoyage("gunner", "calm");
    const voyageDeck = run.deck;
    startCombat("battle");
    return {
      deck: voyageDeck,
      deckIsStarterReference: voyageDeck === CardDefinitions.STARTER_DECK,
      cardRemovals: run.cardRemovals,
      handSize: run.combat.cardState.hand.length,
      energy: run.combat.cardState.energy,
    };
  })())`));
  assert.deepEqual(result, {
    deck: ["fire", "fire", "fire", "chain", "chain", "approach", "approach", "retreat", "repair", "board"],
    deckIsStarterReference: false,
    cardRemovals: 0,
    handSize: 5,
    energy: 3,
  });
});
