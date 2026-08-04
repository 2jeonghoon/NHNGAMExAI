"use strict";

const CardEngine = (() => {
  function shuffleInstances(instances, randomFn = Math.random) {
    for (let index = instances.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(randomFn() * (index + 1));
      [instances[index], instances[swapIndex]] = [instances[swapIndex], instances[index]];
    }
    return instances;
  }

  function effectiveCost(instance) {
    const definition = CardDefinitions.getCard(instance.cardId);
    return Math.max(0, (definition?.cost || 0) + instance.costDelta);
  }

  function findHandInstance(state, instanceId) {
    return state.hand.find((instance) => instance.instanceId === instanceId) || null;
  }

  function drawCards(state, count, randomFn = Math.random) {
    const drawn = [];
    while (drawn.length < count && state.hand.length < state.handLimit) {
      if (state.drawPile.length === 0) {
        if (state.discardPile.length === 0) break;
        state.drawPile = shuffleInstances(state.discardPile.splice(0), randomFn);
      }
      const card = state.drawPile.pop();
      card.costDelta = 0;
      state.hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  function createState(cardIds, randomFn = Math.random, options = {}) {
    const state = {
      drawPile: [],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      energy: options.maxEnergy ?? 3,
      maxEnergy: options.maxEnergy ?? 3,
      handSize: options.handSize ?? 5,
      handLimit: options.handLimit ?? 8,
      turn: 1,
      nextInstanceId: 1,
    };
    state.drawPile = shuffleInstances(cardIds.map((cardId) => ({
      instanceId: `card-${state.nextInstanceId++}`,
      cardId,
      costDelta: 0,
    })), randomFn);
    drawCards(state, state.handSize, randomFn);
    return state;
  }

  function startPlayerTurn(state, modifiers = {}, randomFn = Math.random) {
    state.turn += 1;
    state.energy = state.maxEnergy + (modifiers.energy ?? 0);
    drawCards(state, state.handSize + (modifiers.handSize ?? 0), randomFn);
  }

  function canPay(state, instanceId) {
    const instance = findHandInstance(state, instanceId);
    return Boolean(instance) && state.energy >= effectiveCost(instance);
  }

  function spendForCard(state, instanceId) {
    const instance = findHandInstance(state, instanceId);
    if (!instance || !canPay(state, instanceId)) return 0;
    const cost = effectiveCost(instance);
    state.energy -= cost;
    return cost;
  }

  function finishCard(state, instanceId, exhaust) {
    const index = state.hand.findIndex((instance) => instance.instanceId === instanceId);
    if (index === -1) return;
    const [instance] = state.hand.splice(index, 1);
    (exhaust ? state.exhaustPile : state.discardPile).push(instance);
  }

  function endPlayerTurn(state) {
    state.hand.forEach((instance) => {
      instance.costDelta = 0;
    });
    state.discardPile.push(...state.hand.splice(0));
  }

  function setTurnCostDelta(state, instanceId, delta) {
    const instance = findHandInstance(state, instanceId);
    if (instance) instance.costDelta = delta;
  }

  return Object.freeze({
    createState,
    drawCards,
    startPlayerTurn,
    canPay,
    spendForCard,
    finishCard,
    endPlayerTurn,
    setTurnCostDelta,
  });
})();
