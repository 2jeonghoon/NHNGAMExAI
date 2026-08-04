"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function makeElement() {
  return {
    addEventListener() {},
    append() {},
    classList: { add() {}, remove() {}, toggle() {} },
    hidden: true,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    replaceChildren() {},
    setAttribute() {},
    style: { setProperty() {} },
  };
}

function loadGameContext() {
  const canvas = { ...makeElement(), getContext: () => ({}) };
  const document = {
    addEventListener() {},
    querySelector(selector) {
      return selector === "#gameCanvas" ? canvas : makeElement();
    },
  };
  const context = vm.createContext({
    AudioContext: function AudioContext() {},
    Image: function Image() {},
    console,
    document,
    localStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    requestAnimationFrame() {},
    setTimeout,
    window: { addEventListener() {} },
  });
  const gamePath = path.join(__dirname, "..", "src", "game.js");
  const source = fs.readFileSync(gamePath, "utf8").replace(
    /\nshowHarbor\(\);\nrequestAnimationFrame\(renderFrame\);\s*$/,
    "\n",
  );
  vm.runInContext(source, context, { filename: gamePath });
  return context;
}

test("항해 전 미리보기에 선택한 선장의 배 이미지를 사용한다", () => {
  const context = loadGameContext();
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
