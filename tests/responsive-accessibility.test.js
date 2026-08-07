"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("320px 레이아웃은 최소 너비를 강제하지 않고 툴팁을 뷰포트 안에 고정한다", () => {
  assert.doesNotMatch(css, /html\s*\{[^}]*min-width:\s*320px/s);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.game-tooltip::before[\s\S]*?position:\s*fixed/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.game-tooltip::before[\s\S]*?left:\s*14px[\s\S]*?right:\s*14px/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.game-tooltip::after[\s\S]*?display:\s*none/);
});

test("자원 툴팁은 실제 계산과 무감한 예외를 설명하고 초기 접근성 값도 보존한다", () => {
  assert.match(html, /포격 피해는 이 수치 전체를, 사슬탄 피해는 포수 효과만 사용합니다/);
  assert.match(html, /무감한 선원이 있으면 식량·식수 고갈로 인한 사기 피해를 받지 않습니다/);
  assert.match(html, /aria-label="선체 0 \/ 0"/);
  assert.match(html, /aria-label="식량 0"/);
  assert.match(html, /aria-label="화력 0"/);
  assert.match(html, /aria-description="적의 포격과 접안 공격/);
});

test("강제 색상 모드에서도 전투 카드와 게임 툴팁의 키보드 포커스가 보인다", () => {
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.combat-card:focus-visible[\s\S]*?outline:\s*3px solid Highlight/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.combat-card:focus-visible[\s\S]*?outline-offset:\s*3px/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.game-tooltip:focus-visible[\s\S]*?outline:\s*3px solid Highlight/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.game-tooltip:focus-visible[\s\S]*?outline-offset:\s*3px/);
});
