# 플레이어 공격 카드 피해 약화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이어의 기본 공격 카드(포격·사슬탄 계열)가 주는 피해를 새 상수 `PLAYER_DAMAGE_SCALE = 0.8`(20% 약화)로 일괄 조정하고, 카드 툴팁에 표시되는 피해 범위도 실제 계산값과 항상 일치하도록 함께 수정한다.

**Architecture:** `src/game.js`의 `cannonDamage()` 함수 반환값 전체에 `PLAYER_DAMAGE_SCALE`을 곱해, 이 함수를 공유하는 모든 포격 계열 카드(fire, aimed_fire, rapid_fire, barrage_fire, gunner_shrapnel, gunner_double_broadside, gunner_overcharge)에 한 번의 수정으로 자동 적용한다. 사슬탄 계열(chain, heavy_chain, entangling_chain, chain_rain)은 공유 함수가 없어 각 카드의 실제 피해 계산 지점에 개별적으로 스케일을 곱한다. 카드 툴팁에 피해 범위를 보여주는 `combatCannonDamageRange()`와 `combatCardDescription()`의 사슬탄 범위 계산도 실제 계산과 같은 방식으로 스케일을 적용해, 표시값과 실제값의 불일치를 없앤다.

**Tech Stack:** 순수 JavaScript(`src/game.js`), Node 내장 테스트 러너(`node --test`), 기존 vm 기반 테스트 하네스(`tests/helpers/load-game.js`).

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-08-10-player-damage-nerf-design.md`
- 스케일 상수 값은 `0.8`(20% 약화)이다.
- 적용 대상은 `cannonDamage()`가 지원하는 모든 카드와 사슬탄 계열 카드(chain, heavy_chain, entangling_chain, chain_rain) 뿐이다. `gunner_magazine_open`, `gunner_fleet_broadside`(선장 전용 필살기, `getCannonPower()`를 직접 사용), 갈고리 투척·충각 돌진·화공선 방출·결사 돌입 등 고정수치 희귀/에픽 카드, 주술·망령 계열 카드, 적의 공격이나 접안 실패 시 플레이어가 받는 피해는 이번 스코프에서 제외한다.
- 카드 툴팁에 표시되는 피해 범위(`combatCannonDamageRange()`, `combatCardDescription()`의 사슬탄 범위)는 반드시 실제 계산과 같은 스케일을 적용해 일치시켜야 한다.
- `luckyRandomInt`(사기 기반 행운 재굴림)의 확률·로직 자체는 변경하지 않는다 — `PLAYER_DAMAGE_SCALE`은 그 결과값 위에 추가로 곱해지는 별도의 상수다.
- 매 태스크 종료 시 `node --test`(파일 지정 없이 전체 실행)로 회귀를 확인하고, 205개 테스트가 모두 통과해야 한다 (현재 베이스라인은 205/205 — 이전에 있던 22개 무관 실패는 이미 별도로 수정되어 없다).

---

### Task 1: 포격 계열(cannon-family) 스케일 적용

**Files:**
- Modify: `src/game.js:1618-1620` (`cannonDamage()` 바로 앞에 상수 추가, 반환값 수정)
- Modify: `src/game.js:2620-2625` (`combatCannonDamageRange()`)
- Test: `tests/captain-card-combat.test.js`

**Interfaces:**
- Produces: `const PLAYER_DAMAGE_SCALE = 0.8;` (전역, `src/game.js`의 `cannonDamage()` 바로 위에 선언 — Task 2에서도 이 상수를 그대로 사용한다).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/captain-card-combat.test.js` 맨 아래(파일 끝)에 아래 2개 테스트를 추가한다. 이 파일은 이미 `combatForCaptain`, `crew`, `playNamed`, `read`, `loadGameScripts`, `GAME_SCRIPTS`를 상단에 갖고 있으므로 추가 import는 필요 없다.

```js
test("cannonDamage는 PLAYER_DAMAGE_SCALE(0.8)만큼 낮아진 값을 반환한다", () => {
  const context = loadGameScripts(GAME_SCRIPTS);
  const result = read(context, `(() => {
    run = { cannons: 6, crew: [], artifacts: [], morale: 0 };
    luckyRandomInt = () => 4; // 스케일 전 기본 굴림값을 고정
    return cannonDamage();
  })()`);
  // 스케일 전: getCannonPower()(6) + luckyRandomInt(4) = 10 → 스케일 후: round(10 * 0.8) = 8
  assert.equal(result, 8);
});

test("combatCannonDamageRange는 cannonDamage와 같은 스케일로 범위를 표시한다", () => {
  const context = combatForCaptain("gunner", ["fire"], { morale: 0 });
  const range = read(context, "combatCannonDamageRange()");
  // gunner 시작 화력은 8(run.cannons 6 + 선장 보너스 2), 크루 보너스 0.
  // 스케일 전 범위: 8+2=10 ~ 8+6=14 → 스케일 후: round(10*0.8)=8 ~ round(14*0.8)=11
  assert.equal(range, "8~11");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 두 테스트 모두 FAIL — 첫 번째는 `result`가 10(스케일 미적용), 두 번째는 `range`가 `"10~14"`(스케일 미적용)로 나와 assert 실패.

- [ ] **Step 3: 최소 구현 작성**

`src/game.js:1618-1620`을 아래와 같이 수정한다 (상수를 함수 바로 위에 추가):

```js
const PLAYER_DAMAGE_SCALE = 0.8;

function cannonDamage() {
  return Math.round((getCannonPower() + luckyRandomInt(2, 6) + (hasArtifact("powder") ? 3 : 0)) * PLAYER_DAMAGE_SCALE);
}
```

`src/game.js:2620-2625`을 아래와 같이 수정한다:

```js
function combatCannonDamageRange(multiplier = 1, bonus = 0) {
  const artifactBonus = hasArtifact("powder") ? 3 : 0;
  const minimum = Math.max(1, Math.round((getCannonPower() + 2 + artifactBonus) * PLAYER_DAMAGE_SCALE * multiplier + bonus));
  const maximum = Math.max(1, Math.round((getCannonPower() + 6 + artifactBonus) * PLAYER_DAMAGE_SCALE * multiplier + bonus));
  return formatCombatRange(minimum, maximum);
}
```

(기존 코드와 다른 점은 딱 하나 — `* multiplier`/`* multiplier` 앞에 `* PLAYER_DAMAGE_SCALE`을 끼워 넣은 것뿐이다. `multiplier`/`bonus` 파라미터와 나머지 로직은 그대로 둔다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 전체 PASS (새로 추가한 2개 포함).

- [ ] **Step 5: 전체 회귀 테스트 실행**

Run: `node --test`
Expected: 205개 전체 PASS. `aimed_fire`, `rapid_fire`, `barrage_fire`, `gunner_shrapnel`, `gunner_double_broadside`, `gunner_overcharge`처럼 `cannonDamage()`나 `combatCannonDamageRange()`를 참조하는 기존 테스트가 있다면, 하드코딩된 피해량 숫자를 기대하고 있어 깨질 수 있다 — 깨지는 테스트가 있으면 해당 테스트의 기댓값을 새 스케일 적용 후 값으로 갱신한다(카드 로직이나 테스트의 다른 부분은 건드리지 않는다).

- [ ] **Step 6: 커밋**

```bash
git add src/game.js tests/captain-card-combat.test.js
git commit -m "feat(balance): scale cannon-family card damage by PLAYER_DAMAGE_SCALE"
```

---

### Task 2: 사슬탄 계열(chain-family) 스케일 적용

**Files:**
- Modify: `src/game.js:1830-1836` (executePublicCard의 chain/heavy_chain/entangling_chain 분기)
- Modify: `src/game.js:1893-1896` (chain_rain, 광역 카드 분기)
- Modify: `src/game.js:2260-2264` (레거시 `combatAction()`의 `"chain"` 분기 — 게임 플레이에서 도달하지 않는 죽은 코드지만, 이전 사기 밸런스 작업(`c920aeb`, `f6e1c33`)에서도 일관성을 위해 함께 수정한 전례가 있다)
- Modify: `src/game.js:2647-2659` (`combatCardDescription()`의 사슬탄 관련 3개 항목: chain, heavy_chain, entangling_chain)
- Modify: `src/game.js:2671` (`combatCardDescription()`의 chain_rain 항목)
- Test: `tests/captain-card-combat.test.js`

**Interfaces:**
- Consumes: `PLAYER_DAMAGE_SCALE`(Task 1에서 정의된 전역 상수, `0.8`).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/captain-card-combat.test.js`에 Task 1에서 추가한 2개 테스트 다음에 아래 4개 테스트를 추가한다:

```js
test("chain 카드는 스케일이 적용된 돛 피해를 준다", () => {
  const context = combatForCaptain("gunner", ["chain"], { morale: 0 });
  read(context, "Math.random = () => 0; luckyRandomInt = () => 6;"); // 스케일 전 최소 굴림값 고정
  const before = read(context, "run.combat.enemies[0].sails");
  playNamed(context, "chain", "enemy-0");
  const after = read(context, "run.combat.enemies[0].sails");
  // 스케일 전: luckyRandomInt(6) + gunnerBonus(0) + chainLocker(0) = 6 → 스케일 후: round(6 * 0.8) = 5
  assert.equal(before - after, 5);
});

test("heavy_chain 카드는 +8 보너스를 포함한 전체 값에 스케일이 적용된다", () => {
  const context = combatForCaptain("gunner", ["heavy_chain"], { morale: 0 });
  read(context, "Math.random = () => 0; luckyRandomInt = () => 6;");
  const before = read(context, "run.combat.enemies[0].sails");
  playNamed(context, "heavy_chain", "enemy-0");
  const after = read(context, "run.combat.enemies[0].sails");
  // 스케일 전: 6 + 0 + 0 + 8 = 14 → 스케일 후: round(14 * 0.8) = 11
  assert.equal(before - after, 11);
});

test("chain_rain 카드는 스케일이 적용된 고정 돛 피해를 각 적에게 준다", () => {
  const context = combatForCaptain("gunner", ["chain_rain"], { morale: 0, enemyCount: 3 });
  read(context, "Math.random = () => 0;");
  const before = read(context, "run.combat.enemies.map((enemy) => enemy.sails)");
  playNamed(context, "chain_rain", "allEnemies");
  const after = read(context, "run.combat.enemies.map((enemy) => enemy.sails)");
  // 스케일 전: 5 + gunnerBonus(0) = 5 → 스케일 후: round(5 * 0.8) = 4, 3척 모두 동일
  assert.deepEqual(before.map((sails, index) => sails - after[index]), [4, 4, 4]);
});

test("combatCardDescription의 사슬탄 범위는 실제 계산과 같은 스케일을 표시한다", () => {
  const context = combatForCaptain("gunner", ["chain", "heavy_chain", "entangling_chain"], { morale: 0 });
  const chainDesc = read(context, `combatCardDescription(CardDefinitions.getCard("chain"))`);
  const heavyDesc = read(context, `combatCardDescription(CardDefinitions.getCard("heavy_chain"))`);
  const entangleDesc = read(context, `combatCardDescription(CardDefinitions.getCard("entangling_chain"))`);
  // chain 스케일 전 6~10 → 스케일 후 5~8
  assert.match(chainDesc, /돛 5~8 피해/);
  // heavy_chain 스케일 전 14~18 → 스케일 후 11~14
  assert.match(heavyDesc, /돛 11~14 피해/);
  // entangling_chain 스케일 전 3~6 → 스케일 후 2~5
  assert.match(entangleDesc, /돛 2~5 피해/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 새로 추가한 4개 테스트 모두 FAIL (스케일 미적용 상태의 값과 비교해 실패).

- [ ] **Step 3: 최소 구현 작성**

`src/game.js:1830-1836`을 아래와 같이 수정한다:

```js
  } else if (cardId === "chain" && resolveCardShot(resolution, enemy, "chain", -0.05)) {
    damageEnemy(enemy, { sails: Math.round((luckyRandomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0)) * PLAYER_DAMAGE_SCALE) }, resolution);
  } else if (cardId === "heavy_chain" && resolveCardShot(resolution, enemy, "chain")) {
    damageEnemy(enemy, { sails: Math.round((luckyRandomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0) + 8) * PLAYER_DAMAGE_SCALE) }, resolution);
  } else if (cardId === "entangling_chain" && resolveCardShot(resolution, enemy, "chain")) {
    damageEnemy(enemy, { sails: Math.round((luckyRandomInt(3, 6) + getGunnerBonus()) * PLAYER_DAMAGE_SCALE) }, resolution);
    enemy.movementBlocked = true;
```

`src/game.js:1893-1896`을 아래와 같이 수정한다:

```js
      if (cardId === "chain_rain") {
        const hit = resolveCardShot(resolution, candidate, "chain", -0.1);
        return { enemy: candidate, damage: hit ? { sails: Math.round((5 + getGunnerBonus()) * PLAYER_DAMAGE_SCALE) } : {} };
      }
```

`src/game.js:2260-2264`(레거시 `combatAction()`)을 아래와 같이 수정한다:

```js
  } else if (action === "chain") {
    if (consumeGuaranteedFirstShot() || Math.random() <= playerHitChance("chain")) {
      const damage = Math.round((luckyRandomInt(6, 10) + getGunnerBonus() + (hasArtifact("chainLocker") ? 4 : 0)) * PLAYER_DAMAGE_SCALE);
      enemy.sails -= damage;
      combat.message = `사슬탄이 적의 돛을 찢었다. 돛 피해 ${damage}.`;
```

`src/game.js:2647-2659`(`combatCardDescription()`)을 아래와 같이 수정한다. `chainMinimum`/`chainMaximum` 변수 자체는 스케일을 적용하지 않은 원본 값으로 유지하고(다른 곳에서 재사용하지 않으므로), 각 카드 항목에서 실제 계산과 동일한 순서로(합산 후 스케일) 표시되도록 스케일을 곱한다:

```js
function combatCardDescription(card) {
  const gunnerBonus = getGunnerBonus();
  const chainLockerBonus = hasArtifact("chainLocker") ? 4 : 0;
  const chainMinimum = 6 + gunnerBonus + chainLockerBonus;
  const chainMaximum = 10 + gunnerBonus + chainLockerBonus;
  const approachChance = combatApproachChance();
  const descriptions = {
    fire: `명중 ${combatHitChance("fire", -0.05)} · 선체 ${combatCannonDamageRange()} 피해 · 선원 1 피해 25%`,
    aimed_fire: `명중 ${combatHitChance("fire", 0.15)} · 선체 ${combatCannonDamageRange(1, 6)} 피해`,
    rapid_fire: `명중 ${combatHitChance("fire")} · 선체 ${combatCannonDamageRange(0.6)} 피해 · 카드 1장 드로우`,
    chain: `명중 ${combatHitChance("chain", -0.05)} · 돛 ${formatCombatRange(Math.round(chainMinimum * PLAYER_DAMAGE_SCALE), Math.round(chainMaximum * PLAYER_DAMAGE_SCALE))} 피해`,
    heavy_chain: `명중 ${combatHitChance("chain")} · 돛 ${formatCombatRange(Math.round((chainMinimum + 8) * PLAYER_DAMAGE_SCALE), Math.round((chainMaximum + 8) * PLAYER_DAMAGE_SCALE))} 피해`,
    entangling_chain: `명중 ${combatHitChance("chain")} · 돛 ${formatCombatRange(Math.round((3 + gunnerBonus) * PLAYER_DAMAGE_SCALE), Math.round((6 + gunnerBonus) * PLAYER_DAMAGE_SCALE))} 피해 · 다음 이동 차단`,
```

(이 블록 다음에 이어지는 `approach`, `tailwind_charge` 등 나머지 항목들은 손대지 않는다.)

`src/game.js:2671`(chain_rain 항목)을 아래와 같이 수정한다:

```js
    chain_rain: `각 적 명중 ${combatHitChance("chain", -0.1)} · 돛 ${Math.round((5 + gunnerBonus) * PLAYER_DAMAGE_SCALE)} 피해`,
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/captain-card-combat.test.js`
Expected: 전체 PASS (새로 추가한 4개 포함).

- [ ] **Step 5: 전체 회귀 테스트 실행**

Run: `node --test`
Expected: 205개 전체 PASS. 기존 사슬탄 관련 테스트(`tests/card-combat.test.js`의 `chain_rain`/`barrage_fire` 관련 테스트 등)가 하드코딩된 피해량을 기대하고 있어 깨질 수 있다 — 깨지는 테스트가 있으면 새 스케일 적용 후 값으로 기댓값만 갱신한다.

- [ ] **Step 6: 커밋**

```bash
git add src/game.js tests/captain-card-combat.test.js
git commit -m "feat(balance): scale chain-family card damage by PLAYER_DAMAGE_SCALE"
```

---

### Task 3: 최종 회귀 및 브라우저 검증

**Files:** 없음 (검증 전용 태스크).

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `node --test`
Expected: 205개 전체 PASS.

- [ ] **Step 2: 브라우저에서 실제 플레이 검증**

`.claude/launch.json`의 `pirate-game` 설정으로 미리보기 서버를 실행하고, 전투에 진입해 아래를 확인한다:
- fire 카드 사용 시 적 선체 피해량이 새로 낮아진 범위(포수장 기준 8~11)와 일치하는지, 카드 툴팁에 표시된 범위와 실제 적용된 피해가 서로 일치하는지 확인.
- chain 카드 사용 시 적 돛 피해량이 새로 낮아진 범위(5~8)와 일치하는지 확인.
- 콘솔 에러 없이 정상 동작하는지 확인.
