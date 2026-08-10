"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

const GAME_SCRIPTS = [
  "src/analytics.js",
  "src/card-definitions.js",
  "src/card-engine.js",
  "src/fleet-combat.js",
  "src/game.js",
];

function crew(roleId, rarityId = "normal", traitId = "none") {
  return {
    name: `${roleId}-${rarityId}-${traitId}`,
    roleId,
    rarityId,
    power: 0,
    trait: { id: traitId },
  };
}

function combatForCaptain(captainId, cardIds, overrides = {}) {
  const context = loadGameScripts(GAME_SCRIPTS);
  const enemyCount = overrides.enemyCount || 1;
  const artifacts = (overrides.artifacts || []).map((id) => ({ id }));
  const members = overrides.crew || [];
  read(context, `
    run = makeTestRun({
      mapId: ${JSON.stringify(enemyCount === 3 ? "abyss" : "calm")},
      actIndex: 0,
      captainId: ${JSON.stringify(captainId)},
      artifacts: ${JSON.stringify(artifacts)},
      crew: ${JSON.stringify(members)},
      logs: [],
      cannons: 6,
      repairKits: 2,
      hull: ${overrides.hull ?? 50},
      maxHull: ${overrides.maxHull ?? 100},
      sails: ${overrides.sails ?? 10},
      maxSails: ${overrides.maxSails ?? 20},
      morale: ${overrides.morale ?? 20},
      safetyNetCharges: 0,
      deck: ${JSON.stringify(cardIds)},
      cardRemovals: 0,
    });
    updateHud = () => {};
    renderActionDock = () => {};
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
      enemy.damage = 10;
    });
    run.combat.wind = { direction: ${JSON.stringify(overrides.wind || "측풍")}, speed: 1 };
    run.combat.cardState = CardEngine.createState(${JSON.stringify(cardIds)}, () => 0, {
      maxEnergy: ${overrides.energy ?? 4}, handSize: ${cardIds.length}, handLimit: 8,
    });
    run.combat.cardState.drawPile = [
      { instanceId: "draw-1", cardId: "fire", costDelta: 0 },
      { instanceId: "draw-2", cardId: "chain", costDelta: 0 },
      { instanceId: "draw-3", cardId: "fire", costDelta: 0 },
    ];
  `);
  return context;
}

function calculateEnergy({ artifacts = [], crew: members = [], turn = 1 } = {}) {
  const context = loadGameScripts(GAME_SCRIPTS);
  return JSON.parse(read(context, `JSON.stringify((() => {
    run = makeTestRun({
      artifacts: ${JSON.stringify(artifacts.map((id) => ({ id })))},
      crew: ${JSON.stringify(members)}, logs: [],
    });
    return getEnergyModifiers(${turn});
  })())`));
}

function useSkill(context, target) {
  return read(context, `useCaptainSkill(${JSON.stringify(target)})`);
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

function snapshot(context) {
  return JSON.parse(read(context, `JSON.stringify({
    energy: run.combat.cardState.energy,
    hand: run.combat.cardState.hand.map(({ cardId, costDelta }) => ({ cardId, costDelta })),
    discard: run.combat.cardState.discardPile.map((card) => card.cardId),
    exhaust: run.combat.cardState.exhaustPile.map((card) => card.cardId),
    enemies: run.combat.enemies.map(({ hull, sails, crew, range, abyssMarkCharges }) => (
      { hull, sails, crew, range, abyssMarkCharges: abyssMarkCharges || 0 }
    )),
    hull: run.hull,
    sails: run.sails,
    morale: run.morale,
    evasion: run.combat.evasion,
    nextShotAccuracyBonus: run.combat.nextShotAccuracyBonus || 0,
    nextEnemyAttackReduction: run.combat.nextEnemyAttackReduction || 0,
    boardingPowerBonus: run.combat.boardingPowerBonus || 0,
    deathDelayReady: Boolean(run.combat.deathDelayReady),
    tailwindUntilTurn: run.combat.tailwindUntilTurn || 0,
    wind: run.combat.wind.direction,
  })`));
}

test("다른 선장의 전용 카드는 실행할 수 없고 어떤 상태도 바꾸지 않는다", () => {
  const context = combatForCaptain("navigator", ["gunner_magazine_open"]);
  const before = read(context, "JSON.stringify(run)");
  assert.match(cardError(context, "gunner_magazine_open", "enemy-0"), /선장 전용/);
  assert.equal(playNamed(context, "gunner_magazine_open", "enemy-0"), false);
  assert.equal(read(context, "JSON.stringify(run)"), before);
});

test("선장 공격 카드도 명중과 빗나감 함포 효과를 큐에 넣는다", () => {
  const hit = combatForCaptain("gunner", ["gunner_magazine_open"]);
  const hitEffect = JSON.parse(read(hit, `JSON.stringify((() => {
    let effect = null;
    addCannonEffect = (_source, broadside, missed, enemyId) => { effect = { broadside, missed, enemyId }; };
    const instance = run.combat.cardState.hand[0];
    playCard(instance.instanceId, "enemy-0");
    return effect;
  })())`));
  assert.deepEqual(hitEffect, { broadside: true, missed: false, enemyId: "enemy-0" });

  const miss = combatForCaptain("gunner", ["gunner_shrapnel"]);
  const missEffect = JSON.parse(read(miss, `JSON.stringify((() => {
    let effect = null;
    Math.random = () => 0.99;
    addCannonEffect = (_source, broadside, missed, enemyId) => { effect = { broadside, missed, enemyId }; };
    const instance = run.combat.cardState.hand[0];
    playCard(instance.instanceId, "enemy-0");
    return effect;
  })())`));
  assert.deepEqual(missEffect, { broadside: false, missed: true, enemyId: "enemy-0" });
});

test("결정론적 단일 표적 필살기는 격침 전 실제 적선 좌표를 함포 효과에 보존한다", () => {
  const context = combatForCaptain("gunner", ["gunner_magazine_open"]);
  const effect = JSON.parse(read(context, `JSON.stringify((() => {
    run.combat.enemies[0].hull = 1;
    let recorded = null;
    setTimeout = () => {};
    addCannonEffect = (_source, _broadside, _missed, enemyId, enemyAnchor) => {
      recorded = { enemyId, enemyAnchor };
    };
    const instance = run.combat.cardState.hand[0];
    playCard(instance.instanceId, "enemy-0");
    return recorded;
  })())`));

  assert.deepEqual(effect, {
    enemyId: "enemy-0",
    enemyAnchor: { x: 804.86, y: 450 },
  });
});

test("결정론적 함대 필살기는 격침 전 세 적선의 편성 좌표를 모두 보존한다", () => {
  const context = combatForCaptain("gunner", ["gunner_fleet_broadside"], { enemyCount: 3 });
  const effects = JSON.parse(read(context, `JSON.stringify((() => {
    run.combat.enemies.forEach((enemy) => { enemy.hull = 1; });
    const recorded = [];
    const scheduled = [];
    setTimeout = (callback, delay) => {
      if (delay === 80 || delay === 160) scheduled.push(callback);
    };
    addCannonEffect = (_source, _broadside, _missed, enemyId, enemyAnchor) => {
      recorded.push({ enemyId, enemyAnchor });
    };
    const instance = run.combat.cardState.hand[0];
    playCard(instance.instanceId, "allEnemies");
    scheduled.forEach((callback) => callback());
    return recorded;
  })())`));

  assert.deepEqual(effects.map(({ enemyId, enemyAnchor }) => ({ enemyId, y: enemyAnchor.y })), [
    { enemyId: "enemy-0", y: 275 },
    { enemyId: "enemy-1", y: 380 },
    { enemyId: "enemy-2", y: 540 },
  ]);
});

const captainCards = [
  { captain: "gunner", id: "gunner_steady_aim", cost: 0, targetType: "self", target: "self", exhaust: false,
    want: { drawn: 1, nextShotAccuracyBonus: 0.15 } },
  { captain: "gunner", id: "gunner_shrapnel", cost: 1, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 96, enemyCrew: 18 } },
  { captain: "gunner", id: "gunner_double_broadside", cost: 2, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 92 } },
  { captain: "gunner", id: "gunner_powder_shift", cost: 1, targetType: "sea", target: "sea", exhaust: false,
    prepare: `run.combat.cardState.drawPile = [{ instanceId: "powder-card", cardId: "gunner_shrapnel", costDelta: 0 }]`,
    want: { handCard: "gunner_shrapnel", handCostDelta: -1 } },
  { captain: "gunner", id: "gunner_overcharge", cost: 2, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 86, enemySails: 25, playerSails: 7 } },
  { captain: "gunner", id: "gunner_magazine_open", cost: 3, targetType: "enemy", target: "enemy-0", exhaust: true,
    want: { enemyHull: 76, playerHull: 44 } },
  { captain: "gunner", id: "gunner_fleet_broadside", cost: 3, targetType: "allEnemies", target: "allEnemies", exhaust: true,
    overrides: { enemyCount: 3 }, want: { allEnemyHull: 87, allEnemySails: 27, playerHull: 46 } },

  { captain: "navigator", id: "navigator_read_wind", cost: 0, targetType: "sea", target: "sea", exhaust: false,
    want: { energyBonus: 1, wind: "순풍" } },
  { captain: "navigator", id: "navigator_raise_sails", cost: 1, targetType: "self", target: "self", exhaust: false,
    want: { playerSails: 15, drawn: 1 } },
  { captain: "navigator", id: "navigator_crosswind_turn", cost: 1, targetType: "sea", target: "sea", exhaust: false,
    overrides: { enemyCount: 3 }, want: { allEnemyRange: 2, evasion: 0.2 } },
  { captain: "navigator", id: "navigator_wave_ride", cost: 0, targetType: "self", target: "self", exhaust: true,
    want: { drawn: 2 } },
  { captain: "navigator", id: "navigator_tailwind_route", cost: 2, targetType: "sea", target: "sea", exhaust: false,
    want: { wind: "순풍", tailwindUntilTurn: 2 } },
  { captain: "navigator", id: "navigator_reposition", cost: 2, targetType: "sea", target: { type: "sea", id: "sea", range: 1 }, exhaust: false,
    overrides: { enemyCount: 3 }, want: { allEnemyRange: 1, evasion: 0.6 } },
  { captain: "navigator", id: "navigator_storm_corridor", cost: 2, targetType: "allEnemies", target: "allEnemies", exhaust: false,
    overrides: { enemyCount: 3 }, want: { allEnemySails: 23, allEnemyRange: 3, evasion: 0.3 } },

  { captain: "mystic", id: "mystic_abyss_mark", cost: 1, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { abyssMarkCharges: 2 } },
  { captain: "mystic", id: "mystic_cursed_tide", cost: 1, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 96, enemySails: 24, enemyCrew: 18 } },
  { captain: "mystic", id: "mystic_fear_whisper", cost: 1, targetType: "self", target: "self", exhaust: false,
    want: { morale: 23, nextEnemyAttackReduction: 0.4 } },
  { captain: "mystic", id: "mystic_dark_prophecy", cost: 0, targetType: "self", target: "self", exhaust: true,
    want: { drawn: 2 } },
  { captain: "mystic", id: "mystic_blood_pact", cost: 0, targetType: "self", target: "self", exhaust: true,
    want: { morale: 15, energyBonus: 2 } },
  { captain: "mystic", id: "mystic_open_abyss", cost: 3, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 88, enemySails: 20, enemyCrew: 16 } },
  { captain: "mystic", id: "mystic_abyss_chorus", cost: 3, targetType: "allEnemies", target: "allEnemies", exhaust: true,
    overrides: { enemyCount: 3 }, want: { allEnemyHull: 92, allEnemySails: 22, allEnemyCrew: 17, morale: 26 } },

  { captain: "revenant", id: "revenant_dead_nails", cost: 1, targetType: "self", target: "self", exhaust: false,
    want: { playerHull: 55, morale: 18 } },
  { captain: "revenant", id: "revenant_ghost_deckhand", cost: 1, targetType: "self", target: "self", exhaust: false,
    want: { boardingPowerBonus: 8 } },
  { captain: "revenant", id: "revenant_soul_drain", cost: 2, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 90, playerHull: 56 } },
  { captain: "revenant", id: "revenant_sinking_memory", cost: 0, targetType: "self", target: "self", exhaust: true,
    want: { drawn: 2, energyBonus: 1 } },
  { captain: "revenant", id: "revenant_death_delay", cost: 1, targetType: "self", target: "self", exhaust: true,
    want: { deathDelayReady: true } },
  { captain: "revenant", id: "revenant_return_abyss", cost: 3, targetType: "enemy", target: "enemy-0", exhaust: false,
    want: { enemyHull: 82, playerHull: 62, morale: 14 } },
  { captain: "revenant", id: "revenant_ghost_fleet", cost: 3, targetType: "allEnemies", target: "allEnemies", exhaust: true,
    overrides: { enemyCount: 3 }, want: { allEnemyHull: 90, playerHull: 59 } },
];

for (const row of captainCards) {
  test(`${row.id} 비용·대상·소멸과 수치 효과가 정의와 일치한다`, () => {
    const context = combatForCaptain(row.captain, [row.id], row.overrides);
    if (row.prepare) read(context, row.prepare);
    const definition = JSON.parse(read(context, `JSON.stringify(CardDefinitions.getCard(${JSON.stringify(row.id)}))`));
    assert.equal(definition.cost, row.cost);
    assert.equal(definition.targetType, row.targetType);
    assert.equal(definition.exhaust, row.exhaust);
    const beforeHand = read(context, "run.combat.cardState.hand.length");
    const beforeEnergy = read(context, "run.combat.cardState.energy");

    assert.equal(playNamed(context, row.id, row.target), true);
    const actual = snapshot(context);
    const expectedBaseEnergy = beforeEnergy - row.cost;
    assert.equal(actual.energy, expectedBaseEnergy + (row.want.energyBonus || 0));
    assert.equal(actual.discard.includes(row.id), !row.exhaust);
    assert.equal(actual.exhaust.includes(row.id), row.exhaust);
    if (row.want.drawn !== undefined) assert.equal(actual.hand.length, beforeHand - 1 + row.want.drawn);
    if (row.want.handCard) {
      const handCard = actual.hand.find((card) => card.cardId === row.want.handCard);
      assert.ok(handCard);
      assert.equal(handCard.costDelta, row.want.handCostDelta);
    }
    if (row.want.enemyHull !== undefined) assert.equal(actual.enemies[0].hull, row.want.enemyHull);
    if (row.want.enemySails !== undefined) assert.equal(actual.enemies[0].sails, row.want.enemySails);
    if (row.want.enemyCrew !== undefined) assert.equal(actual.enemies[0].crew, row.want.enemyCrew);
    if (row.want.allEnemyHull !== undefined) assert.deepEqual(actual.enemies.map((enemy) => enemy.hull), [row.want.allEnemyHull, row.want.allEnemyHull, row.want.allEnemyHull]);
    if (row.want.allEnemySails !== undefined) assert.deepEqual(actual.enemies.map((enemy) => enemy.sails), [row.want.allEnemySails, row.want.allEnemySails, row.want.allEnemySails]);
    if (row.want.allEnemyCrew !== undefined) assert.deepEqual(actual.enemies.map((enemy) => enemy.crew), [row.want.allEnemyCrew, row.want.allEnemyCrew, row.want.allEnemyCrew]);
    if (row.want.allEnemyRange !== undefined) assert.deepEqual(actual.enemies.map((enemy) => enemy.range), [row.want.allEnemyRange, row.want.allEnemyRange, row.want.allEnemyRange]);
    for (const key of ["hull", "sails", "morale", "evasion", "nextShotAccuracyBonus", "nextEnemyAttackReduction", "boardingPowerBonus", "deathDelayReady", "tailwindUntilTurn", "wind"]) {
      const expectedKey = key === "hull" ? "playerHull" : key === "sails" ? "playerSails" : key;
      if (row.want[expectedKey] !== undefined) assert.equal(actual[key], row.want[expectedKey]);
    }
    if (row.want.abyssMarkCharges !== undefined) assert.equal(actual.enemies[0].abyssMarkCharges, row.want.abyssMarkCharges);
  });
}

test("심연의 표식은 다음 두 번의 선체 피해에만 각각 4를 더한다", () => {
  const context = combatForCaptain("mystic", ["mystic_abyss_mark", "mystic_cursed_tide", "mystic_cursed_tide"], { energy: 4 });
  playNamed(context, "mystic_abyss_mark", "enemy-0");
  playNamed(context, "mystic_cursed_tide", "enemy-0");
  playNamed(context, "mystic_cursed_tide", "enemy-0");
  assert.equal(read(context, "run.combat.enemies[0].hull"), 84);
  assert.equal(read(context, "run.combat.enemies[0].abyssMarkCharges"), 0);
});

test("연속 포격의 두 타격과 표식 보너스는 분석 피해에 누적된다", () => {
  const context = combatForCaptain("gunner", ["mystic_abyss_mark", "gunner_double_broadside"]);
  read(context, "run.captainId = 'mystic'");
  playNamed(context, "mystic_abyss_mark", "enemy-0");
  read(context, "run.captainId = 'gunner'; recordedDamage = null; Analytics.addDamage = (dealt) => { recordedDamage = dealt; }");
  playNamed(context, "gunner_double_broadside", "enemy-0");
  assert.equal(read(context, "run.combat.enemies[0].hull"), 84);
  assert.equal(read(context, "recordedDamage"), 16);
});

test("심연의 표식은 선장 기술의 선체 피해에도 적용된다", () => {
  const context = combatForCaptain("mystic", ["mystic_abyss_mark"]);
  playNamed(context, "mystic_abyss_mark", "enemy-0");
  assert.equal(useSkill(context, "enemy-0"), true);
  assert.equal(read(context, "run.combat.enemies[0].hull"), 92);
  assert.equal(read(context, "run.combat.enemies[0].abyssMarkCharges"), 1);
});

test("완전 재배치는 거리 1 또는 3만 받아들이고 모든 적에 적용한다", () => {
  const context = combatForCaptain("navigator", ["navigator_reposition"], { enemyCount: 3 });
  assert.deepEqual(JSON.parse(read(context, `JSON.stringify((() => {
    const instance = run.combat.cardState.hand.find((card) => card.cardId === "navigator_reposition");
    return validTargets(instance.instanceId);
  })())`)), [
    { type: "sea", id: "sea", range: 1 },
    { type: "sea", id: "sea", range: 3 },
  ]);
  assert.match(cardError(context, "navigator_reposition", "sea"), /거리/);
  assert.match(cardError(context, "navigator_reposition", { type: "sea", id: "sea", range: 2 }), /거리/);
  assert.equal(playNamed(context, "navigator_reposition", { type: "sea", id: "sea", range: 3 }), true);
  assert.deepEqual(JSON.parse(read(context, "JSON.stringify(run.combat.enemies.map((enemy) => enemy.range))")), [3, 3, 3]);
});

test("회복 카드는 선체와 사기 상한을 넘지 않는다", () => {
  const mystic = combatForCaptain("mystic", ["mystic_abyss_chorus"], { enemyCount: 3, morale: 99 });
  playNamed(mystic, "mystic_abyss_chorus", "allEnemies");
  assert.equal(read(mystic, "run.morale"), 100);

  const revenant = combatForCaptain("revenant", ["revenant_return_abyss"], { hull: 95 });
  playNamed(revenant, "revenant_return_abyss", "enemy-0");
  assert.equal(read(revenant, "run.hull"), 100);
});

test("공포의 속삭임은 다음 적 공격 한 번의 선체 피해만 40% 줄인다", () => {
  const context = combatForCaptain("mystic", ["mystic_fear_whisper"]);
  playNamed(context, "mystic_fear_whisper", "self");
  read(context, "Math.random = () => 0; performEnemyAttack(run.combat.enemies[0])");
  assert.equal(read(context, "run.hull"), 44);
  assert.equal(read(context, "run.combat.nextEnemyAttackReduction"), 0);
  read(context, "performEnemyAttack(run.combat.enemies[0])");
  assert.equal(read(context, "run.hull"), 34);
});

test("죽음 유예는 다음 치명적 피해 한 번만 선체 1로 막는다", () => {
  const context = combatForCaptain("revenant", ["revenant_death_delay"], { hull: 1 });
  playNamed(context, "revenant_death_delay", "self");
  read(context, "Math.random = () => 0; startEnemyTurn()");
  assert.equal(read(context, "run.hull"), 1);
  assert.equal(read(context, "run.combat.deathDelayReady"), false);
  read(context, "startEnemyTurn()");
  assert.equal(read(context, "run.hull"), 0);
});

test("죽음 유예가 첫 치명타를 막아도 남은 적의 행동은 계속된다", () => {
  const context = combatForCaptain("revenant", ["revenant_death_delay"], { enemyCount: 3, hull: 1 });
  playNamed(context, "revenant_death_delay", "self");
  const actions = JSON.parse(read(context, "Math.random = () => 0; JSON.stringify(startEnemyTurn())"));
  assert.equal(actions.length, 2);
  assert.equal(read(context, "run.hull"), 0);
  assert.equal(read(context, "run.combat.deathDelayReady"), false);
});

test("순풍 항로는 다음 플레이어 턴까지 강제되고 그 뒤 만료된다", () => {
  const context = combatForCaptain("navigator", ["navigator_tailwind_route"]);
  playNamed(context, "navigator_tailwind_route", "sea");
  read(context, `
    run.combat.wind = { direction: "역풍", speed: 1 };
    run.combat.pendingEnemyTurn = { actions: [], playerHullBefore: run.hull };
    Math.random = () => 0.9;
    finishEnemyTurn();
  `);
  assert.equal(read(context, "run.combat.cardState.turn"), 2);
  assert.equal(read(context, "run.combat.wind.direction"), "순풍");
  read(context, `
    run.combat.wind = { direction: "역풍", speed: 1 };
    run.combat.pendingEnemyTurn = { actions: [], playerHullBefore: run.hull };
    finishEnemyTurn();
  `);
  assert.equal(read(context, "run.combat.cardState.turn"), 3);
  assert.equal(read(context, "run.combat.wind.direction"), "역풍");
});

const captainSkills = [
  { captain: "gunner", want: { hull: 89, sails: 26, playerHull: 50, playerSails: 10, morale: 20, ranges: [2, 2, 2], evasion: 0 } },
  { captain: "navigator", want: { hull: 100, sails: 23, playerHull: 50, playerSails: 15, morale: 20, ranges: [3, 3, 3], evasion: 0.8 } },
  { captain: "mystic", want: { hull: 96, sails: 23, crew: 16, playerHull: 50, playerSails: 10, morale: 25, ranges: [2, 2, 2], evasion: 0 } },
  { captain: "revenant", want: { hull: 91, sails: 25, playerHull: 58, playerSails: 10, morale: 20, ranges: [2, 2, 2], evasion: 0 } },
];

for (const row of captainSkills) {
  test(`${row.captain} 선장 기술은 에너지 없이 한 번만 쓰고 턴을 끝내지 않는다`, () => {
    const context = combatForCaptain(row.captain, ["fire"], { enemyCount: 3 });
    const beforeEnergy = read(context, "run.combat.cardState.energy");
    assert.equal(useSkill(context, "enemy-0"), true);
    assert.equal(read(context, "run.combat.cardState.energy"), beforeEnergy);
    assert.equal(read(context, "run.combat.locked"), false);
    assert.equal(read(context, "run.combat.enemyActions"), 0);
    assert.equal(useSkill(context, "enemy-0"), false);
    const actual = JSON.parse(read(context, `JSON.stringify({
      hull: run.combat.enemies[0].hull, sails: run.combat.enemies[0].sails,
      crew: run.combat.enemies[0].crew, playerHull: run.hull, playerSails: run.sails,
      morale: run.morale, ranges: run.combat.enemies.map((enemy) => enemy.range),
      evasion: run.combat.evasion,
    })`));
    assert.deepEqual(actual, { crew: 20, ...row.want });
  });
}

test("선장 기술의 잘못된 대상과 모달은 준비 상태를 소비하지 않는다", () => {
  const context = combatForCaptain("gunner", ["fire"]);
  assert.match(read(context, 'captainSkillError("missing")'), /대상/);
  assert.equal(useSkill(context, "missing"), false);
  assert.equal(read(context, "run.combat.skillReady"), true);
  read(context, "ui.modalLayer.hidden = false");
  assert.match(read(context, 'captainSkillError("enemy-0")'), /모달/);
  assert.equal(useSkill(context, "enemy-0"), false);
  assert.equal(read(context, "run.combat.skillReady"), true);
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

test("갑판장은 가장 강한 한 명만 적용하고 등급별 턴 효과를 제공한다", () => {
  assert.deepEqual(calculateEnergy({ crew: [crew("boatswain", "normal"), crew("boatswain", "rare")] }), {
    maxEnergy: 3, handSize: 5, openingDrawBonus: 1, turnEnergy: 1,
  });
  assert.equal(calculateEnergy({ crew: [crew("boatswain", "epic")], turn: 2 }).turnEnergy, 1);
  assert.equal(calculateEnergy({ crew: [crew("boatswain", "epic")], turn: 3 }).turnEnergy, 0);
});

test("모래시계와 축전기는 지정 턴 임시 에너지를 최대 에너지 너머로 더한다", () => {
  assert.equal(calculateEnergy({ artifacts: ["navigatorHourglass"], turn: 1 }).turnEnergy, 1);
  assert.equal(calculateEnergy({ artifacts: ["navigatorHourglass"], turn: 2 }).turnEnergy, 0);
  assert.equal(calculateEnergy({ artifacts: ["brassCapacitor"], turn: 3 }).turnEnergy, 1);
  assert.equal(calculateEnergy({ artifacts: ["brassCapacitor"], turn: 6 }).turnEnergy, 1);

  const context = combatForCaptain("gunner", ["fire"], {
    artifacts: ["navigatorHourglass", "tyrantFleetSeal"],
    crew: [crew("boatswain", "epic")],
  });
  read(context, "startCombat('battle')");
  assert.equal(read(context, "run.combat.cardState.maxEnergy"), 4);
  assert.equal(read(context, "run.combat.cardState.energy"), 6);
});

test("첫 턴 실제 손패와 에너지는 유물 및 갑판장 보너스를 함께 적용한다", () => {
  const context = combatForCaptain("gunner", ["fire", "chain", "approach", "retreat", "repair", "board"], {
    artifacts: ["tyrantFleetSeal"], crew: [crew("boatswain", "rare")],
  });
  read(context, "run.deck = ['fire', 'chain', 'approach', 'retreat', 'repair', 'board']; startCombat('battle')");
  assert.equal(read(context, "run.combat.cardState.maxEnergy"), 4);
  assert.equal(read(context, "run.combat.cardState.energy"), 5);
  assert.equal(read(context, "run.combat.cardState.hand.length"), 5);
  assert.equal(read(context, "run.combat.cardState.handSize"), 4);
});

test("밀수업자의 도르래는 매 턴 첫 비용 0 카드에만 에너지 1을 준다", () => {
  const context = combatForCaptain("gunner", ["rapid_fire", "hard_turn"], { artifacts: ["smugglerPulley"], energy: 4 });
  read(context, "run.combat.cardState.energy = 0");
  playNamed(context, "rapid_fire", "enemy-0");
  assert.equal(read(context, "run.combat.cardState.energy"), 1);
  assert.equal(read(context, "run.combat.smugglerPulleyUsed"), true);
  playNamed(context, "hard_turn", "sea");
  assert.equal(read(context, "run.combat.cardState.energy"), 1);
});

test("밀수업자의 도르래 사용 상태는 새 플레이어 턴에 초기화된다", () => {
  const context = combatForCaptain("gunner", ["rapid_fire"], { artifacts: ["smugglerPulley"] });
  read(context, `
    run.combat.smugglerPulleyUsed = true;
    run.combat.pendingEnemyTurn = { actions: [], playerHullBefore: run.hull };
    Math.random = () => 0.9;
    finishEnemyTurn();
  `);
  assert.equal(read(context, "run.combat.smugglerPulleyUsed"), false);
});

test("절약가가 있어도 손패에 표시되는 코스트는 할인 전 실제 비용이다", () => {
  const members = [crew("cook", "normal", "frugal")];
  const context = combatForCaptain("gunner", ["fire", "chain"], { crew: members, energy: 3 });
  assert.equal(read(context, "displayCardCost(run.combat.cardState.hand[0])"), 1);
  assert.equal(read(context, "effectiveCardCost(run.combat.cardState.hand[0])"), 0);
  assert.equal(playNamed(context, "fire", "enemy-0"), true);
  assert.equal(read(context, "displayCardCost(run.combat.cardState.hand[0])"), 1);
  assert.equal(read(context, "effectiveCardCost(run.combat.cardState.hand[0])"), 1);
});

test("절약가는 전투 첫 카드에 한 번만 적용되고 중복 선원은 중첩되지 않는다", () => {
  const members = [crew("cook", "normal", "frugal"), crew("gunner", "normal", "frugal")];
  const context = combatForCaptain("gunner", ["fire", "fire"], { crew: members, energy: 1 });
  assert.equal(playNamed(context, "fire", "enemy-0"), true);
  assert.equal(read(context, "run.combat.cardState.energy"), 1);
  assert.equal(read(context, "run.combat.frugalUsed"), true);
  assert.equal(playNamed(context, "fire", "enemy-0"), true);
  assert.equal(read(context, "run.combat.cardState.energy"), 0);
});

test("분발은 에너지가 0이 될 때 전투당 한 번만 회복한다", () => {
  const members = [crew("cook", "normal", "rallying"), crew("gunner", "normal", "rallying")];
  const context = combatForCaptain("gunner", ["fire", "fire", "fire"], { crew: members, energy: 2 });
  playNamed(context, "fire", "enemy-0");
  playNamed(context, "fire", "enemy-0");
  assert.equal(read(context, "run.combat.cardState.energy"), 1);
  assert.equal(read(context, "run.combat.rallyingUsed"), true);
  playNamed(context, "fire", "enemy-0");
  assert.equal(read(context, "run.combat.cardState.energy"), 0);
});

test("갑판장 역할과 에너지 특성 ID가 콘텐츠 풀에 등록된다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  assert.equal(read(context, 'CREW_ROLES.boatswain.label'), "갑판장");
  assert.deepEqual(JSON.parse(read(context, 'JSON.stringify(TRAITS.filter((trait) => ["frugal", "rallying"].includes(trait.id)).map((trait) => trait.id))')), ["frugal", "rallying"]);
  assert.deepEqual(JSON.parse(read(context, 'JSON.stringify(ARTIFACTS.filter((artifact) => ["navigatorHourglass", "brassCapacitor", "smugglerPulley", "tyrantFleetSeal"].includes(artifact.id)).map((artifact) => artifact.id))')), ["navigatorHourglass", "brassCapacitor", "smugglerPulley", "tyrantFleetSeal"]);
});

test("사기 0이면 luckyRandomInt는 항상 첫 굴림 값만 사용한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const result = read(context, `(() => {
    run = { morale: 0 };
    const rolls = [0, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(result, 1);
});

test("사기 100이면 luckyRandomInt는 항상 재굴림 후 더 큰 값을 채택한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const result = read(context, `(() => {
    run = { morale: 100 };
    const rolls = [0, 0, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(result, 10);
});

test("사기 50이면 재굴림 확률 체크는 Math.random() < 0.5로 이루어진다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const notRerolled = read(context, `(() => {
    run = { morale: 50 };
    const rolls = [0, 0.5, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(notRerolled, 1);

  const rerolled = read(context, `(() => {
    run = { morale: 50 };
    const rolls = [0, 0.49, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(rerolled, 10);
});

test("cannonDamage는 luckyRandomInt(2, 6)을 사용한다", () => {
  const context = combatForCaptain("gunner", ["fire"], { morale: 60 });
  const calls = JSON.parse(read(context, `JSON.stringify((() => {
    const calls = [];
    luckyRandomInt = (min, max) => { calls.push([min, max]); return max; };
    playCard(run.combat.cardState.hand[0].instanceId, "enemy-0");
    return calls;
  })())`));
  assert.deepEqual(calls, [[2, 6]]);
});

test("사슬탄 계열 카드(chain, heavy_chain, entangling_chain)는 luckyRandomInt로 피해를 굴린다", () => {
  const context = combatForCaptain("gunner", ["chain", "heavy_chain", "entangling_chain"], { morale: 40 });
  const calls = JSON.parse(read(context, `JSON.stringify((() => {
    const calls = [];
    luckyRandomInt = (min, max) => { calls.push([min, max]); return max; };
    playCard(run.combat.cardState.hand.find((c) => c.cardId === "chain").instanceId, "enemy-0");
    playCard(run.combat.cardState.hand.find((c) => c.cardId === "heavy_chain").instanceId, "enemy-0");
    playCard(run.combat.cardState.hand.find((c) => c.cardId === "entangling_chain").instanceId, "enemy-0");
    return calls;
  })())`));
  assert.deepEqual(calls, [[6, 10], [6, 10], [3, 6]]);
});

test("cannonDamage는 PLAYER_DAMAGE_SCALE(0.8)만큼 낮아진 값을 반환한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const result = read(context, `(() => {
    run = { cannons: 6, crew: [], artifacts: [], morale: 0 };
    luckyRandomInt = () => 4; // 스케일 전 기본 굴림값을 고정
    return cannonDamage();
  })()`);
  // 스케일 전: getCannonPower()(6) + luckyRandomInt(4) = 10 → 스케일 후: round(10 * 0.8) = 8
  assert.equal(result, 8);
});

test("combatCannonDamageRange는 cannonDamage와 같은 스케일로 범위를 표시한다", () => {
  const context = combatForCaptain("gunner", ["fire"], { morale: 0 });
  const range = read(context, "combatCannonDamageRange()");
  // gunner 기본 화력은 6(run.cannons), 크루 보너스 0.
  // 스케일 전 범위: 6+2=8 ~ 6+6=12 → 스케일 후: round(8*0.8)=6 ~ round(12*0.8)=10
  assert.equal(range, "6~10");
});

test("chain 카드는 스케일이 적용된 돛 피해를 준다", () => {
  const context = combatForCaptain("gunner", ["chain"], { morale: 0 });
  read(context, "Math.random = () => 0; luckyRandomInt = () => 6;"); // 스케일 전 최소 굴림값 고정
  const before = read(context, "run.combat.enemies[0].sails");
  playNamed(context, "chain", "enemy-0");
  const after = read(context, "run.combat.enemies[0].sails");
  // 스케일 전: luckyRandomInt(6) + gunnerBonus(0) + chainLocker(0) = 6 → 스케일 후: round(6 * 0.8) = 5
  assert.equal(before - after, 5);
});

test("heavy_chain 카드는 +8 보너스를 포함한 전체 값에 스케일이 적용된다", () => {
  const context = combatForCaptain("gunner", ["heavy_chain"], { morale: 0 });
  read(context, "Math.random = () => 0; luckyRandomInt = () => 6;");
  const before = read(context, "run.combat.enemies[0].sails");
  playNamed(context, "heavy_chain", "enemy-0");
  const after = read(context, "run.combat.enemies[0].sails");
  // 스케일 전: 6 + 0 + 0 + 8 = 14 → 스케일 후: round(14 * 0.8) = 11
  assert.equal(before - after, 11);
});

test("chain_rain 카드는 스케일이 적용된 고정 돛 피해를 각 적에게 준다", () => {
  const context = combatForCaptain("gunner", ["chain_rain"], { morale: 0, enemyCount: 3 });
  read(context, "Math.random = () => 0;");
  const before = JSON.parse(read(context, "JSON.stringify(run.combat.enemies.map((enemy) => enemy.sails))"));
  playNamed(context, "chain_rain", "allEnemies");
  const after = JSON.parse(read(context, "JSON.stringify(run.combat.enemies.map((enemy) => enemy.sails))"));
  // 스케일 전: 5 + gunnerBonus(0) = 5 → 스케일 후: round(5 * 0.8) = 4, 3척 모두 동일
  assert.deepEqual(before.map((sails, index) => sails - after[index]), [4, 4, 4]);
});

test("combatCardDescription의 사슬탄 범위는 실제 계산과 같은 스케일을 표시한다", () => {
  const context = combatForCaptain("gunner", ["chain", "heavy_chain", "entangling_chain"], { morale: 0 });
  const chainDesc = read(context, `combatCardDescription(CardDefinitions.getCard("chain"))`);
  const heavyDesc = read(context, `combatCardDescription(CardDefinitions.getCard("heavy_chain"))`);
  const entangleDesc = read(context, `combatCardDescription(CardDefinitions.getCard("entangling_chain"))`);
  // chain 스케일 전 6~10 → 스케일 후 5~8
  assert.match(chainDesc, /돛 5~8 피해/);
  // heavy_chain 스케일 전 14~18 → 스케일 후 11~14
  assert.match(heavyDesc, /돛 11~14 피해/);
  // entangling_chain 스케일 전 3~6 → 스케일 후 2~5
  assert.match(entangleDesc, /돛 2~5 피해/);
});

// combatCannonDamageRange()는 cannonDamage()의 실제 반올림 순서(스케일 적용 후 반올림 -> 배수/보너스 적용 후
// 다시 반올림)를 그대로 흉내내야 한다. 단일 반올림으로 계산하면 배수가 1이 아닌 카드(rapid_fire 등)에서
// 표시값과 실제 값이 어긋나는 이중 반올림 불일치가 생길 수 있다 (예: 화력 9 + 화약고 아티팩트).
test("combatCannonDamageRange의 각 (배수, 보너스) 조합은 cannonDamage() 기반 실제 계산과 정확히 일치한다", () => {
  // 카드 설명에서 실제로 사용되는 (multiplier, bonus) 조합.
  const pairs = [
    { label: "fire", multiplier: 1, bonus: 0 },
    { label: "aimed_fire", multiplier: 1, bonus: 6 },
    { label: "rapid_fire/barrage_fire/gunner_shrapnel", multiplier: 0.6, bonus: 0 },
    { label: "gunner_double_broadside", multiplier: 0.7, bonus: 0 },
    { label: "gunner_overcharge", multiplier: 1, bonus: 8 },
  ];
  const combos = [
    { cannons: 6, powder: false },
    { cannons: 9, powder: true },
  ];

  combos.forEach(({ cannons, powder }) => {
    const context = loadGameScripts(GAME_SCRIPTS);
    read(context, `
      run = { cannons: ${cannons}, crew: [], artifacts: ${JSON.stringify(powder ? [{ id: "powder" }] : [])}, morale: 0 };
    `);

    pairs.forEach(({ label, multiplier, bonus }) => {
      // 실제 게임플레이가 카드에서 하는 그대로: cannonDamage()를 굴리고 배수/보너스를 적용한 뒤 다시 반올림한다.
      const actualMinimum = read(context, `(() => {
        luckyRandomInt = () => 2;
        return Math.max(1, Math.round(cannonDamage() * ${multiplier} + ${bonus}));
      })()`);
      const actualMaximum = read(context, `(() => {
        luckyRandomInt = () => 6;
        return Math.max(1, Math.round(cannonDamage() * ${multiplier} + ${bonus}));
      })()`);
      const expected = actualMinimum === actualMaximum ? `${actualMinimum}` : `${actualMinimum}~${actualMaximum}`;

      const displayed = read(context, `combatCannonDamageRange(${multiplier}, ${bonus})`);

      assert.equal(
        displayed,
        expected,
        `${label} (cannons=${cannons}, powder=${powder}): 툴팁 "${displayed}" vs 실제 "${expected}"`,
      );
    });
  });
});

test("infamySkillScale은 악명 0/60/100/150에서 각각 0.7/1.0/1.2/1.2를 반환한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const at = (infamy) => read(context, `(() => { run = { infamy: ${infamy} }; return infamySkillScale(); })()`);
  assert.equal(at(0), 0.7);
  assert.equal(at(60), 1);
  assert.equal(at(100), 1.2);
  assert.equal(at(150), 1.2);
});

test("포수 스킬은 악명에 따라 12+화력*0.8 기반 선체 피해가 스케일된다", () => {
  const context = combatForCaptain("gunner", ["fire"]);
  read(context, "run.infamy = 0;");
  const before0 = read(context, "run.combat.enemies[0].hull");
  useSkill(context, "enemy-0");
  const after0 = read(context, "run.combat.enemies[0].hull");
  // 화력 6(run.cannons) 기준: 12 + floor(6*0.8) = 16 → 악명 0: round(16*0.7) = 11
  assert.equal(before0 - after0, 11);

  const context2 = combatForCaptain("gunner", ["fire"]);
  read(context2, "run.infamy = 100;");
  const before100 = read(context2, "run.combat.enemies[0].hull");
  useSkill(context2, "enemy-0");
  const after100 = read(context2, "run.combat.enemies[0].hull");
  // 악명 100+: round(16*1.2) = 19
  assert.equal(before100 - after100, 19);
});

test("조타수 스킬은 악명에 따라 10+포수보너스 기반 돛 피해가 스케일된다", () => {
  const context = combatForCaptain("navigator", ["approach"]);
  read(context, "run.infamy = 0;");
  const before = read(context, "run.combat.enemies[0].sails");
  useSkill(context, "enemy-0");
  const after = read(context, "run.combat.enemies[0].sails");
  // 크루 없음(포수 보너스 0) 기준: 10 → 악명 0: round(10*0.7) = 7
  assert.equal(before - after, 7);
});

test("주술사 스킬은 악명에 따라 고정값 6 기반 선체 피해가 스케일된다", () => {
  const context = combatForCaptain("mystic", ["approach"]);
  read(context, "run.infamy = 60;");
  const before = read(context, "run.combat.enemies[0].hull");
  useSkill(context, "enemy-0");
  const after = read(context, "run.combat.enemies[0].hull");
  // 악명 60: round(6*1.0) = 6
  assert.equal(before - after, 6);
});

test("망령 스킬은 악명에 따라 10+화력*0.5 기반 선체 피해가 스케일된다", () => {
  const context = combatForCaptain("revenant", ["approach"]);
  read(context, "run.infamy = 0;");
  const before = read(context, "run.combat.enemies[0].hull");
  useSkill(context, "enemy-0");
  const after = read(context, "run.combat.enemies[0].hull");
  // 화력 6 기준: 10 + floor(6*0.5) = 13 → 악명 0: round(13*0.7) = 9
  assert.equal(before - after, 9);
});


