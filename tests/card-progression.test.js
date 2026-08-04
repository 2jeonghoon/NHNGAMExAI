"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, makeElement, read, runGame } = require("./helpers/load-game.js");

function deterministicChoices(captainId, count, randomValues = [0.05, 0.15, 0.65, 0.35, 0.95, 0.75]) {
  return runGame(`
    const values = ${JSON.stringify(randomValues)};
    let index = 0;
    drawCardChoices(${JSON.stringify(captainId)}, ${count}, () => values[index++ % values.length]);
  `);
}

function cardRemovalPriceFor(cardRemovals) {
  return runGame(`
    run = makeTestRun({ cardRemovals: ${cardRemovals} });
    cardRemovalPrice();
  `);
}

function canRemoveFromDeck(deck, gold = 999) {
  return runGame(`
    run = makeTestRun({ mode: "port", deck: ${JSON.stringify(deck)}, gold: ${gold}, cardRemovals: 0 });
    canRemoveCard();
  `);
}

function rewardContinuation(kind) {
  return runGame(`
    run = makeTestRun({
      mode: "combat", captainId: "gunner", mapId: "calm", rewardMultiplier: 1,
      artifacts: [], crew: [], logs: [], infamy: 0, gold: 0, morale: 50,
      combat: {
        capturedCount: 0, rewardGold: 10, rewardInfamy: 5,
        enemies: [{ id: "enemy-0", name: "시험선", kind: ${JSON.stringify(kind)} }],
      },
    });
    const sequence = [];
    let victoryAction;
    let cardDone;
    let artifactDone;
    setModalBase = (_eyebrow, title) => sequence.push("stats:" + title);
    addModalActions = (actions) => { victoryAction = actions[0].onClick; };
    showCardReward = (afterChoice) => { sequence.push("card"); cardDone = afterChoice; };
    showArtifactChoice = (_title, afterChoice) => { sequence.push("artifact"); artifactDone = afterChoice; };
    returnToMap = () => sequence.push("map");
    completeAct = () => sequence.push("act");
    winCombat();
    winCombat();
    victoryAction();
    cardDone();
    if (artifactDone) artifactDone();
    sequence;
  `);
}

test("보상 세 장은 중복이 없고 현재 선장 카드만 포함한다", () => {
  const choices = deterministicChoices("navigator", 3);
  assert.equal(new Set(choices.map((card) => card.id)).size, choices.length);
  assert.equal(choices.every((card) => !card.captainId || card.captainId === "navigator"), true);
});

test("보상 등급 추첨은 남은 등급 가중치를 재정규화한다", () => {
  const choices = deterministicChoices("mystic", 3, [0.99, 0, 0.99, 0, 0.99, 0]);
  assert.deepEqual(Array.from(choices, (card) => card.rarity), ["epic", "epic", "epic"]);
});

test("카드 제거 비용은 12부터 8씩 오르고 덱 5장에서 중단된다", () => {
  assert.equal(cardRemovalPriceFor(0), 12);
  assert.equal(cardRemovalPriceFor(1), 20);
  assert.equal(cardRemovalPriceFor(2), 28);
  assert.equal(canRemoveFromDeck(new Array(5).fill("fire")), false);
  assert.equal(canRemoveFromDeck(new Array(6).fill("fire"), 11), false);
  assert.equal(canRemoveFromDeck(new Array(6).fill("fire"), 12), true);
});

test("카드 보상은 중복 보유를 허용하고 획득 또는 건너뛰기 뒤 한 번만 계속한다", () => {
  const result = runGame(`
    run = makeTestRun({
      captainId: "gunner", deck: ["fire", "fire", "chain", "approach", "retreat"],
      crew: [], artifacts: [], logs: [], cardsAcquired: [], infamy: 0, cannons: 6,
    });
    Math.random = () => 0;
    let afterCount = 0;
    let skipAction;
    const cardActions = [];
    setModalBase = () => {};
    makeElement = (tag) => ({
      append() {},
      addEventListener(type, action) { if (tag === "button" && type === "click") cardActions.push(action); },
    });
    addModalActions = (actions) => { skipAction = actions[0].onClick; };
    showCardReward(() => { afterCount += 1; });
    cardActions[0]();
    cardActions[0]();
    const acquired = { deck: [...run.deck], afterCount, cardsAcquired: [...run.cardsAcquired] };

    run.deck = ["fire", "chain", "approach", "retreat", "board"];
    afterCount = 0;
    showCardReward(() => { afterCount += 1; });
    skipAction();
    skipAction();
    ({ acquired, skipped: { deck: [...run.deck], afterCount } });
  `);

  assert.equal(result.acquired.deck.length, 6);
  assert.equal(result.acquired.deck.filter((id) => id === "fire").length, 3);
  assert.deepEqual(Array.from(result.acquired.cardsAcquired), ["fire"]);
  assert.equal(result.acquired.afterCount, 1);
  assert.deepEqual(Array.from(result.skipped.deck), ["fire", "chain", "approach", "retreat", "board"]);
  assert.equal(result.skipped.afterCount, 1);
});

test("덱 버튼은 항해 중 현재 카드 수를 표시한다", () => {
  const deckButton = makeElement();
  const document = {
    addEventListener() {},
    createElement() { return makeElement(); },
    querySelector(selector) {
      if (selector === "#deckButton") return deckButton;
      const element = makeElement();
      if (selector === "#gameCanvas") {
        element.getContext = () => new Proxy({}, { get: (target, key) => target[key] ||= () => {} });
        element.width = 1200;
        element.height = 700;
      }
      return element;
    },
  };
  const context = loadGameScripts([
    "src/analytics.js",
    "src/card-definitions.js",
    "src/game.js",
  ], { document });
  read(context, `
    run = makeTestRun({
      captainId: "gunner", actIndex: 0, infamy: 0, hull: 30, maxHull: 30,
      sails: 20, maxSails: 20, morale: 50, food: 10, water: 10, gold: 20,
      cannons: 6, crew: [], artifacts: [], logs: [], deck: new Array(13).fill("fire"),
    });
    updateHud();
  `);

  assert.equal(read(context, "ui.deckButton.textContent"), "덱 13장");
  assert.equal(read(context, "ui.deckButton.disabled"), false);
});

test("카드 제거는 확인 전에는 바꾸지 않고 확인 뒤 현재 가격을 정확히 한 번 청구한다", () => {
  const result = runGame(`
    run = makeTestRun({
      mode: "port", captainId: "gunner", deck: ["fire", "fire", "chain", "approach", "retreat", "board"],
      gold: 50, cardRemovals: 0, crew: [], artifacts: [], logs: [], cardsRemoved: [], infamy: 0, cannons: 6,
    });
    let confirmAction;
    let removalScreens = 0;
    setModalBase = () => {};
    addModalActions = (actions) => { confirmAction = actions.find((action) => action.primary).onClick; };
    showCardRemoval = () => { removalScreens += 1; };
    removeCard(0);
    const before = { deck: [...run.deck], gold: run.gold, cardRemovals: run.cardRemovals };
    confirmAction();
    const after = { deck: [...run.deck], gold: run.gold, cardRemovals: run.cardRemovals, cardsRemoved: [...run.cardsRemoved], removalScreens };
    confirmAction();
    ({ before, after, final: { deck: [...run.deck], gold: run.gold, cardRemovals: run.cardRemovals } });
  `);

  assert.deepEqual(Array.from(result.before.deck), ["fire", "fire", "chain", "approach", "retreat", "board"]);
  assert.equal(result.before.gold, 50);
  assert.equal(result.before.cardRemovals, 0);
  assert.deepEqual(Array.from(result.after.deck), ["fire", "chain", "approach", "retreat", "board"]);
  assert.equal(result.after.gold, 38);
  assert.equal(result.after.cardRemovals, 1);
  assert.deepEqual(Array.from(result.after.cardsRemoved), ["fire"]);
  assert.equal(result.after.removalScreens, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.final)), {
    deck: ["fire", "chain", "approach", "retreat", "board"], gold: 38, cardRemovals: 1,
  });
});

test("카드 획득과 제거는 카드 ID를 분석 기록에 남긴다", () => {
  const events = runGame(`
    run = makeTestRun({
      mode: "port", captainId: "gunner", deck: ["fire", "fire", "chain", "approach", "retreat", "board"],
      gold: 50, cardRemovals: 0, crew: [], artifacts: [], logs: [], infamy: 0, cannons: 6,
    });
    const recorded = [];
    Analytics.recordEvent = (event) => recorded.push(event);
    updateHud = () => {};
    logEvent = () => {};
    playTone = () => {};
    let confirmAction;
    setModalBase = () => {};
    addModalActions = (actions) => { confirmAction = actions.find((action) => action.primary).onClick; };
    showCardRemoval = () => {};
    acquireCard("gunner_steady_aim");
    removeCard(0);
    confirmAction();
    recorded;
  `);

  assert.deepEqual(Array.from(events), ["card_acquired:gunner_steady_aim", "card_removed:fire"]);
});

test("제거 서비스 밖에서는 덱을 열람만 할 수 있다", () => {
  const result = runGame(`
    run = makeTestRun({ mode: "map", deck: ["fire", "fire", "chain", "approach", "retreat", "board"], gold: 50, cardRemovals: 0 });
    let inspections = 0;
    showDeck = () => { inspections += 1; };
    showCardRemoval();
    removeCard(0);
    ({ inspections, deck: [...run.deck], gold: run.gold, cardRemovals: run.cardRemovals });
  `);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    inspections: 1,
    deck: ["fire", "fire", "chain", "approach", "retreat", "board"],
    gold: 50,
    cardRemovals: 0,
  });
});

test("일반 함대 승리는 통계에서 카드 보상 하나를 거쳐 항로로 복귀한다", () => {
  assert.deepEqual(Array.from(rewardContinuation("battle")), ["stats:승리", "card", "map"]);
});

test("정예와 보스 승리는 카드 보상 뒤 유물 보상을 거쳐 각각 복귀와 해역 완료로 이어진다", () => {
  assert.deepEqual(Array.from(rewardContinuation("elite")), ["stats:승리", "card", "artifact", "map"]);
  assert.deepEqual(Array.from(rewardContinuation("boss")), ["stats:승리", "card", "artifact", "act"]);
});
