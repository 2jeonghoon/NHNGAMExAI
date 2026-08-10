# 사기 기반 공격 카드 피해 보정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사기(morale)가 높을수록 플레이어의 포격·사슬탄 공격 카드가 굴리는 랜덤 피해에서 높은 값이 나올 확률을 높이고, 이 효과를 사기 HUD 툴팁에 문서화한다.

**Architecture:** `src/game.js`에 `luckyRandomInt(min, max)` 헬퍼를 새로 추가한다. 이 함수는 먼저 기존 `randomInt(min, max)`로 한 번 굴리고, `run.morale / 100` 확률로 한 번 더 굴려 더 큰 값을 채택하는 "이점(Advantage)" 방식이다. 이 헬퍼를 `cannonDamage()`와 사슬탄 계열 3개 인라인 호출부(chain, heavy_chain, entangling_chain)에서만 기존 `randomInt` 대신 사용한다. 다른 곳(적 공격, 이벤트, 접안 실패 피해 등)은 그대로 둔다.

**Tech Stack:** 순수 JavaScript(`src/game.js`), Node 내장 테스트 러너(`node --test`), 기존 vm 기반 테스트 하네스(`tests/helpers/load-game.js`).

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-08-10-morale-damage-luck-design.md`
- 적용 대상은 `cannonDamage()`와 `src/game.js`의 chain/heavy_chain/entangling_chain 인라인 굴림 3곳뿐이다. 다른 `randomInt` 호출부(적 공격, 이벤트, 접안 실패 피해, crew 인덱스 추첨 등)는 손대지 않는다.
- `randomInt` 함수 시그니처와 다른 호출부는 변경하지 않는다.
- 카드 설명(`combatCardDescription`, `card-definitions.js`)은 변경하지 않는다 — 설명 문구 추가는 사기 HUD 툴팁 한 곳에만 한다.
- 매 태스크 종료 시 `node --test`(파일 지정 없이 전체 실행)로 회귀를 확인하고, 실패 개수가 기존 알려진 22개(드래그/reduced-motion 관련, 이번 작업과 무관)에서 늘지 않았는지 확인한다.

---

### Task 1: `luckyRandomInt` 헬퍼 추가

**Files:**
- Modify: `src/game.js:461-463` (바로 아래에 새 함수 추가)
- Test: `tests/captain-card-combat.test.js`

**Interfaces:**
- Produces: `luckyRandomInt(min: number, max: number): number` — 전역(non-module script이므로 파일 내 어디서든 호출 가능).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/captain-card-combat.test.js` 맨 아래(파일 끝, 마지막 `test(...)` 블록 다음)에 아래 3개 테스트를 추가한다:

```js
test("사기 0이면 luckyRandomInt는 항상 첫 굴림 값만 사용한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const result = read(context, `(() => {
    run = { morale: 0 };
    const rolls = [0, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(result, 1);
});

test("사기 100이면 luckyRandomInt는 항상 재굴림 후 더 큰 값을 채택한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const result = read(context, `(() => {
    run = { morale: 100 };
    const rolls = [0, 0, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(result, 10);
});

test("사기 50이면 재굴림 확률 체크는 Math.random() < 0.5로 이루어진다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const notRerolled = read(context, `(() => {
    run = { morale: 50 };
    const rolls = [0, 0.5, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(notRerolled, 1);

  const rerolled = read(context, `(() => {
    run = { morale: 50 };
    const rolls = [0, 0.49, 0.99];
    Math.random = () => rolls.shift();
    return luckyRandomInt(1, 10);
  })()`);
  assert.equal(rerolled, 10);
});
```

이 파일은 이미 `const { loadGameScripts, read } = require("./helpers/load-game.js");`와 `const GAME_SCRIPTS = [...]`를 상단에 갖고 있으므로 추가 import는 필요 없다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 방금 추가한 3개 테스트가 `ReferenceError: luckyRandomInt is not defined`로 FAIL. 기존 테스트들은 그대로 PASS.

- [ ] **Step 3: 최소 구현 작성**

`src/game.js:461-463`의 `randomInt` 함수 바로 다음에 아래 함수를 추가한다:

```js
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function luckyRandomInt(min, max) {
  const first = randomInt(min, max);
  const moraleChance = clamp((run?.morale || 0) / 100, 0, 1);
  if (Math.random() < moraleChance) {
    return Math.max(first, randomInt(min, max));
  }
  return first;
}
```

(`clamp`는 `src/game.js:514`에 이미 정의되어 있고, 함수 선언은 호이스팅되므로 `luckyRandomInt`가 파일 앞쪽에 있어도 문제없이 호출된다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 전체 PASS (새로 추가한 3개 포함).

- [ ] **Step 5: 커밋**

```bash
git add src/game.js tests/captain-card-combat.test.js
git commit -m "feat(combat): add morale-weighted luckyRandomInt helper"
```

---

### Task 2: 포격·사슬탄 카드에 `luckyRandomInt` 연결

**Files:**
- Modify: `src/game.js:1610` (`cannonDamage()`)
- Modify: `src/game.js:1822`, `:1824`, `:1826` (chain, heavy_chain, entangling_chain)
- Test: `tests/captain-card-combat.test.js`

**Interfaces:**
- Consumes: `luckyRandomInt(min, max): number` (Task 1에서 생성).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/captain-card-combat.test.js`에 Task 1에서 추가한 3개 테스트 다음에 아래 2개 테스트를 추가한다 (이 파일은 이미 `combatForCaptain`, `crew`, `playNamed` 헬퍼를 갖고 있다):

```js
test("cannonDamage는 luckyRandomInt(2, 6)을 사용한다", () => {
  const context = combatForCaptain("gunner", ["fire"], { morale: 60 });
  const calls = JSON.parse(read(context, `JSON.stringify((() => {
    const calls = [];
    luckyRandomInt = (min, max) => { calls.push([min, max]); return max; };
    playCard(run.combat.cardState.hand[0].instanceId, "enemy-0");
    return calls;
  })())`));
  assert.deepEqual(calls, [[2, 6]]);
});

test("사슬탄 계열 카드(chain, heavy_chain, entangling_chain)는 luckyRandomInt로 피해를 굴린다", () => {
  const context = combatForCaptain("gunner", ["chain", "heavy_chain", "entangling_chain"], { morale: 40 });
  const calls = JSON.parse(read(context, `JSON.stringify((() => {
    const calls = [];
    luckyRandomInt = (min, max) => { calls.push([min, max]); return max; };
    playCard(run.combat.cardState.hand.find((c) => c.cardId === "chain").instanceId, "enemy-0");
    playCard(run.combat.cardState.hand.find((c) => c.cardId === "heavy_chain").instanceId, "enemy-0");
    playCard(run.combat.cardState.hand.find((c) => c.cardId === "entangling_chain").instanceId, "enemy-0");
    return calls;
  })())`));
  assert.deepEqual(calls, [[6, 10], [6, 10], [3, 6]]);
});
```

이 테스트들은 `luckyRandomInt`를 스파이로 교체해 각 카드가 실제로 `luckyRandomInt`를 (그리고 정확히 기존과 동일한 min/max 범위로) 호출하는지 확인한다. `combatForCaptain`이 기본으로 `Math.random = () => 0`을 설정해두므로 명중 판정은 항상 성공한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 두 테스트 모두 FAIL — `calls`가 빈 배열(`[]`)이 되어 `assert.deepEqual`이 실패한다 (아직 `cannonDamage`와 chain 계열이 `randomInt`를 직접 쓰고 있어 스파이가 호출되지 않음).

- [ ] **Step 3: 카드 로직을 `luckyRandomInt`로 교체**

`src/game.js:1609-1611`:

```js
function cannonDamage() {
  return getCannonPower() + luckyRandomInt(2, 6) + (hasArtifact("powder") ? 3 : 0);
}
```

`src/game.js:1821-1826` (chain, heavy_chain, entangling_chain 세 분기):

```js
  } else if (cardId === "chain" && resolveCardShot(resolution, enemy, "chain", -0.05)) {
    damageEnemy(enemy, { sails: luckyRandomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0) }, resolution);
  } else if (cardId === "heavy_chain" && resolveCardShot(resolution, enemy, "chain")) {
    damageEnemy(enemy, { sails: luckyRandomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0) + 8 }, resolution);
  } else if (cardId === "entangling_chain" && resolveCardShot(resolution, enemy, "chain")) {
    damageEnemy(enemy, { sails: luckyRandomInt(3, 6) + getGunnerBonus() }, resolution);
    enemy.movementBlocked = true;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 전체 PASS.

- [ ] **Step 5: 전체 회귀 테스트 실행**

Run: `node --test`
Expected: 기존에 알려진 22개 실패(드래그 재배치·reduced-motion 관련, 이번 작업과 무관)만 남고, 그 외 전부 PASS. 실패 개수가 22보다 늘어나면 안 된다.

- [ ] **Step 6: 커밋**

```bash
git add src/game.js tests/captain-card-combat.test.js
git commit -m "feat(combat): weight cannon/chain card damage rolls by morale"
```

---

### Task 3: 사기 HUD 툴팁에 설명 추가

**Files:**
- Modify: `index.html:117`, `:119`

**Interfaces:** 없음 (정적 텍스트 수정).

- [ ] **Step 1: 툴팁 텍스트 수정**

`index.html`의 사기 항목(`data-tooltip`과 `aria-description` 두 속성 모두, 현재 동일한 문장이 중복되어 있음)에 아래 문장을 이어 붙인다:

기존:
```html
data-tooltip="선원들의 전투 의지입니다. 이동 중 보급 고갈과 전투 피해로 감소하며, 사기가 0이 되면 선상 반란으로 항해가 끝납니다. 무감한 선원이 있으면 식량·식수 고갈로 인한 사기 피해를 받지 않습니다."
```

변경 후:
```html
data-tooltip="선원들의 전투 의지입니다. 이동 중 보급 고갈과 전투 피해로 감소하며, 사기가 0이 되면 선상 반란으로 항해가 끝납니다. 무감한 선원이 있으면 식량·식수 고갈로 인한 사기 피해를 받지 않습니다. 사기가 높을수록 포격·사슬탄 공격의 피해가 두 번 굴려 더 높은 값을 채택하는 방식으로 유리하게 보정됩니다."
```

`aria-description`에도 동일하게 적용한다 (두 속성 모두 지금 정확히 같은 문자열이므로, 같은 문장을 그대로 양쪽에 붙이면 된다).

- [ ] **Step 2: 브라우저에서 확인**

`.claude/launch.json`의 `pirate-game` 설정으로 미리보기 서버를 실행하고, 사기 HUD 항목에 마우스를 올려(hover) 또는 포커스해 툴팁에 새 문장이 표시되는지 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add index.html
git commit -m "docs(ui): explain morale's damage-luck effect in its tooltip"
```

---

### Task 4: 최종 회귀 및 브라우저 검증

**Files:** 없음 (검증 전용 태스크).

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `node --test`
Expected: 총 실패 개수가 Task 2 이전과 동일(기존 22개, 이번 작업과 무관한 드래그/reduced-motion 실패)해야 한다. 새로 실패하는 테스트가 있으면 원인을 찾아 고친다.

- [ ] **Step 2: 브라우저에서 실제 플레이 검증**

미리보기 서버(`pirate-game`)를 실행하고, 전투에 진입해 아래를 확인한다:
- `run.morale`을 100으로 강제 설정한 뒤(devtools/`javascript_tool`로 `run` 접근 불가하므로, 테스트로 이미 커버된 로직 신뢰) 사기 HUD를 hover해 새 툴팁 문구가 보이는지 확인.
- 포격/사슬탄 카드를 실제로 사용해도 게임이 정상 동작하고(에러 없음) 피해가 표시되는지 확인.

- [ ] **Step 3: 최종 커밋 여부 확인**

`git status`로 미커밋 변경이 없는지 확인한다 (Task 1~3에서 이미 각각 커밋했어야 함).
