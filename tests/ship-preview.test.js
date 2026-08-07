"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const { loadGameScripts } = require("./helpers/load-game.js");

test("항해 전 미리보기에 선택한 선장의 배 이미지를 사용한다", () => {
  const context = loadGameScripts(["src/game.js"]);
  const calls = vm.runInContext(`
    globalThis.shipDrawCalls = [];
    drawOcean = () => {};
    drawIslandSilhouette = () => {};
    drawShip = (...args) => shipDrawCalls.push(args);
    run = null;
    selectedCaptainId = "gunner";
    drawMap(0);
    selectedCaptainId = "navigator";
    drawMap(0);
    shipDrawCalls;
  `, context);

  assert.equal(calls.length, 2);
  assert.equal(
    calls[0][5],
    "./src/assets/ships/player/ship-player-isabella-black-barrel.png",
  );
  assert.equal(
    calls[1][5],
    "./src/assets/ships/player/ship-player-raul-storm-eye.png",
  );
});
