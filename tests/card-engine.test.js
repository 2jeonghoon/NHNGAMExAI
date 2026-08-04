"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

function loadEngine() {
  return loadGameScripts(["src/card-definitions.js", "src/card-engine.js"]);
}

function makeTenCardState() {
  const context = loadEngine();
  return {
    engine: read(context, "CardEngine"),
    state: read(context, "CardEngine.createState(CardDefinitions.STARTER_DECK, () => 0)"),
  };
}

test("턴 종료는 손패를 버리고 다음 턴에 에너지와 손패를 채운다", () => {
  const context = loadEngine();
  const engine = read(context, "CardEngine");
  const state = engine.createState(read(context, "CardDefinitions.STARTER_DECK"), () => 0, {
    maxEnergy: 3, handSize: 5, handLimit: 8,
  });
  assert.equal(state.hand.length, 5);
  assert.equal(state.energy, 3);
  engine.endPlayerTurn(state);
  assert.equal(state.hand.length, 0);
  assert.equal(state.discardPile.length, 5);
  engine.startPlayerTurn(state, {}, () => 0);
  assert.equal(state.turn, 2);
  assert.equal(state.energy, 3);
  assert.equal(state.hand.length, 5);
});

test("소멸 카드는 재순환하지 않고 손패는 8장을 넘지 않는다", () => {
  const { engine, state } = makeTenCardState();
  const first = state.hand[0];
  engine.finishCard(state, first.instanceId, true);
  engine.drawCards(state, 20, () => 0);
  assert.equal(state.exhaustPile.some((card) => card.instanceId === first.instanceId), true);
  assert.equal(state.hand.length, 8);
});

test("비용 부족 카드는 에너지를 바꾸지 않고, 턴 비용 감소는 0까지 적용한다", () => {
  const context = loadEngine();
  const engine = read(context, "CardEngine");
  const state = engine.createState(["board"], () => 0, { maxEnergy: 3, handSize: 1 });
  const instanceId = state.hand[0].instanceId;

  assert.equal(engine.canPay(state, instanceId), true);
  assert.equal(engine.spendForCard(state, instanceId), 2);
  assert.equal(state.energy, 1);
  assert.equal(engine.canPay(state, instanceId), false);
  assert.equal(engine.spendForCard(state, instanceId), 0);
  assert.equal(state.energy, 1);

  engine.setTurnCostDelta(state, instanceId, -2);
  assert.equal(engine.canPay(state, instanceId), true);
  assert.equal(engine.spendForCard(state, instanceId), 0);
  assert.equal(state.energy, 1);
});

test("카드 완료는 지정한 손패 인스턴스만 한 번 이동시키고 턴 종료는 임시 비용을 초기화한다", () => {
  const context = loadEngine();
  const engine = read(context, "CardEngine");
  const state = engine.createState(["fire", "chain"], () => 0, { handSize: 2 });
  const first = state.hand[0];
  const second = state.hand[1];

  engine.setTurnCostDelta(state, second.instanceId, -1);
  engine.finishCard(state, first.instanceId, false);
  engine.finishCard(state, first.instanceId, false);
  assert.deepEqual(Array.from(state.hand, (card) => card.instanceId), [second.instanceId]);
  assert.deepEqual(Array.from(state.discardPile, (card) => card.instanceId), [first.instanceId]);

  engine.endPlayerTurn(state);
  assert.equal(state.discardPile.find((card) => card.instanceId === second.instanceId).costDelta, 0);
});
