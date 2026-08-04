"use strict";

/*
 * Lightweight play-data recorder. Keeps a JSON-serializable history of every
 * voyage in localStorage so results can be inspected or exported for analysis.
 * Pure data layer: no DOM/UI code lives here, game.js renders it.
 */
const Analytics = (() => {
  const STORAGE_KEY = "pirate-king-analytics-v1";
  const MAX_RUNS = 300;
  const NODE_TYPES = ["battle", "elite", "event", "port", "treasure", "boss"];
  const ACTIONS = ["fire", "chain", "approach", "retreat", "repair", "board", "skill"];
  const EVENT_TYPES = ["castaway", "storm", "siren", "navy", "mutiny"];

  let current = null;

  function emptyCounts(keys) {
    return keys.reduce((acc, key) => { acc[key] = 0; return acc; }, {});
  }

  function loadAll() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveAll(runs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(-MAX_RUNS)));
    } catch {
      // Analytics staying unsaved should never block play.
    }
  }

  function startRun(captainId, mapId) {
    current = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      captainId,
      mapId: mapId || null,
      victory: null,
      deathCause: null,
      finalAct: 0,
      finalInfamy: 0,
      finalGold: 0,
      finalHull: 0,
      finalMaxHull: 0,
      crewCount: 0,
      artifactCount: 0,
      travelCount: 0,
      safetyNetUsed: false,
      nodeCounts: emptyCounts(NODE_TYPES),
      eventCounts: emptyCounts(EVENT_TYPES),
      combatCount: 0,
      combatWins: 0,
      boardingsCaptured: 0,
      actionCounts: emptyCounts(ACTIONS),
      cardUses: {},
      cardsAcquired: [],
      cardsRemoved: [],
      energySpent: 0,
      cardTargetCount: 0,
      playerTurns: 0,
      playerTurnsByCombat: [],
      fleets: [],
      damageDealt: 0,
      damageTaken: 0,
      artifactsByRarity: { normal: 0, rare: 0, epic: 0, legendary: 0 },
    };
  }

  function recordNode(type) {
    if (!current) return;
    if (!(type in current.nodeCounts)) current.nodeCounts[type] = 0;
    current.nodeCounts[type] += 1;
  }

  function recordEvent(type) {
    if (!current) return;
    if (!(type in current.eventCounts)) current.eventCounts[type] = 0;
    current.eventCounts[type] += 1;
  }

  function recordCombatStart() {
    if (!current) return;
    current.combatCount += 1;
    current.playerTurnsByCombat.push(0);
  }

  function recordCombatEnd(won, capturedCount) {
    if (!current) return;
    if (won) current.combatWins += 1;
    current.boardingsCaptured += Math.max(0, Number(capturedCount) || 0);
  }

  function addAction(action) {
    if (!current) return;
    if (!(action in current.actionCounts)) current.actionCounts[action] = 0;
    current.actionCounts[action] += 1;
  }

  function addDamage(dealt, taken) {
    if (!current) return;
    current.damageDealt += Math.max(0, dealt || 0);
    current.damageTaken += Math.max(0, taken || 0);
  }

  function recordCardUse(cardId, family, energy, targetCount) {
    if (!cardId) return;
    if (family) Analytics.addAction(family);
    if (!current) return;
    current.cardUses[cardId] = (current.cardUses[cardId] || 0) + 1;
    current.energySpent += Math.max(0, Number(energy) || 0);
    current.cardTargetCount += Math.max(0, Number(targetCount) || 0);
  }

  function recordCardAcquired(cardId) {
    if (!cardId) return;
    if (!current) return Analytics.recordEvent(`card_acquired:${cardId}`);
    current.cardsAcquired.push(cardId);
  }

  function recordCardRemoved(cardId) {
    if (!cardId) return;
    if (!current) return Analytics.recordEvent(`card_removed:${cardId}`);
    current.cardsRemoved.push(cardId);
  }

  function recordPlayerTurn() {
    if (!current) return;
    current.playerTurns += 1;
    if (current.playerTurnsByCombat.length === 0) current.playerTurnsByCombat.push(0);
    current.playerTurnsByCombat[current.playerTurnsByCombat.length - 1] += 1;
  }

  function recordFleet(enemyCount, defeatedCount, capturedCount) {
    if (!current) return;
    current.fleets.push({
      enemyCount: Math.max(0, Number(enemyCount) || 0),
      defeatedCount: Math.max(0, Number(defeatedCount) || 0),
      capturedCount: Math.max(0, Number(capturedCount) || 0),
    });
  }

  function recordArtifact(rarity) {
    if (!current) return;
    const key = rarity in current.artifactsByRarity ? rarity : "normal";
    current.artifactsByRarity[key] += 1;
  }

  function recordSafetyNet() {
    if (!current) return;
    current.safetyNetUsed = true;
  }

  function endRun(summary) {
    if (!current) return;
    Object.assign(current, {
      endedAt: Date.now(),
      durationMs: Date.now() - current.startedAt,
      victory: Boolean(summary.victory),
      deathCause: summary.deathCause || null,
      finalAct: summary.act,
      finalInfamy: summary.infamy,
      finalGold: summary.gold,
      finalHull: summary.hull,
      finalMaxHull: summary.maxHull,
      crewCount: summary.crew,
      artifactCount: summary.artifacts,
      travelCount: summary.travelCount,
      finalDeck: Array.isArray(summary.finalDeck) ? [...summary.finalDeck] : [],
    });
    const runs = loadAll();
    runs.push(current);
    saveAll(runs);
    current = null;
  }

  function getAllRuns() {
    return loadAll();
  }

  function getSummary() {
    const runs = loadAll();
    const total = runs.length;
    const summary = {
      totalRuns: total,
      victories: 0,
      winRate: 0,
      avgInfamy: 0,
      bestInfamy: 0,
      avgTravelCount: 0,
      safetyNetUses: 0,
      deathCauses: { hull: 0, morale: 0 },
      deathByAct: {},
      byCaptain: {},
      byMap: {},
      actionTotals: emptyCounts(ACTIONS),
      recent: runs.slice(-10).reverse(),
    };
    if (total === 0) return summary;

    let infamySum = 0;
    let travelSum = 0;
    runs.forEach((run) => {
      infamySum += run.finalInfamy || 0;
      travelSum += run.travelCount || 0;
      summary.bestInfamy = Math.max(summary.bestInfamy, run.finalInfamy || 0);
      if (run.victory) summary.victories += 1;
      else if (run.deathCause) summary.deathCauses[run.deathCause] = (summary.deathCauses[run.deathCause] || 0) + 1;
      if (!run.victory) summary.deathByAct[run.finalAct] = (summary.deathByAct[run.finalAct] || 0) + 1;
      if (run.safetyNetUsed) summary.safetyNetUses += 1;

      const captain = summary.byCaptain[run.captainId] || { runs: 0, wins: 0, infamySum: 0 };
      captain.runs += 1;
      if (run.victory) captain.wins += 1;
      captain.infamySum += run.finalInfamy || 0;
      summary.byCaptain[run.captainId] = captain;

      const mapKey = run.mapId || "calm";
      const map = summary.byMap[mapKey] || { runs: 0, wins: 0, infamySum: 0 };
      map.runs += 1;
      if (run.victory) map.wins += 1;
      map.infamySum += run.finalInfamy || 0;
      summary.byMap[mapKey] = map;

      Object.entries(run.actionCounts || {}).forEach(([action, count]) => {
        summary.actionTotals[action] = (summary.actionTotals[action] || 0) + count;
      });
    });

    summary.winRate = summary.victories / total;
    summary.avgInfamy = infamySum / total;
    summary.avgTravelCount = travelSum / total;
    Object.values(summary.byCaptain).forEach((entry) => {
      entry.winRate = entry.wins / entry.runs;
      entry.avgInfamy = entry.infamySum / entry.runs;
    });
    Object.values(summary.byMap).forEach((entry) => {
      entry.winRate = entry.wins / entry.runs;
      entry.avgInfamy = entry.infamySum / entry.runs;
    });
    return summary;
  }

  function exportJSON() {
    const runs = loadAll();
    const blob = new Blob([JSON.stringify(runs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pirate-king-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  return {
    startRun,
    recordNode,
    recordEvent,
    recordCombatStart,
    recordCombatEnd,
    addAction,
    addDamage,
    recordCardUse,
    recordCardAcquired,
    recordCardRemoved,
    recordPlayerTurn,
    recordFleet,
    recordArtifact,
    recordSafetyNet,
    endRun,
    getAllRuns,
    getSummary,
    exportJSON,
    clearAll,
  };
})();
