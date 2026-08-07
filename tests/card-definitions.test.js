"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { installGameFixtures, loadGameScripts, read, runGame } = require("./helpers/load-game.js");

function loadCards() {
  return loadGameScripts(["src/card-definitions.js"]);
}

function readStarterDeck() {
  return readJson(loadCards(), "CardDefinitions.STARTER_DECK");
}

function readJson(context, expression) {
  return JSON.parse(read(context, `JSON.stringify(${expression})`));
}

test("카드 카탈로그는 공용 21종과 선장별 7종으로 구성된다", () => {
  const context = loadCards();
  const summary = readJson(context, `(() => {
    const cards = Object.values(CardDefinitions.CARD_DEFINITIONS);
    return {
      total: cards.length,
      ids: new Set(cards.map((card) => card.id)).size,
      common: cards.filter((card) => !card.captainId).length,
      captainCounts: Object.fromEntries(["gunner", "navigator", "mystic", "revenant"].map(
        (id) => [id, cards.filter((card) => card.captainId === id).length],
      )),
    };
  })()`);

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

test("카드는 안정된 효과 ID와 표시용 메타데이터를 제공한다", () => {
  const cards = readJson(loadCards(), "CardDefinitions.CARD_DEFINITIONS");

  assert.deepEqual(
    Object.keys(cards).sort(),
    [
      "fire", "aimed_fire", "rapid_fire", "chain", "heavy_chain", "entangling_chain",
      "approach", "tailwind_charge", "ram", "retreat", "hard_turn", "smoke_sail",
      "repair", "rigging_repair", "overhaul", "board", "grappling_hook", "desperate_board",
      "barrage_fire", "chain_rain", "fireship", "gunner_steady_aim", "gunner_shrapnel",
      "gunner_double_broadside", "gunner_powder_shift", "gunner_overcharge", "gunner_magazine_open",
      "gunner_fleet_broadside", "navigator_read_wind", "navigator_raise_sails",
      "navigator_crosswind_turn", "navigator_wave_ride", "navigator_tailwind_route",
      "navigator_reposition", "navigator_storm_corridor", "mystic_abyss_mark", "mystic_cursed_tide",
      "mystic_fear_whisper", "mystic_dark_prophecy", "mystic_blood_pact", "mystic_open_abyss",
      "mystic_abyss_chorus", "revenant_dead_nails", "revenant_ghost_deckhand",
      "revenant_soul_drain", "revenant_sinking_memory", "revenant_death_delay",
      "revenant_return_abyss", "revenant_ghost_fleet",
    ].sort(),
  );
  assert.deepEqual(cards.aimed_fire, {
    id: "aimed_fire",
    name: "조준 포격",
    family: "포격",
    cost: 2,
    rarity: "rare",
    captainId: null,
    targetType: "enemy",
    exhaust: false,
    effect: "aimed_fire",
    description: "포격 명중률 +15%p, cannonDamage() + 6 선체 피해",
  });
  assert.deepEqual(cards.fireship, {
    id: "fireship",
    name: "화공선 방출",
    family: "광역",
    cost: 3,
    rarity: "epic",
    captainId: null,
    targetType: "allEnemies",
    exhaust: true,
    effect: "fireship",
    description: "모든 적에게 명중 보장 선체 10·돛 5 피해, 사기 4 감소",
  });
});

test("보상 풀은 현재 선장의 카드만 포함하고 새 배열을 반환한다", () => {
  const context = loadCards();
  const summary = readJson(context, `(() => {
    const gunnerPool = CardDefinitions.getRewardPool("gunner");
    const again = CardDefinitions.getRewardPool("gunner");
    gunnerPool.pop();
    return {
      count: again.length,
      hasGunner: again.some((card) => card.id === "gunner_fleet_broadside"),
      hasNavigator: again.some((card) => card.id === "navigator_storm_corridor"),
      afterMutation: CardDefinitions.getRewardPool("gunner").length,
    };
  })()`);

  assert.deepEqual(summary, { count: 28, hasGunner: true, hasNavigator: false, afterMutation: 28 });
});

test("정의되지 않은 카드 ID는 상속된 객체 이름도 null로 처리한다", () => {
  const context = loadCards();

  assert.equal(read(context, 'CardDefinitions.getCard("toString")'), null);
});

test("카탈로그와 시작 덱은 변경할 수 없다", () => {
  const context = loadCards();
  assert.deepEqual(readJson(context, `({
    catalog: Object.isFrozen(CardDefinitions.CARD_DEFINITIONS),
    card: Object.isFrozen(CardDefinitions.CARD_DEFINITIONS.fire),
    deck: Object.isFrozen(CardDefinitions.STARTER_DECK),
    weightsFrozen: Object.isFrozen(CardDefinitions.CARD_RARITY_WEIGHTS),
    weights: CardDefinitions.CARD_RARITY_WEIGHTS,
  })`), {
    catalog: true,
    card: true,
    deck: true,
    weightsFrozen: true,
    weights: { normal: 0.55, rare: 0.30, epic: 0.15 },
  });
});

test("공용 VM 하네스는 스크립트를 로드하고 결정적 전투 픽스처를 설치한다", () => {
  const result = JSON.parse(JSON.stringify(runGame(`(() => {
    const run = makeTestRun();
    const enemy = enemyState({ hull: 19 });
    return { deck: run.deck.length, hull: enemy.hull, enemyId: enemy.id };
  })()`)));

  assert.deepEqual(result, { deck: 10, hull: 19, enemyId: "enemy-1" });
  const context = vm.createContext({});
  installGameFixtures(context);
  assert.equal(read(context, "makeTestRun().captainId"), "gunner");
});
