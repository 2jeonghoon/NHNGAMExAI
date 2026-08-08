"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

function loadGame() {
  return loadGameScripts(["src/game.js"]);
}

function generateNodes(context) {
  return JSON.parse(read(context, "JSON.stringify(generateMap(0).nodes)"));
}

function pathLengths(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const start = nodes.find((node) => node.type === "start");
  const boss = nodes.find((node) => node.type === "boss");
  const ordered = [...nodes].sort((left, right) => left.column - right.column);

  const shortest = new Map();
  const longest = new Map();
  shortest.set(start.id, 1);
  longest.set(start.id, 1);

  ordered.forEach((node) => {
    if (!shortest.has(node.id)) return;
    node.next.forEach((nextId) => {
      const candidateShort = shortest.get(node.id) + 1;
      const candidateLong = longest.get(node.id) + 1;
      if (!shortest.has(nextId) || candidateShort < shortest.get(nextId)) shortest.set(nextId, candidateShort);
      if (!longest.has(nextId) || candidateLong > longest.get(nextId)) longest.set(nextId, candidateLong);
    });
  });

  return {
    shortestToBoss: shortest.get(boss.id),
    longestToBoss: longest.get(boss.id),
    start,
    boss,
    byId,
  };
}

test("모든 노드는 시작에서 도달 가능하고 보스까지 이어진다", () => {
  const context = loadGame();
  const nodes = generateNodes(context);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const start = nodes.find((node) => node.type === "start");
  const boss = nodes.find((node) => node.type === "boss");

  const reachableFromStart = new Set([start.id]);
  const queue = [start.id];
  while (queue.length > 0) {
    const currentId = queue.shift();
    byId.get(currentId).next.forEach((nextId) => {
      if (!reachableFromStart.has(nextId)) {
        reachableFromStart.add(nextId);
        queue.push(nextId);
      }
    });
  }

  const canReachBoss = new Set([boss.id]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach((node) => {
      if (canReachBoss.has(node.id)) return;
      if (node.next.some((nextId) => canReachBoss.has(nextId))) {
        canReachBoss.add(node.id);
        changed = true;
      }
    });
  }

  reachableFromStart.forEach((id) => {
    assert.ok(canReachBoss.has(id), `노드 ${id}는 시작에서 도달 가능하지만 보스로 이어지지 않는다`);
  });
});

test("루트 길이는 항상 6개 노드로 고정되지 않고 더 짧거나 긴 경로가 존재한다", () => {
  let sawShorter = false;
  let sawLonger = false;

  for (let attempt = 0; attempt < 300 && !(sawShorter && sawLonger); attempt += 1) {
    const context = loadGame();
    const nodes = generateNodes(context);
    const { shortestToBoss, longestToBoss } = pathLengths(nodes);
    if (shortestToBoss < 6) sawShorter = true;
    if (longestToBoss > 6) sawLonger = true;
  }

  assert.ok(sawShorter, "300번 생성 중 6개보다 짧은 경로가 한 번도 나오지 않았다");
  assert.ok(sawLonger, "300번 생성 중 6개보다 긴 경로가 한 번도 나오지 않았다");
});

test("기본 6개 컬럼 구조는 그대로 유지된다", () => {
  const context = loadGame();
  const nodes = generateNodes(context);
  const columns = new Set(nodes.map((node) => Math.trunc(node.column)));
  assert.deepEqual([...columns].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.equal(nodes.filter((node) => node.type === "start").length, 1);
  assert.equal(nodes.filter((node) => node.type === "boss").length, 1);
});
