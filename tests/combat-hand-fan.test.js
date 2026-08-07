"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadGameScripts, read } = require("./helpers/load-game.js");

function fan(index, total) {
  const context = loadGameScripts([
    "src/analytics.js",
    "src/card-definitions.js",
    "src/game.js",
  ]);
  return JSON.parse(read(context, `JSON.stringify(fanCardTransform(${index}, ${total}))`));
}

test("카드가 한 장이면 회전과 리프트가 0이다", () => {
  assert.deepEqual(fan(0, 1), { rotateDeg: 0, liftPx: 0 });
});

test("카드가 없으면(total 0) 회전과 리프트가 0이다", () => {
  assert.deepEqual(fan(0, 0), { rotateDeg: 0, liftPx: 0 });
});

test("홀수 장수는 중앙 카드가 회전 0, 바깥으로 갈수록 대칭 회전한다", () => {
  assert.deepEqual(fan(2, 5), { rotateDeg: 0, liftPx: 0 });
  assert.deepEqual(fan(0, 5), { rotateDeg: -12, liftPx: 10 });
  assert.deepEqual(fan(4, 5), { rotateDeg: 12, liftPx: 10 });
  assert.deepEqual(fan(1, 5), { rotateDeg: -6, liftPx: 5 });
});

test("짝수 장수는 중앙 두 장이 대칭으로 살짝 회전한다", () => {
  assert.deepEqual(fan(0, 2), { rotateDeg: -3, liftPx: 2.5 });
  assert.deepEqual(fan(1, 2), { rotateDeg: 3, liftPx: 2.5 });
});

test("최대 손패(8장)에서도 회전각이 최대치를 넘지 않는다", () => {
  const result = fan(0, 8);
  assert.equal(result.rotateDeg, -16);
  const result2 = fan(7, 8);
  assert.equal(result2.rotateDeg, 16);
});
