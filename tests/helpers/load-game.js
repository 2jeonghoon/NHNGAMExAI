"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function makeElement() {
  return {
    addEventListener() {},
    append() {},
    appendChild() {},
    classList: { add() {}, remove() {}, toggle() {} },
    click() {},
    closest() { return null; },
    disabled: false,
    getBoundingClientRect() { return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 }; },
    hidden: true,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    remove() {},
    replaceChildren() {},
    setAttribute() {},
    style: { setProperty() {} },
    textContent: "",
  };
}

function makeCanvas() {
  const context = new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = () => {};
      return target[property];
    },
  });
  return {
    ...makeElement(),
    height: 620,
    width: 960,
    getContext() { return context; },
  };
}

function createContext(overrides = {}) {
  const canvas = overrides.canvas || makeCanvas();
  const document = overrides.document || {
    addEventListener() {},
    createElement() { return makeElement(); },
    querySelector(selector) { return selector === "#gameCanvas" ? canvas : makeElement(); },
  };
  const base = {
    AudioContext: function AudioContext() {},
    Image: function Image() {
      this.complete = false;
      this.naturalWidth = 0;
    },
    console,
    document,
    localStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    requestAnimationFrame() {},
    setTimeout,
    window: { addEventListener() {} },
  };
  const context = vm.createContext({ ...base, ...overrides });
  if (!overrides.window) {
    context.window = context;
    context.window.addEventListener = () => {};
  }
  return context;
}

function browserSource(file) {
  const source = fs.readFileSync(path.resolve(PROJECT_ROOT, file), "utf8");
  if (file !== "src/game.js") return source;
  return source.replace(
    /\r?\nshowHarbor\(\);\r?\nrequestAnimationFrame\(renderFrame\);\s*$/,
    "\n",
  );
}

function loadGameScripts(files, overrides = {}) {
  const context = createContext(overrides);
  files.forEach((file) => {
    vm.runInContext(browserSource(file), context, { filename: path.resolve(PROJECT_ROOT, file) });
  });
  installGameFixtures(context);
  return context;
}

function runGame(source, overrides = {}) {
  const context = loadGameScripts([
    "src/analytics.js",
    "src/card-definitions.js",
    "src/game.js",
  ], overrides);
  return vm.runInContext(source, context);
}

function read(context, expression) {
  return vm.runInContext(expression, context);
}

function installGameFixtures(context) {
  vm.runInContext(`
    globalThis.makeTestRun = (overrides = {}) => ({
      actIndex: 0,
      captainId: "gunner",
      deck: ["fire", "fire", "fire", "chain", "chain", "approach", "approach", "retreat", "repair", "board"],
      gold: 20,
      hull: 30,
      maxHull: 30,
      mode: "combat",
      morale: 20,
      sails: 20,
      maxSails: 20,
      ...overrides,
    });
    globalThis.enemyState = (overrides = {}) => ({
      id: "enemy-1",
      hull: 24,
      maxHull: 24,
      name: "테스트 적선",
      sails: 16,
      maxSails: 16,
      crew: 8,
      maxCrew: 8,
      distance: 2,
      ...overrides,
    });
  `, context);
}

module.exports = { installGameFixtures, loadGameScripts, makeElement, read, runGame };
