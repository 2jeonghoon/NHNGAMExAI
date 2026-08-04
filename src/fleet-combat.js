"use strict";

const FleetCombat = (() => {
  const FORMATIONS = Object.freeze({
    calm: { battle: () => 1, elite: () => 1, boss: () => 1 },
    storm: {
      battle: (act, roll) => roll < (act === 0 ? 0.4 : 0.6) ? 2 : 1,
      elite: () => 2,
      boss: () => 1,
    },
    abyss: {
      battle: () => 2,
      elite: (_act, roll) => roll < 0.5 ? 3 : 2,
      boss: () => 1,
    },
  });

  const STAT_SCALES = Object.freeze({ 1: 1, 2: 0.65, 3: 0.5 });
  const REWARD_SCALES = Object.freeze({ 1: 1, 2: 1.25, 3: 1.5 });
  const SLOT_TABLE = Object.freeze({
    1: Object.freeze([{ x: 900, y: 450, scale: 1.42 }]),
    2: Object.freeze([
      { x: 750, y: 360, scale: 0.95 },
      { x: 1040, y: 500, scale: 0.95 },
    ]),
    3: Object.freeze([
      { x: 740, y: 275, scale: 0.72 },
      { x: 1045, y: 380, scale: 0.72 },
      { x: 780, y: 540, scale: 0.72 },
    ]),
  });

  function enemyCount(mapId, kind, actIndex, randomFn = Math.random) {
    const route = FORMATIONS[mapId] || FORMATIONS.calm;
    const formation = route[kind] || route.battle;
    return formation(actIndex, randomFn());
  }

  function statScale(count) {
    return STAT_SCALES[count] || 1;
  }

  function rewardScale(count) {
    return REWARD_SCALES[count] || 1;
  }

  function attackBudget(mapId, livingCount) {
    const routeLimit = mapId === "abyss" ? 2 : 1;
    return Math.max(0, Math.min(livingCount, routeLimit));
  }

  function livingEnemies(enemies) {
    return enemies.filter((enemy) => !enemy.defeated && !enemy.captured);
  }

  function isDefeated(enemies) {
    return livingEnemies(enemies).length === 0;
  }

  function layoutSlots(count) {
    const slots = SLOT_TABLE[count] || SLOT_TABLE[1];
    return slots.map((slot) => ({ ...slot }));
  }

  return Object.freeze({
    enemyCount,
    statScale,
    rewardScale,
    attackBudget,
    livingEnemies,
    isDefeated,
    layoutSlots,
  });
})();
