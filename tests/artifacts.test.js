"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

function loadGame() {
  return loadGameScripts(["src/analytics.js", "src/card-definitions.js", "src/game.js"]);
}

test("유물은 여섯 개를 넘어서도 계속 획득할 수 있다", () => {
  const context = loadGame();
  read(context, `
    run = makeTestRun({
      artifacts: ARTIFACTS.slice(0, 6),
      infamy: 0,
      morale: 50,
      crew: [],
      logs: [],
    });
  `);
  const before = JSON.parse(read(context, "JSON.stringify(run.artifacts.length)"));
  read(context, "acquireArtifact(ARTIFACTS[6])");
  const after = JSON.parse(read(context, "JSON.stringify(run.artifacts.length)"));

  assert.equal(before, 6);
  assert.equal(after, 7);
});

test("이미 지닌 유물은 중복 획득되지 않는다", () => {
  const context = loadGame();
  read(context, `
    run = makeTestRun({
      artifacts: [ARTIFACTS[0]],
      infamy: 0,
      morale: 50,
    });
  `);
  read(context, "acquireArtifact(ARTIFACTS[0])");
  const count = JSON.parse(read(context, "JSON.stringify(run.artifacts.length)"));

  assert.equal(count, 1);
});
