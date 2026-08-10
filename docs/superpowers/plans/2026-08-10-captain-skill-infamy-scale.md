# 선장 특수 스킬 악명 기반 위력 조정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4개 선장 특수 스킬의 핵심 위력 수치가 악명(`run.infamy`)에 따라 0.7배(악명 0)~1.2배(악명 100+)로 스케일되게 하고, 포수(gunner) 스킬의 기본값은 16→12로 별도 인하한다. 악명/전승 HUD 툴팁에 새 메커니즘을 설명하는 문구를 추가한다.

**Architecture:** `src/game.js`에 `infamySkillScale()` 헬퍼를 추가한다 (`clamp(0.7 + run.infamy/200, 0.7, 1.2)`). `useCaptainSkill()`의 4개 선장 분기 각각에서 핵심 위력 수치(포수 선체피해, 조타수 돛피해, 주술사 선체피해, 망령 선체피해) 전체에 이 스케일을 곱한다. 스킬 버튼 자체는 위력 수치를 미리 보여주지 않으므로(스킬 이름만 표시) 이전 카드 피해 작업과 달리 별도 "표시용" 함수를 동기화할 필요가 없다.

**Tech Stack:** 순수 JavaScript(`src/game.js`), Node 내장 테스트 러너(`node --test`), 기존 vm 기반 테스트 하네스(`tests/helpers/load-game.js`).

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-08-10-captain-skill-infamy-scale-design.md`
- `infamySkillScale()` 공식은 정확히 `clamp(0.7 + (run?.infamy || 0) / 200, 0.7, 1.2)`이다.
- 스케일 적용 대상은 4개 선장 스킬의 "핵심 위력 수치"만이다 — 포수의 돛 -4, 조타수의 회피율·거리 재배치·자신의 돛 회복, 주술사의 돛/선원 피해·사기 회복, 망령의 자신 선체 회복량 등 부가 효과는 건드리지 않는다.
- 포수 스킬의 기본값은 `16`에서 `12`로 낮춘다 (화력 계수 0.8배, 파우더 아티팩트 보너스는 그대로 유지).
- 카드 데미지·사기 기반 행운 보정 등 이전에 이미 완료된 밸런스 요소는 건드리지 않는다.
- 매 태스크 종료 시 `node --test`(파일 지정 없이 전체 실행)로 회귀를 확인하고, 212개 테스트가 모두 통과해야 한다 (현재 베이스라인은 212/212).

---

### Task 1: `infamySkillScale()` 헬퍼 추가

**Files:**
- Modify: `src/game.js` (`useCaptainSkill()` 바로 앞, `src/game.js:2167` 부근에 새 함수 추가)
- Test: `tests/captain-card-combat.test.js`

**Interfaces:**
- Produces: `infamySkillScale(): number` (전역, 파일 내 어디서든 호출 가능 — Task 2에서 사용).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/captain-card-combat.test.js` 맨 아래(파일 끝)에 아래 테스트를 추가한다. 이 파일은 이미 `loadGameScripts`, `read`, `GAME_SCRIPTS`를 상단에 갖고 있으므로 추가 import는 필요 없다.

```js
test("infamySkillScale은 악명 0/60/100/150에서 각각 0.7/1.0/1.2/1.2를 반환한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const at = (infamy) => read(context, `(() => { run = { infamy: ${infamy} }; return infamySkillScale(); })()`);
  assert.equal(at(0), 0.7);
  assert.equal(at(60), 1);
  assert.equal(at(100), 1.2);
  assert.equal(at(150), 1.2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: `ReferenceError: infamySkillScale is not defined`로 FAIL. 기존 테스트들은 그대로 PASS.

- [ ] **Step 3: 최소 구현 작성**

`src/game.js:2167`(`function useCaptainSkill(target) {`) 바로 앞에 아래 함수를 추가한다:

```js
function infamySkillScale() {
  return clamp(0.7 + (run?.infamy || 0) / 200, 0.7, 1.2);
}

function useCaptainSkill(target) {
```

(`clamp`는 `src/game.js:514`에 이미 정의되어 있다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 전체 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/game.js tests/captain-card-combat.test.js
git commit -m "feat(combat): add infamy-based captain skill power scale"
```

---

### Task 2: 4개 선장 스킬에 스케일 적용

**Files:**
- Modify: `src/game.js:2177-2207`(`useCaptainSkill()`의 4개 선장 분기)
- Test: `tests/captain-card-combat.test.js`

**Interfaces:**
- Consumes: `infamySkillScale(): number` (Task 1에서 생성).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/captain-card-combat.test.js`에 Task 1에서 추가한 테스트 다음에 아래 4개 테스트를 추가한다. 이 파일은 이미 `combatForCaptain`, `useSkill`, `read`를 갖고 있다. 각 테스트는 `combatForCaptain`으로 전투를 만든 뒤 `run.infamy`를 직접 덮어써서 스킬을 사용한다 (`combatForCaptain`은 `infamy`를 별도로 받지 않으므로 `read(context, "run.infamy = N;")`로 설정한다).

```js
test("포수 스킬은 악명에 따라 12+화력*0.8 기반 선체 피해가 스케일된다", () => {
  const context = combatForCaptain("gunner", ["fire"]);
  read(context, "run.infamy = 0;");
  const before0 = read(context, "run.combat.enemies[0].hull");
  useSkill(context, "enemy-0");
  const after0 = read(context, "run.combat.enemies[0].hull");
  // 화력 6(run.cannons) 기준: 12 + floor(6*0.8) = 16 → 악명 0: round(16*0.7) = 11
  assert.equal(before0 - after0, 11);

  const context2 = combatForCaptain("gunner", ["fire"]);
  read(context2, "run.infamy = 100;");
  const before100 = read(context2, "run.combat.enemies[0].hull");
  useSkill(context2, "enemy-0");
  const after100 = read(context2, "run.combat.enemies[0].hull");
  // 악명 100+: round(16*1.2) = 19
  assert.equal(before100 - after100, 19);
});

test("조타수 스킬은 악명에 따라 10+포수보너스 기반 돛 피해가 스케일된다", () => {
  const context = combatForCaptain("navigator", ["approach"]);
  read(context, "run.infamy = 0;");
  const before = read(context, "run.combat.enemies[0].sails");
  useSkill(context, "enemy-0");
  const after = read(context, "run.combat.enemies[0].sails");
  // 크루 없음(포수 보너스 0) 기준: 10 → 악명 0: round(10*0.7) = 7
  assert.equal(before - after, 7);
});

test("주술사 스킬은 악명에 따라 고정값 6 기반 선체 피해가 스케일된다", () => {
  const context = combatForCaptain("mystic", ["approach"]);
  read(context, "run.infamy = 60;");
  const before = read(context, "run.combat.enemies[0].hull");
  useSkill(context, "enemy-0");
  const after = read(context, "run.combat.enemies[0].hull");
  // 악명 60: round(6*1.0) = 6
  assert.equal(before - after, 6);
});

test("망령 스킬은 악명에 따라 10+화력*0.5 기반 선체 피해가 스케일된다", () => {
  const context = combatForCaptain("revenant", ["approach"]);
  read(context, "run.infamy = 0;");
  const before = read(context, "run.combat.enemies[0].hull");
  useSkill(context, "enemy-0");
  const after = read(context, "run.combat.enemies[0].hull");
  // 화력 6 기준: 10 + floor(6*0.5) = 13 → 악명 0: round(13*0.7) = 9
  assert.equal(before - after, 9);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 4개 테스트 모두 FAIL (스케일 미적용 및 포수 기본값 16 상태의 기존 수치와 비교해 실패).

- [ ] **Step 3: 최소 구현 작성**

`src/game.js:2177-2207`을 아래와 같이 수정한다 (기본값 변경은 포수 분기에만 적용, 나머지 3개 분기는 스케일만 추가):

```js
  if (captain().id === "gunner") {
    const damage = Math.round((12 + Math.floor(getCannonPower() * 0.8) + (hasArtifact("powder") ? 3 : 0)) * infamySkillScale());
    dealEnemyHullDamage(enemy, damage);
    enemy.sails -= 4;
    combat.message = `전탄 일제사격! 적 선체에 ${damage} 피해.`;
    addCannonEffect("player", true, false, enemy.id, enemyEffectAnchor);
    playTone(76, 0.28, "square", 0.065);
  } else if (captain().id === "navigator") {
    FleetCombat.livingEnemies(combat.enemies).forEach((candidate) => setEnemyRange(candidate.id, 3));
    combat.evasion = 0.8;
    run.sails = Math.min(run.maxSails, run.sails + 5);
    const stormDamage = Math.round((10 + getGunnerBonus()) * infamySkillScale());
    enemy.sails = Math.max(0, enemy.sails - stormDamage);
    combat.message = `폭풍 가르기! 사선을 벗어나 돛을 복구하고 적 돛에 ${stormDamage} 피해를 입혔다.`;
    playTone(720, 0.15, "triangle");
  } else if (captain().id === "mystic") {
    dealEnemyHullDamage(enemy, Math.round(6 * infamySkillScale()));
    enemy.sails -= 7;
    enemy.crew = Math.max(0, enemy.crew - 4);
    run.morale = clamp(run.morale + 5, 0, 100);
    combat.message = "심해의 속삭임이 적 함선 전체를 뒤흔든다.";
    playTone(190, 0.3, "sine", 0.05);
  } else {
    const damage = Math.round((10 + Math.floor(getCannonPower() * 0.5)) * infamySkillScale());
    const heal = 8 + getCarpenterRepairBonus();
    dealEnemyHullDamage(enemy, damage);
    enemy.sails -= 5;
    run.hull = Math.min(run.maxHull, run.hull + heal);
    combat.message = `저승의 진혼곡! 적에게 ${damage} 피해를 주고 선체 ${heal}을 되돌렸다.`;
    addCannonEffect("player", false, false, enemy.id, enemyEffectAnchor);
    playTone(300, 0.24, "sine", 0.05);
```

(주술사 분기는 기존에 `dealEnemyHullDamage(enemy, 6);`처럼 damage 변수 없이 리터럴을 바로 넘겼으므로, 위처럼 `Math.round(6 * infamySkillScale())`를 그 자리에 인라인으로 넣는다. 나머지 라인은 그대로 둔다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 전체 PASS.

- [ ] **Step 5: 전체 회귀 테스트 실행**

Run: `node --test`
Expected: 212개 전체 PASS. 기존에 선장 스킬의 하드코딩된 피해량을 기대하는 테스트(`tests/captain-card-combat.test.js`의 다른 테스트, `useSkill` 관련 테스트 등)가 있다면, 그 테스트들의 `combatForCaptain` 호출에 `run.infamy`가 설정되지 않아 기본값 `undefined`(→`infamySkillScale()`에서 0으로 처리, 배율 0.7배)로 동작할 것이다 — 하드코딩된 기대값이 깨지면 새 스케일(0.7배) 적용 후 값으로 갱신한다.

- [ ] **Step 6: 커밋**

```bash
git add src/game.js tests/captain-card-combat.test.js
git commit -m "feat(balance): scale captain skill power by infamy and lower gunner base"
```

---

### Task 3: 악명/전승 HUD 툴팁 문구 추가

**Files:**
- Modify: `index.html:34`, `:38`

**Interfaces:** 없음 (정적 텍스트 수정).

- [ ] **Step 1: 툴팁 텍스트 수정**

`index.html:34`(악명 항목)을 아래와 같이 수정한다:

기존:
```html
<div title="이번 항해에서 쌓은 악명입니다. 항해가 끝나면 전승 악명에 합산되어 유산 강화에 사용됩니다.">
```

변경 후:
```html
<div title="이번 항해에서 쌓은 악명입니다. 항해가 끝나면 전승 악명에 합산되어 유산 강화에 사용됩니다. 악명이 높을수록 선장 특수 스킬의 위력이 강해집니다.">
```

`index.html:38`(전승 항목)을 아래와 같이 수정한다:

기존:
```html
<div title="이전 항해들에서 누적된 전승 악명입니다. 해적왕의 유산 강화를 구매하는 데 사용합니다.">
```

변경 후:
```html
<div title="이전 항해들에서 누적된 전승 악명입니다. 해적왕의 유산 강화를 구매하는 데 사용합니다. 이번 항해의 악명과 달리 전투 위력에는 영향을 주지 않습니다.">
```

- [ ] **Step 2: 브라우저에서 확인**

`.claude/launch.json`의 `pirate-game` 설정으로 미리보기 서버를 실행하고, 악명/전승 HUD 항목에 마우스를 올려(hover) 또는 포커스해 툴팁에 새 문장이 표시되는지 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add index.html
git commit -m "docs(ui): explain infamy's captain-skill-power effect in its tooltip"
```

---

### Task 4: 최종 회귀 및 브라우저 검증

**Files:** 없음 (검증 전용 태스크).

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `node --test`
Expected: 212개 전체 PASS (Task 1/2에서 추가한 5개 포함하면 217개 이상).

- [ ] **Step 2: 브라우저에서 실제 플레이 검증**

미리보기 서버(`pirate-game`)를 실행하고, 전투에 진입해 아래를 확인한다:
- 악명/전승 HUD를 hover해 새 툴팁 문구가 보이는지 확인.
- 선장 스킬(Q)을 실제로 사용해도 게임이 정상 동작하고(에러 없음), 전투 로그에 표시되는 피해량이 악명 0인 항해 초반에는 예전보다 낮게 나오는지 확인.
